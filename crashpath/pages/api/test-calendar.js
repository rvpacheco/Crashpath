import { createCalendarEvent } from "@/lib/googlecalendar";
import { DateTime } from "luxon";

export default async function handler(req, res) {
  try {
    const calendarId = String(process.env.CRASHPATH_CALENDAR_ID || "").trim();

    const start = DateTime.now().setZone("America/Bogota").plus({ minutes: 10 });
    const end = start.plus({ minutes: 30 });

    const event = {
      summary: "TEST – CrashPath Calendar Bot",
      start: { dateTime: start.toISO(), timeZone: "America/Bogota" },
      end: { dateTime: end.toISO(), timeZone: "America/Bogota" },
    };

    const created = await createCalendarEvent({ calendarId, event });

    res.status(200).json({
      ok: true,
      calendarId,
      eventId: created.id,
    });
  } catch (e) {
    console.error(e?.response?.data || e);
    res.status(500).json({
      ok: false,
      message: e.message,
      details: e?.response?.data || null,
    });
  }
}
