import { getToken } from 'next-auth/jwt';
import axios from 'axios';
import dbConnect from '../../lib/mongodb';
import User from '../../models/User';
import { sendEmail } from '../../lib/sendEmail';

const secret = process.env.NEXTAUTH_SECRET;

export default async function handler(req, res) {
  const token = await getToken({ req, secret });

  if (!token) {
    return res.status(401).json({ message: 'You must be logged in to make a reservation' });
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  const { date, time, isPrivate } = req.body;  // Nos aseguramos de recibir isPrivate correctamente

  await dbConnect();

  try {
    const user = await User.findOne({ email: token.email });

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    if (user.credits <= 0) {
      return res.status(400).json({ message: 'Insufficient credits' });
    }

    // Verificar si ya existe una reserva privada o si hay 4 reservas en ese horario
    const existingReservations = await User.find({
      'reservations.date': new Date(date),
      'reservations.time': time,
      'reservations.status': 'active',
    });

    // Si ya hay una reserva privada en ese horario, no permitir más reservas
    const privateReservation = existingReservations.some(user =>
      user.reservations.some(res => res.isPrivate)
    );

    if (privateReservation) {
      return res.status(400).json({ message: 'Lo siento, esta franja horaria es privada y no se pueden hacer más reservas.' });
    }

    // Si ya hay 4 reservas (públicas), rechazar la reserva
    if (existingReservations.length >= 3) {
      return res.status(400).json({ message: 'Lo siento, no quedan cupos para esta hora/día' });
    }

    // Verificar si el usuario ya tiene una reserva activa en el mismo horario
    const userAlreadyHasReservation = user.reservations.find(res =>
      res.date.toISOString() === new Date(date).toISOString() && res.time === time && res.status === 'active'
    );

    if (userAlreadyHasReservation) {
      return res.status(400).json({ message: 'Ya tienes una reserva en esta fecha y hora.' });
    }

    // **Corregir aquí:** Agregar la nueva reserva con el valor correcto de isPrivate
    user.reservations.push({
      date: new Date(date),
      time: time,
      status: 'active',
      isPrivate: isPrivate === true ? true : false,  // Asegurarse de que se envíe como `true` o `false`
    });

    user.credits -= 1;
    await user.save();

    const startDateTime = new Date(date);
    const [hours, minutes] = time.split(':');
startDateTime.setHours(parseInt(hours), parseInt(minutes));

const endDateTime = new Date(startDateTime.getTime() + 60 * 60 * 1000);  // Añade 1 hora

    // Crear el evento en el calendario del usuario autenticado
    const event = {
      summary: 'Reserva para Crashpath',
      description: 'Your reserved time at CrashPath',
      start: {
        dateTime: startDateTime.toISOString(),
        timeZone: 'America/Bogota',
      },
      end: {
        dateTime: endDateTime.toISOString(),
        timeZone: 'America/Bogota',
      },
      attendees: [
        { email: token.email },  // Usuario que hace la reserva
        { email: process.env.GOOGLE_CALENDAR_ID },  // Calendario de la app como invitado
      ],
      reminders: {
        useDefault: false,
        overrides: [
          { method: 'email', minutes: 10 },
          { method: 'popup', minutes: 10 },
        ],
      },
    };

    try {
      // Crear el evento en el calendario del usuario
      await axios.post(
        `https://www.googleapis.com/calendar/v3/calendars/primary/events`,  // Usar "primary" para el calendario del usuario
        event,
        {
          headers: {
            Authorization: `Bearer ${token.accessToken}`,
          },
        }
      );
      console.log('Event created successfully in user\'s Google Calendar');
    } catch (error) {
      console.error('Error creating Google Calendar event:', error.response?.data || error);
      return res.status(500).json({ message: 'Failed to create Google Calendar event' });
    }

    // Envío de correo electrónico
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
