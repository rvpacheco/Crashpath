import { useEffect, useState } from 'react';
import { signIn, signOut, useSession } from 'next-auth/react';
import styled from 'styled-components';
import axios from 'axios';
import Calendar from 'react-calendar';
import 'react-calendar/dist/Calendar.css';

const Container = styled.main`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 100vh;
  background-color: #e9eff6;
  padding: 20px;
`;

const Button = styled.button`
  padding: 12px 24px;
  margin: 20px 0;
  background-color: ${(props) => (props.disabled ? '#d3d3d3' : '#007bff')};
  color: white;
  border: none;
  border-radius: 8px;
  cursor: ${(props) => (props.disabled ? 'not-allowed' : 'pointer')};
  font-size: 16px;

  &:hover {
    background-color: ${(props) => (props.disabled ? '#d3d3d3' : '#0056b3')};
  }
`;

const StyledCalendar = styled(Calendar)`
  width: 100%;
  max-width: 400px;
  background-color: white;
  border: none;
  border-radius: 8px;
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
  padding: 10px;

  .react-calendar__tile--busy {
    background-color: #ff6347 !important;
    color: white !important;
    border-radius: 50%;
  }
`;

const TimePicker = styled.select`
  margin-top: 20px;
  padding: 10px;
  border-radius: 5px;
  border: 1px solid #ccc;
  font-size: 16px;
`;

const times = [
  '08:00', '09:00', '10:00', '11:00', '12:00',
  '13:00', '14:00', '15:00', '16:00', '17:00',
];

export default function Home() {
  const { data: session } = useSession();
  const [userData, setUserData] = useState({ credits: 0, reservations: [] });
  const [busySlots, setBusySlots] = useState([]); // Initialize as an empty array
  const [selectedDate, setSelectedDate] = useState(null);
  const [selectedTime, setSelectedTime] = useState(times[0]); // Default to the first time
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (session) {
      axios.get('/api/user').then((response) => {
        setUserData(response.data);
      });

      // Fetch busy slots (reserved dates) from Google Calendar
      axios.get('/api/calendar').then((response) => {
        setBusySlots(response.data.busySlots || []); // Ensure we get an array or fallback to empty array
      });
    }
  }, [session]);

  const handleReservation = async () => {
    if (!selectedDate) {
      setMessage('Por favor seleccione una fecha');
      return;
    }

    try {
      const response = await axios.post('/api/reserve', {
        date: selectedDate,
        time: selectedTime,  // Include time in the reservation
      });

      setMessage(response.data.message);

      // Update user data after reservation
      const updatedUser = await axios.get('/api/user');
      setUserData(updatedUser.data);
    } catch (error) {
      setMessage(error.response.data.message);
    }
  };

  const isDateBusy = (date) => {
    if (!Array.isArray(busySlots)) return false; // Ensure busySlots is an array

    return busySlots.some((slot) => {
      const start = new Date(slot.start);
      const end = new Date(slot.end);
  
      return date >= start && date <= end;
    });
  };

  const tileClassName = ({ date, view }) => {
    if (view === 'month' && isDateBusy(date)) {
      return 'react-calendar__tile--busy';
    }
    return null;
  };

  return (
    <Container>
      {session ? (
        <>
          <h1>Bienvenido, {session.user.name}!</h1>
          <p>TIenes {userData.credits} creditos disponibles .</p>

          <h2>Selecciona una fecha para hacer una reserva:</h2>
          <StyledCalendar
            onClickDay={setSelectedDate}
            tileClassName={tileClassName}  // Use tileClassName for busy dates
          />

          <TimePicker value={selectedTime} onChange={(e) => setSelectedTime(e.target.value)}>
            {times.map((time) => (
              <option key={time} value={time}>{time}</option>
            ))}
          </TimePicker>

          <Button 
            onClick={handleReservation} 
            disabled={!selectedDate || userData.credits <= 0}
          >
            Reserva {selectedDate && `${selectedDate.toLocaleDateString()} a las ${selectedTime}`}
          </Button>

          {message && <p>{message}</p>}

          <h2>Estas son tus reservaciones:</h2>
          <ul>
            {userData.reservations.map((reservation, index) => (
              <li key={index}>
                Reserva Para el dia {new Date(reservation.date).toLocaleDateString()} a las {reservation.time}
              </li>
            ))}
          </ul>

          <Button onClick={() => signOut()}>Cerrar Sesion</Button>
        </>
      ) : (
        <>
          <h1>Bienvenido a la reserva de la Moon de CrashPath</h1>
          <Button onClick={() => signIn('google')}>Inicia sesion con Google</Button>
        </>
      )}
    </Container>
  );
}
