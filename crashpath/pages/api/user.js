import { getToken } from 'next-auth/jwt';
import dbConnect from '../../lib/mongodb';
import User from '../../models/User';

const secret = process.env.NEXTAUTH_SECRET;

export default async function handler(req, res) {
  const token = await getToken({ req, secret });

  if (!token) {
    return res.status(401).json({ message: 'Not authenticated' });
  }

  // Debugging: Log the token to ensure it contains the correct fields
  console.log('Token received:', token);

  // Extract name and email from token.user or token directly
  const { email, name } = token?.user || token;

  if (!email || !name) {
    return res.status(400).json({ message: 'Missing user details' });
  }

  await dbConnect();

  try {
    // Check if the user exists in the database
    let user = await User.findOne({ email });

    if (!user) {
      // If the user does not exist, create a new user
      user = new User({
        email,  // Use extracted email
        name,   // Use extracted name
        credits: 0,                 // Default initial credits
        reservations: [],           // Initialize an empty reservations array
      });

      await user.save();
    }

    // Send back the user data
    res.status(200).json(user);
  } catch (error) {
    // Log the error for debugging
    console.error('Error creating user:', error);
    res.status(500).json({ message: 'Failed to fetch or create the user' });
  }
}
