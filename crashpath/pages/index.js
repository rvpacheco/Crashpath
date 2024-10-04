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

export default function Home() {
  const { data: session } = useSession();
  const [userData, setUserData] = useState({ credits: 0, reservations: [] });
  const [busySlots, setBusySlots] = useState([]);
  const [selectedDate, setSelectedDate] = useState(null);
  const [selectedTime, setSelectedTime] = useState('08:00');
  const [message, setMessage] = useState('');
  const [showConsentModal, setShowConsentModal] = useState(false); // Controla el modal
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
    setShowConsentModal(true); // Mostrar modal de consentimiento
  };

  const handleAccept = () => {
    setShowConsentModal(false); // Cerrar el modal
    signIn('google'); // Iniciar sesión con Google
  };

  const handleReject = () => {
    setShowConsentModal(false); // Cerrar el modal si se rechaza
  };

  return (
    <Container>
      {session ? (
        <>
          <h1>Bienvenido, {session.user.name}!</h1>
          <p>Tienes {userData.credits} créditos disponibles.</p>

          <h2>Selecciona una fecha para hacer una reserva:</h2>
          <Calendar onClickDay={setSelectedDate} />

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
