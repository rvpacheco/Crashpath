import { useEffect, useState } from 'react';
import { signIn, signOut, useSession } from 'next-auth/react';
import styled from 'styled-components';
import axios from 'axios';
import Calendar from 'react-calendar';
import 'react-calendar/dist/Calendar.css';
import { useRouter } from 'next/router';

const Container = styled.main`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 100vh;
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

const TimePicker = styled.select`
  margin-top: 20px;
  padding: 10px;
  border-radius: 5px;
  border: 1px solid #ccc;
  font-size: 16px;
`;
const ModalOverlay = styled.div`
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  background-color: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
`;
const ModalContent = styled.div`
  background-color: white;
  padding: 20px;
  border-radius: 8px;
  text-align: center;
  max-width: 500px;
  width: 100%;
`;

const ModalButton = styled(Button)`
  margin: 10px;
  background-color: ${(props) => (props.danger ? '#dc3545' : '#28a745')};
  &:hover {
    background-color: ${(props) => (props.danger ? '#c82333' : '#218838')};
  }
`;

// Define los horarios desde las 9 AM hasta las 7 PM
const times = [
  '07:00','08:00','09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00', '17:00', '18:00', '19:00', '20:00'
];

export default function Home() {
  const { data: session } = useSession();
  const [userData, setUserData] = useState({ credits: 0, reservations: [] });
  const [busySlots, setBusySlots] = useState([]);
  const [selectedDate, setSelectedDate] = useState(null);
  const [selectedTime, setSelectedTime] = useState(times[0]); // Predeterminado a la primera hora (9:00 AM)
  const [message, setMessage] = useState('');
  const [showConsentModal, setShowConsentModal] = useState(false); 
  const router = useRouter();

  useEffect(() => {
    if (session) {
      
      if (session.isAdmin) {
        router.push('/admin');
      } else {
        axios.get('/api/user').then((response) => {
          setUserData(response.data);
        });

        axios.get('/api/calendar').then((response) => {
          setBusySlots(response.data.busySlots || []);
        });
      }
      
    }
  }, [session, router]);

  const handleReservation = async () => {
    if (!selectedDate) {
      setMessage('Por favor seleccione una fecha');
      return;
    }

    // Combinar la fecha seleccionada y la hora seleccionada
    const reservationDateTime = new Date(selectedDate);
    const [hours, minutes] = selectedTime.split(':');
    reservationDateTime.setHours(hours);
    reservationDateTime.setMinutes(minutes);

    // Obtener la fecha y hora actual
    const now = new Date();

    // Calcular la diferencia en milisegundos
    const timeDifference = reservationDateTime - now;

    // Convertir la diferencia a horas
    const hoursDifference = timeDifference / (1000 * 60 * 60);

    // Verificar si la diferencia es menor a 18 horas
    if (hoursDifference < 18) {
      setMessage('Las reservas deben hacerse al menos 18 horas antes.');
      return;
    }

    try {
      const response = await axios.post('/api/reserve', {
        date: selectedDate,
        time: selectedTime,
      });

      setMessage(response.data.message);
      const updatedUser = await axios.get('/api/user');
      setUserData(updatedUser.data);
    } catch (error) {
      setMessage(error.response.data.message);
    }
  };

  const handleSignIn = () => {
    setShowConsentModal(true); 
  };

  const handleAccept = () => {
    setShowConsentModal(false);
    signIn('google');
  };

  const handleReject = () => {
    setShowConsentModal(false); 
  };

  return (
    <Container>
      {session ? (
        <>
          <h1>Bienvenido, {session.user.name}!</h1>
          <p>Tienes {userData.credits} créditos disponibles.</p>

          <h2>Selecciona una fecha y una hora para hacer una reserva:</h2>
          <Calendar onClickDay={setSelectedDate} />

          {/* Selector de tiempo para elegir la hora */}
          <TimePicker value={selectedTime} onChange={(e) => setSelectedTime(e.target.value)}>
            {times.map((time) => (
              <option key={time} value={time}>{time}</option>
            ))}
          </TimePicker>

          <Button onClick={handleReservation} disabled={!selectedDate || userData.credits <= 0}>
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

          <Button onClick={() => signOut()}>Cerrar Sesión</Button>
        </>
      ) : (
        <>
          <h1>Bienvenido a la reserva de la Moon de CrashPath</h1>
          <Button onClick={handleSignIn}>Inicia sesión con Google</Button>
        </>
      )}

      {showConsentModal && (
        <ModalOverlay>
          <ModalContent>
            <h2>Consentimiento para utilizar Google Calendar</h2>
            <p>Esta aplicación requiere acceso a tu Google Calendar para poder agregar eventos. ¿Deseas continuar?</p>
            <ModalButton onClick={handleAccept}>Aceptar</ModalButton>
            <ModalButton danger onClick={handleReject}>Rechazar</ModalButton>
          </ModalContent>
        </ModalOverlay>
      )}
    </Container>
  );
}
