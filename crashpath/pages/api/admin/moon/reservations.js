import { requireAuth, PERMISOS } from "../../../../lib/authz";
import dbConnect from "../../../../lib/mongodb";
import MoonReservation from "../../../../models/MoonReservation";

export default async function handler(req, res) {
  let actor;
  try {
    actor = await requireAuth(req, res, PERMISOS.MOON);
  } catch {
    return;
  }

  await dbConnect();

  // GET — list active reservations for next 7 days
  if (req.method === "GET") {
    try {
      const now = new Date();
      const bogotaStr = now.toLocaleDateString("en-CA", { timeZone: "America/Bogota" });
      const todayStart = new Date(`${bogotaStr}T05:00:00.000Z`);
      const rangeEnd = new Date(todayStart);
      rangeEnd.setUTCDate(rangeEnd.getUTCDate() + 7);

      const reservations = await MoonReservation.find({
        status: "active",
        date: { $gte: todayStart, $lt: rangeEnd },
      })
        .sort({ date: 1, startHour: 1 })
        .select("userId userEmail userName date startHour status createdAt")
        .lean();

      return res.status(200).json({
        reservations: reservations.map((r) => ({
          _id: String(r._id),
          userId: r.userId,
          userEmail: r.userEmail,
          userName: r.userName,
          date: new Date(r.date).toLocaleDateString("en-CA", { timeZone: "America/Bogota" }),
          startHour: r.startHour,
          status: r.status,
        })),
      });
    } catch (err) {
      console.error("admin/moon/reservations GET error:", err);
      return res.status(500).json({ message: "Error cargando reservas" });
    }
  }

  return res.status(405).json({ message: "Method not allowed" });
}