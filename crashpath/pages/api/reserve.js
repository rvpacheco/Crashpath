import { getToken } from 'next-auth/jwt';
import axios from 'axios';
import dbConnect from '../../lib/mongodb';
import User from '../../models/User';
import { sendEmail } from '../../lib/sendEmail';
import { DateTime } from 'luxon';

const secret = process.env.NEXTAUTH_SECRET;

export default async function handler(req, res) {
  const token = await getToken({ req, secret });

  if (!token) {
    return res.status(401).json({ message: 'You must be logged in to make a reservation' });
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  const { date, time, isPrivate } = req.body;

  await dbConnect();

  try {
    const user = await User.findOne({ email: token.email });

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    if (user.credits <= 0) {
      return res.status(400).json({ message: 'Insufficient credits' });
    }

    const existingReservations = await User.find({
      'reservations.date': new Date(date),
      'reservations.time': time,
      'reservations.status': 'active',
    });

    const privateReservation = existingReservations.some(user =>
      user.reservations.some(res => res.isPrivate)
    );

    if (privateReservation) {
      return res.status(400).json({ message: 'Lo siento, esta franja horaria es privada y no se pueden hacer más reservas.' });
    }

    if (existingReservations.length >= 3) {
      return res.status(400).json({ message: 'Lo siento, no quedan cupos para esta hora/día' });
    }

    const userAlreadyHasReservation = user.reservations.find(res =>
      res.date.toISOString() === new Date(date).toISOString() && res.time === time && res.status === 'active'
    );

    if (userAlreadyHasReservation) {
      return res.status(400).json({ message: 'Ya tienes una reserva en esta fecha y hora.' });
    }

    // Agrega la nueva reserva
    user.reservations.push({
      date: DateTime.fromISO(date, { zone: 'America/Bogota' }).toJSDate(),
      time: time,
      status: 'active',
      isPrivate: isPrivate === true ? true : false,
    });

    user.credits -= 1;
    await user.save();

    // Ajuste para manejar la zona horaria y la hora correctamente
    const startDateTime = DateTime.fromISO(`${date}T${time}`, { zone: 'America/Bogota' }); // Mantener como objeto DateTime
    const endDateTime = startDateTime.plus({ hours: 1, minutes: 30 }); // Sumar 1 hora y 30 minutos

    // Convertir a ISO antes de pasarlo al evento
    const event = {
      summary: 'Reserva para Crashpath',
      description: 'Your reserved time at CrashPath',
      start: {
        dateTime: startDateTime.toISO(),  // Convertir a ISO
        timeZone: 'America/Bogota',
      },
      end: {
        dateTime: endDateTime.toISO(),    // Convertir a ISO
        timeZone: 'America/Bogota',
      },
      attendees: [
        { email: token.email },
        { email: process.env.GOOGLE_CALENDAR_ID },
      ],
      reminders: {
        useDefault: false,
        overrides: [
          { method: 'email', minutes: 10 },
          { method: 'popup', minutes: 10 },
        ],
      },
    };

    // Crear el evento en Google Calendar
    try {
      const response = await axios.post(
        `https://www.googleapis.com/calendar/v3/calendars/primary/events`,
        event,
        {
          headers: {
            Authorization: `Bearer ${token.accessToken}`,
          },
        }
      );
      console.log('Event created successfully in user\'s Google Calendar', response.data);
    } catch (error) {
      console.error('Error creating Google Calendar event:', error.response?.data || error.message);
      return res.status(500).json({
        message: 'Failed to create Google Calendar event',
        error: error.response?.data || error.message,
      });
    }

    // Enviar correo electrónico de confirmación
    try {
      await sendEmail({
        to: 'rvpacheco17@gmail.com, jeevanobando97@gmail.com',
        subject: 'Nueva Reserva Realizada',
        text: `Una nueva reserva ha sido realizada por ${user.name} (${token.email}) para la fecha: ${date} a las ${time}.`,
      });
      console.log('Correo enviado correctamente a rvpacheco17@gmail.com');
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
