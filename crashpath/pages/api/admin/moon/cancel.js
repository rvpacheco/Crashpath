import { requireAuth, PERMISOS } from "../../../../lib/authz";
import dbConnect from "../../../../lib/mongodb";
import MoonReservation from "../../../../models/MoonReservation";
import { logAudit } from "../../../../lib/audit";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ message: "Method not allowed" });

  let actor;
  try {
    actor = await requireAuth(req, res, PERMISOS.MOON);
  } catch {
    return;
  }

  const { reservationId } = req.body || {};
  if (!reservationId) return res.status(400).json({ message: "Falta reservationId" });

  try {
    await dbConnect();

    // Admin can cancel ANY active reservation (no userId check)
    const reservation = await MoonReservation.findOne({
      _id: reservationId,
      status: "active",
    });

    if (!reservation) {
      return res.status(404).json({ message: "Reserva no encontrada o ya cancelada", code: "NOT_FOUND" });
    }

    reservation.status = "cancelled";
    reservation.cancelledAt = new Date();
    reservation.cancelledBy = "admin";
    reservation.cancelReason = `Cancelado desde el mostrador: ${actor.email}`;
    await reservation.save();

    const auditEvent = await logAudit({
      action: "MOON_CANCEL",
      actor,
      user: { _id: reservation.userId, email: reservation.userEmail, name: reservation.userName },
      summary: `Reserva moon cancelada (slot ${String(reservation.startHour).padStart(2, "0")}:00)`,
      meta: { reservationId: String(reservation._id), startHour: reservation.startHour },
    });

    return res.status(200).json({ message: "Reserva cancelada", auditEvent });
  } catch (err) {
    console.error("admin/moon/cancel error:", err);
    return res.status(500).json({ message: "Error al cancelar la reserva" });
  }
}