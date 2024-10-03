import { useSession, signOut } from 'next-auth/react';
import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';
import axios from 'axios';

export default function AdminPanel() {
  const { data: session } = useSession();
  const router = useRouter();
  const [users, setUsers] = useState([]);
  const [reservations, setReservations] = useState([]);

  useEffect(() => {
    // Redirect if not logged in or not an admin
    if (!session) {
      router.push('/');
    } else if (session.user.role !== 'admin') {
      router.push('/');
    } else {
      // Fetch all users and reservations if admin
      axios.get('/api/admin/users').then((response) => setUsers(response.data));
      axios.get('/api/admin/reservations').then((response) => setReservations(response.data));
    }
  }, [session]);

  const updateUserCredits = async (userId, credits) => {
    await axios.post('/api/admin/update-credits', { userId, credits });
    // Refetch data after update
    axios.get('/api/admin/users').then((response) => setUsers(response.data));
  };

  const updateReservation = async (reservationId, date, time) => {
    await axios.post('/api/admin/update-reservation', { reservationId, date, time });
    // Refetch data after update
    axios.get('/api/admin/reservations').then((response) => setReservations(response.data));
  };

  const deleteReservation = async (reservationId) => {
    await axios.post('/api/admin/delete-reservation', { reservationId });
    // Refetch data after deletion
    axios.get('/api/admin/reservations').then((response) => setReservations(response.data));
  };

  if (!session || session.user.role !== 'admin') {
    return <div>Loading...</div>;
  }

  return (
    <div>
      <h1>Admin Panel</h1>
      <h2>All Users</h2>
      <ul>
        {users.map(user => (
          <li key={user._id}>
            {user.name} ({user.email}) - {user.credits} credits 
            <button onClick={() => updateUserCredits(user._id, prompt('New credits:'))}>Edit Credits</button>
          </li>
        ))}
      </ul>

      <h2>All Reservations</h2>
      <ul>
        {reservations.map(reservation => (
          <li key={reservation._id}>
            {reservation.user.name} reserved on {new Date(reservation.date).toLocaleDateString()} at {reservation.time}
            <button onClick={() => updateReservation(reservation._id, prompt('New date:'), prompt('New time:'))}>Edit</button>
            <button onClick={() => deleteReservation(reservation._id)}>Delete</button>
          </li>
        ))}
      </ul>

      <button onClick={() => signOut()}>Sign Out</button>
    </div>
  );
}
