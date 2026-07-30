import { getToken } from "next-auth/jwt";
import dbConnect from "../../../lib/mongodb";
import MoonReservation from "../../../models/MoonReservation";
import User from "../../../models/User";

const secret = process.env.NEXTAUTH_SECRET;

const OPEN_HOUR = 16;
const CLOSE_HOUR = 22;
const DURATION = 90;
const MAX_DAYS_AHEAD = 7;

function getReqMeta(req) {
  const xf = req.headers["x-forwarded-for"];
  const ip = Array.isArray(xf) ? xf[0] : (xf || "").split(",")[0].trim();
  return { ip: ip || null, userAgent: req.headers["user-agent"] || null };
}

function bogotaDayStart(date) {
  const d = new Date(date);
  const year = d.getUTCFullYear();
  const month = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return new Date(`${year}-${month}-${day}T05:00:00.000Z`);
}

function getCurrentBogotaHour() {
  const now = new Date();
  return now.getUTCHours() - 5 + (now.getUTCHours() < 5 ? 24 : 0);
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ message: "Method not allowed" });

  const token = await getToken({ req, secret });
  if (!token) return res.status(401).json({ message: "Not authenticated" });

  const { date, startHour } = req.body || {};

  // Validaciones básicas
  if (!date || startHour == null) {
    return res.status(400).json({ message: "Faltan date o startHour" });
  }

  const hour = Number(startHour);
  if (!Number.isInteger(hour) || hour < OPEN_HOUR || hour + DURATION / 60 > CLOSE_HOUR) {
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
    return res.status(400).json({ message: "No puedes reservar en el pasado", code: "PAST_DATE" });
  }
  if (requestedDay >= maxDay) {
    return res.status(400).json({ message: "Solo puedes reservar con hasta 7 días de anticipación", code: "TOO_FAR" });
  }

  // Si es hoy, la hora no puede haber pasado
  const isToday = requestedDay.getTime() === todayStart.getTime();
  if (isToday && hour <= getCurrentBogotaHour()) {
    return res.status(400).json({ message: "Esa hora ya pasó", code: "PAST_HOUR" });
  }

  await dbConnect();

  // Verificar que el usuario existe y tiene acceso válido
 const user = await User.findOne({ email: token.email }).lean();
  if (!user) return res.status(404).json({ message: "Usuario no encontrado" });

  if (!user.accessType) {
    return res.status(403).json({ message: "No tienes modalidad de acceso configurada", code: "NO_ACCESS_TYPE" });
  }
  if (user.accessType === "ticketera" && (user.credits ?? 0) <= 0) {
    return res.status(403).json({ message: "Sin créditos disponibles", code: "NO_CREDITS" });
  }
  if (user.accessType === "mensualidad") {
    const end = user.mensualidad?.endDate ? new Date(user.mensualidad.endDate) : null;
    if (!end || new Date() > end) {
      return res.status(403).json({ message: "Mensualidad vencida", code: "MENSUALIDAD_VENCIDA" });
    }
  }

  // Verificar que el usuario no tenga ya una reserva activa futura
  const existing = await MoonReservation.findOne({
    userId: token.sub,
    status: "active",
    date: { $gte: todayStart },
  }).lean();

  if (existing) {
    return res.status(409).json({
      message: "Ya tienes una reserva activa en la moonboard",
      code: "ALREADY_RESERVED",
      reservation: {
        _id: String(existing._id),
        date: bogotaDayStart(existing.date).toISOString().slice(0, 10),
        startHour: existing.startHour,
      },
    });
  }

  // Crear la reserva (el índice único previene race conditions)
  try {
    const reservation = await MoonReservation.create({
      userId: token.sub,
      userEmail: user.email,
      userName: user.name,
      date: requestedDay,
      startHour: hour,
      status: "active",
      createdBy: "user",
      meta: getReqMeta(req),
    });

    return res.status(201).json({
      message: "Reserva creada",
      reservation: {
        _id: String(reservation._id),
        date: requestedDay.toISOString().slice(0, 10),
        startHour: hour,
        label: `${String(hour).padStart(2, "0")}:00 – ${String(hour + 1).padStart(2, "0")}:30`,
      },
    });
  } catch (err) {
    // Error de índice único = slot ya tomado (race condition)
    if (err.code === 11000) {
      return res.status(409).json({ message: "Ese slot ya fue tomado, elige otro", code: "SLOT_TAKEN" });
    }
    console.error("moon reserve error:", err);
    return res.status(500).json({ message: "Error al crear la reserva" });
  }
}