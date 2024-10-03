import { getToken } from 'next-auth/jwt';
import axios from 'axios';

const secret = process.env.NEXTAUTH_SECRET;

export default async function handler(req, res) {
  const token = await getToken({ req, secret });

  // Check if the token contains the necessary access token
  if (!token || !token.accessToken) {
    return res.status(401).json({ error: 'Not authenticated or no access token' });
  }

  const { date, time, title } = req.body;  // Get the event details from the request body

  const eventDate = new Date(`${date}T${time}:00`);

  try {
    // Create an event in the user's Google Calendar
    const response = await axios.post(
      'https://www.googleapis.com/calendar/v3/calendars/primary/events',
      {
        summary: title || 'New Reservation',
        start: {
          dateTime: eventDate.toISOString(),
          timeZone: 'America/Bogota',
        },
        end: {
          dateTime: new Date(eventDate.getTime() + 60 * 60 * 1000).toISOString(),  // Assume 1-hour event
          timeZone: 'America/Bogota',
        },
      },
      {
        headers: {
          Authorization: `Bearer ${token.accessToken}`,  // Pass the access token here
          'Content-Type': 'application/json',
        },
      }
    );

    // Event created successfully
    res.status(200).json({ message: 'Event created successfully', eventId: response.data.id });
  } catch (error) {
    console.error('Error creating Google Calendar event:', error.response ? error.response.data : error.message);
    res.status(500).json({ error: 'Failed to create event' });
  }
}
