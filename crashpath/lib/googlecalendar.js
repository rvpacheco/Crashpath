// lib/googleCalendar.js
import { JWT } from "google-auth-library";
import axios from "axios";

const SCOPES = ["https://www.googleapis.com/auth/calendar"];

function normalizePrivateKey(raw) {
  if (!raw) return null;

  // 1) quita comillas envolventes si existen
  let k = raw.trim().replace(/^"|"$/g, "").replace(/^'|'$/g, "");

  // 2) convierte \n literales en saltos reales
  k = k.replace(/\\n/g, "\n");

  // 3) (por si viene con \r\n)
  k = k.replace(/\r\n/g, "\n");

  return k;
}

export async function createCalendarEvent({ calendarId, event }) {
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const key = normalizePrivateKey(process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY);

  if (!email || !key) throw new Error("Missing service account env vars");

  const jwt = new JWT({
    email,
    key,
    scopes: SCOPES,
  });

  const { access_token } = await jwt.authorize();

  const url = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(
    calendarId
  )}/events`;

  const resp = await axios.post(url, event, {
    headers: { Authorization: `Bearer ${access_token}` },
  });

  return resp.data;
}
