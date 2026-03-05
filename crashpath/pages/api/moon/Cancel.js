import { getToken } from "next-auth/jwt";
import dbConnect from "../../../lib/mongodb";
import MoonReservation from "../../../models/MoonReservation";

const secret = process.env.NEXTAUTH_SECRET;

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ message: "Method not allowed" });

  const token = await getToken({ req, secret });
  if (!token) return res.status(401).json({ message: "Not authenticated" });

  const { reservationId } = req.body || {};
  if (!reservationId) return res.status(400).json({ message: "Falta reservationId" });

  await dbConnect();

  const reservation = await MoonReservation.findOne({
    _id: reservationId,
    userId: token.sub,
    status: "active",
  });

  if (!reservation) {
    return res.status(404).json({ message: "Reserva no encontrada o ya cancelada", code: "NOT_FOUND" });
  }

  reservation.status = "cancelled";
  reservation.cancelledAt = new Date();
  reservation.cancelledBy = "user";
  await reservation.save();

  return res.status(200).json({ message: "Reserva cancelada" });
}