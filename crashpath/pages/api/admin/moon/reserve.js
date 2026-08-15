import { requireAuth, PERMISOS } from "../../../../lib/authz";
import dbConnect from "../../../../lib/mongodb";
import MoonReservation from "../../../../models/MoonReservation";
import User from "../../../../models/User";
import { logAudit } from "../../../../lib/audit";

const OPEN_HOUR = 16;
const CLOSE_HOUR = 22;
const DURATION_H = 1.5;
const MAX_DAYS_AHEAD = 7;

function bogotaDayStart(dateInput) {
  const d = new Date(dateInput);
  const bogotaStr = d.toLocaleDateString("en-CA", { timeZone: "America/Bogota" });
  return new Date(`${bogotaStr}T05:00:00.000Z`);
}

function getReqMeta(req) {
  const xf = req.headers["x-forwarded-for"];
  const ip = Array.isArray(xf) ? xf[0] : (xf || "").split(",")[0].trim();
  return { ip: ip || null, userAgent: req.headers["user-agent"] || null };
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ message: "Method not allowed" });

  let actor;
  try {
    actor = await requireAuth(req, res, PERMISOS.MOON);
  } catch {
    return;
  }

  const { userId, userEmail, userName, date, startHour } = req.body || {};

  if (!userId && !userEmail) return res.status(400).json({ message: "Falta userId o userEmail" });
  if (!date || startHour == null) return res.status(400).json({ message: "Faltan date o startHour" });

  const hour = Number(startHour);
  if (!Number.isInteger(hour) || hour < OPEN_HOUR || hour + DURATION_H > CLOSE_HOUR) {
    return res.status(400).json({ message: "Hora inválida", code: "INVALID_HOUR" });
  }

  const requestedDay = bogotaDayStart(new Date(date));
  if (Number.isNaN(requestedDay.getTime())) {
    return res.status(400).json({ message: "Fecha inválida" });
  }

  const todayStart = bogotaDayStart(new Date());
  const maxDay = new Date(todayStart);
  maxDay.setUTCDate(maxDay.getUTCDate() + MAX_DAYS_AHEAD);

  if (requestedDay < todayStart) {
    return res.status(400).json({ message: "No se puede reservar en el pasado", code: "PAST_DATE" });
  }
  if (requestedDay >= maxDay) {
    return res.status(400).json({ message: "Máximo 7 días de anticipación", code: "TOO_FAR" });
  }

  try {
    await dbConnect();

    // Resolve user info
    let resolvedUserId = userId;
    let resolvedEmail = userEmail;
    let resolvedName = userName;

    if (userId) {
      const user = await User.findById(userId).select("email name").lean();
      if (user) {
        resolvedEmail = user.email;
        resolvedName = user.name;
      }
    }

    // Check if user already has an active reservation
    const existing = await MoonReservation.findOne({
      userId: String(resolvedUserId),
      status: "active",
      date: { $gte: todayStart },
    }).lean();

    if (existing) {
      return res.status(409).json({
        message: "Este usuario ya tiene una reserva activa en la moonboard",
        code: "ALREADY_RESERVED",
        reservation: {
          _id: String(existing._id),
          date: bogotaDayStart(existing.date).toLocaleDateString("en-CA", { timeZone: "America/Bogota" }),
          startHour: existing.startHour,
        },
      });
    }

    const reservation = await MoonReservation.create({
      userId: String(resolvedUserId),
      userEmail: resolvedEmail,
      userName: resolvedName,
      date: requestedDay,
      startHour: hour,
      status: "active",
      createdBy: "admin",
      meta: getReqMeta(req),
    });

    const dateStr = requestedDay.toLocaleDateString("en-CA", { timeZone: "America/Bogota" });
    const auditEvent = await logAudit({
      action: "MOON_RESERVE",
      actor,
      user: { _id: resolvedUserId, email: resolvedEmail, name: resolvedName },
      summary: `Reserva moon creada: ${dateStr} ${String(hour).padStart(2, "0")}:00`,
      meta: { reservationId: String(reservation._id), date: dateStr, startHour: hour },
    });

    return res.status(201).json({
      message: "Reserva creada",
      reservation: {
        _id: String(reservation._id),
        date: dateStr,
        startHour: hour,
        label: `${String(hour).padStart(2, "0")}:00 – ${String(hour + 1).padStart(2, "0")}:30`,
      },
      auditEvent,
    });
  } catch (err) {
    if (err.code === 11000) {
      return res.status(409).json({ message: "Ese slot ya fue tomado, elige otro", code: "SLOT_TAKEN" });
    }
    console.error("admin/moon/reserve error:", err);
    return res.status(500).json({ message: "Error al crear la reserva" });
  }
}