import dbConnect from '../../../lib/mongodb';
import User from '../../../models/User';
import { isAdminRequest } from '../auth/[...nextauth]';

export default async function handler(req, res) {
  await isAdminRequest(req, res);  // Verifica si el usuario es admin

  const { userId, reservationId } = req.body;

  await dbConnect();
  const user = await User.findById(userId);
  user.reservations = user.reservations.filter(reservation => reservation._id != reservationId);
  await user.save();

  const users = await User.find({});
  res.status(200).json(users);
}
