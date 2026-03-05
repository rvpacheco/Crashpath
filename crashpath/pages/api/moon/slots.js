import { getToken } from "next-auth/jwt";
import dbConnect from "../../../lib/mongodb";
import MoonReservation from "../../../models/MoonReservation";

const secret = process.env.NEXTAUTH_SECRET;

const OPEN_HOUR = 15;
const CLOSE_HOUR = 22;
const DURATION_H = 1.5; // 90 min

function getValidSlots() {
  const slots = [];
  for (let h = OPEN_HOUR; h + DURATION_H <= CLOSE_HOUR; h++) {
    slots.push(h);
  }
  return slots; // [15, 16, 17, 18, 19, 20]
}

/** Devuelve el inicio del día en Bogotá como Date UTC (medianoche Bogotá = 05:00 UTC) */
function bogotaDayStart(dateInput) {
  const d = new Date(dateInput);
  const bogotaStr = d.toLocaleDateString("en-CA", { timeZone: "America/Bogota" });
  return new Date(`${bogotaStr}T05:00:00.000Z`);
}

/** Hora actual en Bogotá (0-23) */
function getBogotaHourNow() {
  const now = new Date();
  const hourStr = now.toLocaleString("en-US", {
    timeZone: "America/Bogota",
    hour: "numeric",
    hour12: false,
  });
  const h = parseInt(hourStr, 10);
  return Number.isNaN(h) ? 0 : h;
}

export default async function handler(req, res) {
  if (req.method !== "GET") return res.status(405).json({ message: "Method not allowed" });

  try {
    const token = await getToken({ req, secret });
    if (!token) return res.status(401).json({ message: "Not authenticated" });

    await dbConnect();

    const now = new Date();
    const todayStart = bogotaDayStart(now);
    const bogotaHourNow = getBogotaHourNow();
    const validSlots = getValidSlots();

    // Construir los 7 días
    const days = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(todayStart);
      d.setUTCDate(d.getUTCDate() + i);
      days.push(d);
    }

    const rangeEnd = new Date(days[days.length - 1]);
    rangeEnd.setUTCDate(rangeEnd.getUTCDate() + 1);

    // Reservas activas en el rango
    const reservations = await MoonReservation.find({
      date: { $gte: days[0], $lt: rangeEnd },
      status: "active",
    })
      .select("date startHour userId userName")
      .lean();

    // Reserva activa del usuario actual
    const myReservation = await MoonReservation.findOne({
      userId: token.sub,
      status: "active",
      date: { $gte: todayStart },
    })
      .select("date startHour _id")
      .lean();

    const result = days.map((dayStart) => {
      const dateStr = dayStart.toLocaleDateString("en-CA", { timeZone: "America/Bogota" });
      const isToday = dayStart.getTime() === todayStart.getTime();

      const slots = validSlots.map((hour) => {
        const taken = reservations.find((r) => {
          const rDay = bogotaDayStart(r.date);
          return rDay.getTime() === dayStart.getTime() && r.startHour === hour;
        });

        const isPast = isToday && hour <= bogotaHourNow;

        const isMySlot =
          !!myReservation &&
          bogotaDayStart(myReservation.date).getTime() === dayStart.getTime() &&
          myReservation.startHour === hour;

        return {
          hour,
          label: `${String(hour).padStart(2, "0")}:00 – ${String(hour + 1).padStart(2, "0")}:30`,
          available: !taken && !isPast,
          taken: !!taken && !isMySlot,
          isPast,
          isMySlot,
          takenBy:
            taken && !isMySlot
              ? { name: taken.userName || "Alguien" }
              : null,
          reservationId: isMySlot ? String(myReservation._id) : null,
        };
      });

      return { date: dateStr, isToday, slots };
    });

    return res.status(200).json({
      days: result,
      myReservation: myReservation
        ? {
            _id: String(myReservation._id),
            date: bogotaDayStart(myReservation.date).toLocaleDateString("en-CA", {
              timeZone: "America/Bogota",
            }),
            startHour: myReservation.startHour,
          }
        : null,
    });
  } catch (error) {
    console.error("moon/slots error:", error);
    return res.status(500).json({ message: "Error cargando slots" });
  }
}