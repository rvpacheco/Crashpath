import { getToken } from 'next-auth/jwt';
import axios from 'axios';
import dbConnect from '../../lib/mongodb';
import User from '../../models/User';
import { sendEmail } from '../../lib/sendEmail'; // Usamos la función sendEmail actualizada

const secret = process.env.NEXTAUTH_SECRET;
const calendarId = process.env.GOOGLE_CALENDAR_ID;

// Función para formatear la fecha a DD/MM/AAAA
function formatDateToDDMMYYYY(date) {
  const day = (`0${date.getDate()}`).slice(-2); // Obtiene el día y añade cero si es menor a 10
  const month = (`0${date.getMonth() + 1}`).slice(-2); // Los meses empiezan en 0, por eso sumamos 1
  const year = date.getFullYear();
  return `${day}/${month}/${year}`;
}

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
    const user = await User.findOne({ email: token.email });

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    if (user.credits <= 0) {
      return res.status(400).json({ message: 'Insufficient credits' });
    }

    const conflictingReservation = await User.findOne({
      'reservations.date': new Date(date),
      'reservations.time': time,
      'reservations.status': 'active',
    });

    if (conflictingReservation) {
      return res.status(400).json({ message: 'Tiempo ya reservado' });
    }

    user.reservations.push({
      date: new Date(date),
      time: time,
      status: 'active',
    });

    user.credits -= 1;
    await user.save();

    const startDateTime = new Date(date);
    startDateTime.setHours(parseInt(time.split(':')[0]), parseInt(time.split(':')[1]));

    const endDateTime = new Date(startDateTime);
    endDateTime.setHours(endDateTime.getHours() + 1);

    const event = {
      summary: 'Reservation at CrashPath',
      description: 'Your reserved time at CrashPath',
      start: {
        dateTime: startDateTime.toISOString(),
        timeZone: 'America/Bogota',
      },
      end: {
        dateTime: endDateTime.toISOString(),
        timeZone: 'America/Bogota',
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

    // Convertir la fecha a DD/MM/AAAA
    const formattedDate = formatDateToDDMMYYYY(new Date(date));

    // Envío de correo electrónico a rvpacheco17@gmail.com
    try {
      await sendEmail({
        to: 'jeevanobando97@gmail.com',
        subject: 'Nueva Reserva Realizada',
        text: `Una nueva reserva ha sido realizada por ${user.name} (${token.email}) para la fecha: ${formattedDate} a las ${time}.`,
      });
      console.log('Correo enviado correctamente a jeevanobando97@gmail.com');
    } catch (error) {
      console.error('Error enviando correo electrónico:', error);
      return res.status(500).json({ message: 'Failed to send email notification' });
    }

    res.status(201).json({ message: 'Reserva creada exitosamente y evento agregado a Google Calendar' });
  } catch (error) {
    console.error('Error creating reservation:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
}
