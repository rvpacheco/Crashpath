import dbConnect from '../../../lib/mongodb';
import User from '../../../models/User';
import { isAdminRequest } from '../auth/[...nextauth]';

export default async function handler(req, res) {
  try {
    await isAdminRequest(req, res); // Verifica si el usuario es admin

    const { userId, reservationId } = req.body;
    
    await dbConnect();
    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({ message: 'Usuario no encontrado' });
    }

    user.reservations = user.reservations.filter((reservation) => reservation._id.toString() !== reservationId);
    await user.save();

    res.status(200).json({ message: 'Reserva eliminada con éxito' });
  } catch (error) {
    console.error('Error removing reservation:', error);
    res.status(500).json({ message: 'Error al eliminar reserva' });
  }
}
