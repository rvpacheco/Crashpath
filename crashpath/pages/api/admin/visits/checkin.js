import { getToken } from "next-auth/jwt";
import dbConnect from "../../../../lib/mongodb";
import User from "../../../../models/User";

const secret = process.env.NEXTAUTH_SECRET;

function normalizeEmail(v) {
  return typeof v === "string" ? v.trim().toLowerCase() : "";
}

function getReqMeta(req) {
  const xf = req.headers["x-forwarded-for"];
  const ip = Array.isArray(xf) ? xf[0] : (xf || "").split(",")[0].trim();
  return {
    ip: ip || null,
    userAgent: req.headers["user-agent"] || null,
  };
}

// “Hoy” en Bogotá => rango UTC equivalente
function dayRangeBogota(dateLike) {
  const base = dateLike ? new Date(dateLike) : new Date();
  if (Number.isNaN(base.getTime())) return null;

  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Bogota",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(base);

  const y = parts.find((p) => p.type === "year")?.value;
  const m = parts.find((p) => p.type === "month")?.value;
  const d = parts.find((p) => p.type === "day")?.value;
  if (!y || !m || !d) return null;

  // Bogotá ~ -05:00: 00:00 Bogotá == 05:00 UTC
  const start = new Date(`${y}-${m}-${d}T05:00:00.000Z`);
  const end = new Date(`${y}-${m}-${d}T04:59:59.999Z`);
  end.setUTCDate(end.getUTCDate() + 1);

  return { start, end };
}

function canAccessOrFail(user) {
  if (user.accessType === "ticketera") {
    if ((user.credits ?? 0) <= 0) return { ok: false, code: "NO_CREDITS", message: "Sin créditos disponibles." };
  }
  if (user.accessType === "mensualidad") {
    const end = user.mensualidad?.endDate ? new Date(user.mensualidad.endDate) : null;
    if (!end || new Date() > end) return { ok: false, code: "MENSUALIDAD_VENCIDA", message: "Mensualidad vencida o inactiva." };
  }
  return { ok: true };
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ message: "Method not allowed" });

  const token = await getToken({ req, secret });
  if (!token) return res.status(401).json({ message: "Not authenticated" });
  if (!token.isAdmin) return res.status(403).json({ message: "Admin only" });

  const { userId, email, date, createIfMissing = true, notes = "" } = req.body || {};
  if (!userId && !email) return res.status(400).json({ message: "Provide userId or email" });

  const range = dayRangeBogota(date);
  if (!range) return res.status(400).json({ message: "Invalid date" });

  await dbConnect();

  const query = userId ? { _id: userId } : { email: normalizeEmail(email) };
  const meta = getReqMeta(req);
  const actor = { id: token.sub || null, name: token.name || null, email: token.email || null, role: "admin" };
  const now = new Date();

  try {
    // 1) leer usuario (1 vez) para saber si existe y validar acceso “amable”
    const user = await User.findOne(query).lean();
    if (!user) return res.status(404).json({ message: "User not found" });

    // Si ya tiene visita checked_in hoy => idempotente
    const visits = Array.isArray(user.visits) ? user.visits : [];
    const existingToday = visits.find((v) => {
      const vd = new Date(v.date);
      return vd >= range.start && vd <= range.end && v.status !== "cancelled";
    });

    if (existingToday?.status === "checked_in") {
      return res.status(200).json({
        message: "Already checked in",
        code: "ALREADY_CHECKED_IN",
        visit: existingToday,
        credits: user.credits,
      });
    }

    // Validación previa (UX). La atómica la reforzamos abajo con condiciones también.
    const access = canAccessOrFail(user);
    if (!access.ok) return res.status(403).json({ message: access.message, code: access.code });

    const isTicketera = user.accessType === "ticketera";
    const isMensualidad = user.accessType === "mensualidad";

    const event = {
      at: now,
      action: "CHECK_IN",
      actor,
      meta,
      notes: String(notes || "").slice(0, 400),
    };

    // 2) Caso A: existe visita hoy pero NO checked_in => update atómico esa visita
    if (existingToday?._id) {
      const atomicQuery = {
        ...query,
        visits: {
          $elemMatch: {
            _id: existingToday._id,
            date: { $gte: range.start, $lte: range.end },
            status: { $in: ["registered", "no_show"] }, // solo estas pasan a checked_in
          },
        },
      };

      // Reforzar acceso en el query atómico
      if (isTicketera) atomicQuery.credits = { $gt: 0 };
      if (isMensualidad) atomicQuery["mensualidad.endDate"] = { $gt: now };

      const update = {
        $set: {
          "visits.$[v].status": "checked_in",
          "visits.$[v].checkedInAt": now,
        },
        $push: {
          "visits.$[v].events": event,
        },
      };

      if (notes) update.$set["visits.$[v].notes"] = event.notes;
      if (isTicketera) update.$inc = { credits: -1 };

      const updated = await User.findOneAndUpdate(atomicQuery, update, {
        new: true,
        arrayFilters: [{ "v._id": existingToday._id }],
      }).lean();

      // Si no matcheó, otro request ganó la carrera => responder idempotente
      if (!updated) {
        return res.status(200).json({ message: "Already processed", code: "ALREADY_CHECKED_IN" });
      }

      const newVisit = (updated.visits || []).find((v) => String(v._id) === String(existingToday._id));
      return res.status(200).json({
        message: "Checked in",
        visit: newVisit,
        credits: updated.credits,
      });
    }

    // 3) Caso B: no existe visita hoy => crear visita + (si ticketera) descontar 1, todo atómico
    if (!createIfMissing) {
      return res.status(404).json({ message: "No visit found for this day", code: "VISIT_NOT_FOUND" });
    }

    const visitDoc = {
      date: range.start,
      status: "checked_in",
      createdBy: "admin",
      checkedInAt: now,
      notes: String(notes || "").slice(0, 400),
      events: [
        { at: now, action: "CREATE_VISIT", actor, meta, notes: "Visit created by admin check-in" },
        event,
      ],
    };

    const atomicCreateQuery = {
      ...query,
      visits: {
        $not: {
          $elemMatch: {
            date: { $gte: range.start, $lte: range.end },
            status: { $ne: "cancelled" },
          },
        },
      },
    };

    if (isTicketera) atomicCreateQuery.credits = { $gt: 0 };
    if (isMensualidad) atomicCreateQuery["mensualidad.endDate"] = { $gt: now };

    const createUpdate = { $push: { visits: visitDoc } };
    if (isTicketera) createUpdate.$inc = { credits: -1 };

    const updated = await User.findOneAndUpdate(atomicCreateQuery, createUpdate, { new: true }).lean();

    if (!updated) {
      return res.status(200).json({ message: "Already processed", code: "ALREADY_CHECKED_IN" });
    }

    const lastVisit = (updated.visits || []).slice().sort((a, b) => new Date(b.date) - new Date(a.date))[0];

    return res.status(200).json({
      message: "Checked in (visit created by admin)",
      visit: lastVisit,
      credits: updated.credits,
    });
  } catch (error) {
    console.error("admin checkin error:", error);
    return res.status(500).json({ message: "Failed to check in" });
  }
}