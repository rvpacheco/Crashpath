import { getToken } from 'next-auth/jwt';
import User from '../../../models/User';

const secret = process.env.NEXTAUTH_SECRET;

export default async function handler(req, res) {
  const token = await getToken({ req, secret });

  if (!token || token.role !== 'admin') {
    return res.status(401).json({ message: 'Unauthorized' });
  }

  const users = await User.find({}).populate('reservations.user');
  const reservations = users.flatMap(user => 
    user.reservations.map(reservation => ({ 
      ...reservation._doc, 
      user 
    }))
  );

  res.status(200).json(reservations);
}
