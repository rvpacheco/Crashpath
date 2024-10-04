import dbConnect from '../../../lib/mongodb';
import User from '../../../models/User';
import { isAdminRequest } from '../auth/[...nextauth]';

export default async function handler(req, res) {
  try {
    // Verifica si el usuario es administrador
    await isAdminRequest(req, res);

    // Conectar a la base de datos
    await dbConnect();

    // Buscar todos los usuarios en la base de datos
    const users = await User.find({});

    // Responder con la lista de usuarios
    res.status(200).json({ users });
  } catch (error) {
    console.error('Error fetching users:', error.message);
    res.status(500).json({ message: 'Error al obtener usuarios' });
  }
}
