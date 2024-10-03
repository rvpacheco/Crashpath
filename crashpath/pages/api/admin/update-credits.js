import { getToken } from 'next-auth/jwt';
import User from '../../../models/User';

const secret = process.env.NEXTAUTH_SECRET;

export default async function handler(req, res) {
  const token = await getToken({ req, secret });

  if (!token || token.role !== 'admin') {
    return res.status(401).json({ message: 'Unauthorized' });
  }

  const { userId, credits } = req.body;
  await User.findByIdAndUpdate(userId, { credits });
  
  res.status(200).json({ message: 'Credits updated' });
}
