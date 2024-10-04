import dbConnect from '../../../lib/mongodb';
import User from '../../../models/User';
import { isAdminRequest } from '../auth/[...nextauth]';

export default async function handler(req, res) {
  try {
    await isAdminRequest(req, res);

    const { userId, credits } = req.body; // Recibir los créditos del frontend
    
    await dbConnect();
    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({ message: 'Usuario no encontrado' });
    }

    user.credits += credits; // Sumar o restar créditos, según el valor ingresado
    await user.save();

    res.status(200).json({ message: 'Créditos ajustados con éxito' });
  } catch (error) {
    console.error('Error al ajustar créditos:', error);
    res.status(500).json({ message: 'Error al ajustar créditos' });
  }
}
