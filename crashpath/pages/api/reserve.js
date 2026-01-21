import { getToken } from "next-auth/jwt";
import dbConnect from "../../lib/mongodb";
import User from "../../models/User";
import { sendEmail } from "../../lib/sendEmail";
import { DateTime } from "luxon";
import { createCalendarEvent } from "../../lib/googlecalendar";

const secret = process.env.NEXTAUTH_SECRET;
const ZONE = "America/Bogota";

export default async function handler(req, res) {
  const token = await getToken({ req, secret });

  if (!token) return res.status(401).json({ message: "Debes iniciar sesión." });
  if (req.method !== "POST") return res.status(405).json({ message: "Method not allowed" });

  const { date, time, isPrivate, userId } = req.body;
  if (!date || !time) return res.status(400).json({ message: "Missing date or time" });

  await dbConnect();

  const sameDay = (jsDate) => DateTime.fromJSDate(jsDate).setZone(ZONE).toISODate();
  const wantedDay = DateTime.fromISO(date, { zone: ZONE }).toISODate();

  try {
    // ✅ Resolver usuario objetivo
    let targetUser = null;

    if (userId) {
      if (!token.isAdmin) {
        return res.status(403).json({ message: "Forbidden: cannot reserve for another user" });
      }
      targetUser = await User.findById(userId);
    } else {
      targetUser = await User.findOne({ email: token.email });
    }

    if (!targetUser) return res.status(404).json({ message: "User not found" });
    if (targetUser.credits <= 0) return res.status(400).json({ message: "Insufficient credits" });

    // ✅ Cupos / privacidad global
    const existingReservations = await User.find({
      "reservations.date": new Date(date),
      "reservations.time": time,
      "reservations.status": "active",
    });

    const privateReservation = existingReservations.some((u) =>
      u.reservations.some((r) => r.isPrivate)
    );
    if (privateReservation) {
      return res.status(400).json({
        message: "Lo siento, esta franja horaria es privada y no se pueden hacer más reservas.",
      });
    }

    if (existingReservations.length >= 3) {
      return res.status(400).json({ message: "Lo siento, no quedan cupos para esta hora/día" });
    }

    const already = targetUser.reservations.find(
      (r) => sameDay(r.date) === wantedDay && r.time === time && r.status === "active"
    );
    if (already) {
      return res.status(400).json({
        message: "Ese usuario ya tiene una reserva en esa fecha y hora.",
      });
    }

    // ✅ isPrivate solo si el slot está vacío (opcional pero recomendado)
    const canBePrivate = existingReservations.length === 0;
    const privateFlag = canBePrivate ? isPrivate === true : false;

    // ✅ Guardar reserva
    targetUser.reservations.push({
      date: DateTime.fromISO(date, { zone: ZONE }).toJSDate(),
      time,
      status: "active",
      isPrivate: privateFlag,
    });

    targetUser.credits -= 1;
    await targetUser.save();

    // ✅ Crear evento en calendario central (service account)
    const calendarId = String(process.env.CRASHPATH_CALENDAR_ID || "").trim();
    if (!calendarId) {
      return res.status(500).json({ message: "Missing CRASHPATH_CALENDAR_ID env var" });
    }

    const startDateTime = DateTime.fromISO(`${date}T${time}`, { zone: ZONE });
    const endDateTime = startDateTime.plus({ hours: 1, minutes: 30 });

    const event = {
      summary: `CrashPath Moon · Reserva (${targetUser.name || targetUser.email})`,
      description: `Reserva en CrashPath Moon\nUsuario: ${targetUser.name || "N/A"}\nEmail: ${
        targetUser.email
      }\nPrivacidad: ${privateFlag ? "Privada" : "Pública"}`,
      start: { dateTime: startDateTime.toISO(), timeZone: ZONE },
      end: { dateTime: endDateTime.toISO(), timeZone: ZONE },
      attendees: [{ email: targetUser.email }],
      reminders: {
        useDefault: false,
        overrides: [
          { method: "email", minutes: 10 },
          { method: "popup", minutes: 10 },
        ],
      },
    };

    let createdEvent = null;
    try {
      createdEvent = await createCalendarEvent({ calendarId, event });
    } catch (e) {
      console.error("Calendar create error:", e?.response?.data || e?.message || e);
    }

    // ✅ Email interno
    try {
      await sendEmail({
        to: "rvpacheco17@gmail.com, jeevanobando97@gmail.com",
        subject: "Nueva Reserva Realizada",
        text: `Nueva reserva para ${targetUser.name} (${targetUser.email}) el ${date} a las ${time}.`,
      });
    } catch (e) {
      console.error("Email notify error:", e?.message || e);
    }

    return res.status(201).json({
      message: "Reserva creada exitosamente",
      reservedFor: { id: targetUser._id, email: targetUser.email },
      calendarEventId: createdEvent?.id || null,
    });
  } catch (error) {
    console.error("Error creating reservation:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
}
