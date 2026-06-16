// pages/api/admin/visits/register.js
import { getToken } from "next-auth/jwt";
import dbConnect from "../../../../lib/mongodb";
import User from "../../../../models/User";
import { logAudit } from "../../../../lib/audit";

const secret = process.env.NEXTAUTH_SECRET;

function startOfTodayLocal() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}
function endOfTodayLocal() {
  const d = new Date();
  d.setHours(23, 59, 59, 999);
  return d;
}

function isProfileComplete(u) {
  const dt = String(u?.documentType || "").trim();
  const dn = String(u?.documentNumber || "").trim();
  const phone = String(u?.phone || "").trim();
  const epsName = String(u?.epsName || "").trim();
  const ecn = String(u?.emergencyContactName || "").trim();
  const ecp = String(u?.emergencyContactPhone || "").trim();
  return !!(dt && dn && phone && epsName && ecn && ecp);
}

function isMensualidadActiva(m) {
  if (!m?.endDate) return false;
  const end = new Date(m.endDate);
  const now = new Date();
  return end > now;
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ message: "Method not allowed" });

  const token = await getToken({ req, secret });
  if (!token) return res.status(401).json({ message: "Not authenticated" });
  if (!token?.isAdmin) return res.status(403).json({ message: "Forbidden" });

  const userId = String(req.body?.userId || "").trim();
  if (!userId) return res.status(400).json({ message: "Missing userId" });

  await dbConnect();

  try {
    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ message: "User not found" });

    if (!user.accessType) {
      return res.status(400).json({
        message: "Missing accessType (ticketera o mensualidad)",
        code: "ACCESS_TYPE_REQUIRED",
      });
    }

    if (user.waiverStatus !== "signed") {
      return res.status(400).json({
        message: "Waiver required",
        code: "WAIVER_REQUIRED",
      });
    }

    if (!isProfileComplete(user)) {
      return res.status(400).json({
        message: "Profile incomplete",
        code: "PROFILE_INCOMPLETE",
      });
    }

    if (user.accessType === "mensualidad" && !isMensualidadActiva(user.mensualidad)) {
      return res.status(400).json({
        message: "Mensualidad inactive",
        code: "MENSUALIDAD_INACTIVE",
      });
    }

    if (user.accessType === "ticketera" && (user.credits ?? 0) < 1) {
      return res.status(400).json({
        message: "Insufficient credits",
        code: "INSUFFICIENT_CREDITS",
      });
    }

    const start = startOfTodayLocal();
    const end = endOfTodayLocal();

    const todaysVisit = (user.visits || []).find((v) => {
      const d = v?.date ? new Date(v.date) : null;
      if (!d || Number.isNaN(d.getTime())) return false;
      if (d < start || d > end) return false;
      return String(v.status || "").toLowerCase() !== "cancelled";
    });

    if (todaysVisit) {
      return res.status(409).json({
        message: "Visit already exists for today",
        code: "VISIT_ALREADY_EXISTS",
        visit: todaysVisit,
      });
    }

    const now = new Date();

    user.visits = user.visits || [];
    user.visits.push({
      date: now,
      status: "registered",
      createdBy: "admin",
      notes: "Registrada por admin",
    });

    if (user.accessType === "ticketera") {
      user.credits = Math.max(0, (user.credits ?? 0) - 1);
    }

    user.lastVisitAt = now;
    user.lastCheckinAt = now;

    await user.save();

    const auditEvent = await logAudit({
      action: "VISIT_REGISTER",
      actor: { email: token?.email, name: token?.name, id: token?.sub },
      user,
      summary: `Visita registrada (${user.accessType})${user.accessType === "ticketera" ? ` -1 crédito, quedan ${user.credits ?? 0}` : ""}`,
      meta: { accessType: user.accessType, credits: user.credits ?? 0 },
    });

    return res.status(200).json({
      message:
        user.accessType === "ticketera"
          ? "Visit registered (admin) - ticketera"
          : "Visit registered (admin) - mensualidad",
      credits: user.credits ?? 0,
      accessType: user.accessType,
      user,
      auditEvent,
    });
  } catch (err) {
    console.error("admin visits register error:", err);
    return res.status(500).json({ message: "Failed to register visit" });
  }
}