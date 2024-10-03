import { getToken } from 'next-auth/jwt';
import axios from 'axios';
import dbConnect from '../../lib/mongodb';
import User from '../../models/User';

const secret = process.env.NEXTAUTH_SECRET;
const calendarId = process.env.GOOGLE_CALENDAR_ID;  // Make sure this is set in your .env file

export default async function handler(req, res) {
  const token = await getToken({ req, secret });

  if (!token) {
    return res.status(401).json({ message: 'You must be logged in to make a reservation' });
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  const { date, time } = req.body;

  await dbConnect();

  try {
    // Find the user in the database
    const user = await User.findOne({ email: token.email });

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Check if the user has enough credits
    if (user.credits <= 0) {
      return res.status(400).json({ message: 'Insufficient credits' });
    }

    // Check if the selected time slot is available (not reserved by someone else)
    const conflictingReservation = await User.findOne({
      'reservations.date': new Date(date),
      'reservations.time': time,
      'reservations.status': 'active',
    });

    if (conflictingReservation) {
      return res.status(400).json({ message: 'Time slot already reserved' });
    }

    // Create a new reservation
    user.reservations.push({
      date: new Date(date),
      time: time,
      status: 'active',
    });

    // Deduct one credit from the user
    user.credits -= 1;

    // Save the updated user
    await user.save();

    // --- Google Calendar Event Creation ---
    const startDateTime = new Date(date);
    startDateTime.setHours(parseInt(time.split(':')[0]), parseInt(time.split(':')[1]));

    const endDateTime = new Date(startDateTime);
    endDateTime.setHours(endDateTime.getHours() + 1);  // Assume a 1-hour reservation

    const event = {
      summary: 'Reservation at CrashPath',
      description: 'Your reserved time at CrashPath',
      start: {
        dateTime: startDateTime.toISOString(),
        timeZone: 'America/Bogota',  // Replace with the correct timezone
      },
      end: {
        dateTime: endDateTime.toISOString(),
        timeZone: 'America/Bogota',  // Replace with the correct timezone
      },
      attendees: [{ email: token.email }],
      reminders: {
        useDefault: false,
        overrides: [
          { method: 'email', minutes: 10 },
          { method: 'popup', minutes: 10 },
        ],
      },
    };

    try {
      await axios.post(
        `https://www.googleapis.com/calendar/v3/calendars/${calendarId}/events`,
        event,
        {
          headers: {
            Authorization: `Bearer ${token.accessToken}`,
          },
        }
      );
      console.log('Event created successfully in Google Calendar');
    } catch (error) {
      console.error('Error creating Google Calendar event:', error.response?.data || error);
      return res.status(500).json({ message: 'Failed to create Google Calendar event' });
    }
    // --------------------------------------

    res.status(201).json({ message: 'Reservation created successfully and event added to Google Calendar' });
  } catch (error) {
    console.error('Error creating reservation:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
}
