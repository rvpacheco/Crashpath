// pages/api/admin/visits/register.js
import { getToken } from "next-auth/jwt";
import dbConnect from "../../../../lib/mongodb";
import User from "../../../../models/User";

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

/**
 * POST /api/admin/visits/register
 * Body:
 *  - userId: string (required)
 *
 * Crea visita de HOY:
 * - createdBy:"admin"
 * - status:"registered"
 * - descuenta 1 crédito
 *
 * Reglas:
 * - solo admin
 * - requiere credits >= 1
 * - no duplica visita HOY (si ya hay una no cancelled)
 */
export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ message: "Method not allowed" });

  const token = await getToken({ req, secret });
  if (!token) return res.status(401).json({ message: "Not authenticated" });

  // ✅ admin gate (ajusta si tu token/admin flag se llama distinto)
  if (!token?.isAdmin) return res.status(403).json({ message: "Forbidden" });

  const userId = String(req.body?.userId || "").trim();
  if (!userId) return res.status(400).json({ message: "Missing userId" });

  await dbConnect();

  try {
    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ message: "User not found" });

    if ((user.credits ?? 0) < 1) {
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

    // ✅ crear visita de hoy
    user.visits = user.visits || [];
    user.visits.push({
      date: start, // normalizado a startOfDay
      status: "registered",
      createdBy: "admin",
      notes: "Registrada por admin",
    });

    // ✅ descuenta 1 crédito
    user.credits = Math.max(0, (user.credits ?? 0) - 1);

    await user.save();

    return res.status(200).json({
      message: "Visit registered (admin)",
      user,
    });
  } catch (err) {
    console.error("admin visits register error:", err);
    return res.status(500).json({ message: "Failed to register visit" });
  }
}
