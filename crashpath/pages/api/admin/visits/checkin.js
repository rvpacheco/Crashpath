import { getToken } from "next-auth/jwt";
import dbConnect from "../../../../lib/mongodb";
import User from "../../../../models/User";

const secret = process.env.NEXTAUTH_SECRET;

function normalizeDayRange(dateLike) {
  const d = dateLike ? new Date(dateLike) : new Date();
  if (Number.isNaN(d.getTime())) return null;

  const start = new Date(d);
  start.setHours(0, 0, 0, 0);

  const end = new Date(d);
  end.setHours(23, 59, 59, 999);

  return { start, end };
}

/**
 * POST /api/admin/visits/checkin  —  FLOW B
 *
 * Body:
 * {
 *   userId?: string,
 *   email?: string,
 *   date?: string (ISO) // opcional, default hoy
 *   createIfMissing?: boolean, // default true
 *   notes?: string
 * }
 *
 * ⚠️ IMPORTANTE: aquí NO se descuentan créditos.
 */
export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ message: "Method not allowed" });
  }

  const token = await getToken({ req, secret });
  if (!token) {
    return res.status(401).json({ message: "Not authenticated" });
  }

  // Usamos tu flag de admin de NextAuth
  if (!token.isAdmin) {
    return res.status(403).json({ message: "Admin only" });
  }

  const {
    userId,
    email,
    date,
    createIfMissing = true,
    notes = "",
  } = req.body || {};

  if (!userId && !email) {
    return res.status(400).json({ message: "Provide userId or email" });
  }

  const range = normalizeDayRange(date);
  if (!range) {
    return res.status(400).json({ message: "Invalid date" });
  }

  await dbConnect();

  try {
    // 1) Buscar usuario
    const query = userId ? { _id: userId } : { email };
    const user = await User.findOne(query);

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const visits = user.visits || [];

    // 2) Buscar visita del día
    const idx = visits.findIndex((v) => {
      const d = new Date(v.date);
      return d >= range.start && d <= range.end && v.status !== "cancelled";
    });

    // ===== CASO A: YA EXISTE VISITA DEL DÍA =====
    if (idx !== -1) {
      const existing = visits[idx];

      // Si ya estaba checked_in, no hacemos nada
      if (existing.status === "checked_in") {
        return res.status(200).json({
          message: "Already checked in",
          user,
          visit: existing,
        });
      }

      // Marcar check-in
      existing.status = "checked_in";
      existing.checkedInAt = new Date();
      existing.notes = notes || existing.notes;

      await user.save();

      return res.status(200).json({
        message: "Checked in",
        user,
        visit: existing,
      });
    }

    // ===== CASO B: NO EXISTE VISITA DEL DÍA =====
    if (!createIfMissing) {
      return res.status(404).json({
        message: "No visit found for this day",
        code: "VISIT_NOT_FOUND",
      });
    }

    // Creamos visita ADMIN sin tocar créditos
    const visitDoc = {
      date: range.start,
      status: "checked_in",
      createdBy: "admin",
      checkedInAt: new Date(),
      notes,
    };

    user.visits = [...visits, visitDoc];
    await user.save();

    return res.status(200).json({
      message: "Checked in (visit created by admin)",
      user,
      visit: visitDoc,
    });
  } catch (error) {
    console.error("admin checkin error:", error);
    return res.status(500).json({ message: "Failed to check in" });
  }
}
