import dbConnect from '../../lib/mongodb';
import User from '../../models/User';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  const { date, time } = req.body;

  if (!date || !time) {
    return res.status(400).json({ message: 'Date and time are required' });
  }

  await dbConnect();

  try {
    // Buscar si ya hay reservas activas en la misma fecha y hora
    const existingReservations = await User.find({
      'reservations.date': new Date(date),
      'reservations.time': time,
      'reservations.status': 'active',
    });

    // Si no hay ninguna reserva, se devuelve true indicando que es la primera reserva
    const isFirstReservation = existingReservations.length === 0;

    return res.status(200).json({ isFirstReservation });
  } catch (error) {
    console.error('Error checking first reservation:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
}
