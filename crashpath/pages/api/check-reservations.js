import dbConnect from '../../lib/mongodb';
import User from '../../models/User';

export default async function handler(req, res) {
  const { date, time } = req.body;

  await dbConnect();

  try {
    const count = await User.countDocuments({
      'reservations.date': new Date(date),
      'reservations.time': time,
      'reservations.status': 'active',
    });

    res.status(200).json({ count });
  } catch (error) {
    res.status(500).json({ message: 'Error checking reservations' });
  }
}
