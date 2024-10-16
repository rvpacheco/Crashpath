import { useEffect, useState } from 'react';
import { signIn, signOut, useSession } from 'next-auth/react';
import styled from 'styled-components';
import axios from 'axios';
import Calendar from 'react-calendar';
import 'react-calendar/dist/Calendar.css';
import { useRouter } from 'next/router';
import Link from 'next/link';

const Container = styled.main`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 100vh;
  padding: 20px;
`;

const WelcomeText = styled.div`
  text-align: center;
  max-width: 600px;
  margin-bottom: 40px;

  h1 {
    font-size: 36px;
    margin-bottom: 20px;
    color: #333;
  }

  p {
    font-size: 18px;
    line-height: 1.6;
    color: #555;
  }
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

const CloseButton = styled.button`
  position: absolute;
  top: 10px;
  right: 10px;
  background: transparent;
  border: none;
  font-size: 24px;
  cursor: pointer;
  color: red;
  
  &:hover {
    color: darkred;
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
  position: relative;
`;

const ModalButton = styled(Button)`
  margin: 10px;
  background-color: ${(props) => (props.danger ? '#dc3545' : '#28a745')};
  &:hover {
    background-color: ${(props) => (props.danger ? '#c82333' : '#218838')};
  }
`;

const times = [
  '07:00', '08:00', '09:00', '10:00', '11:00', '12:00', '13:00', '14:00',
  '15:00', '16:00', '17:00', '18:00', '19:00', '20:00'
];

export default function Home() {
  const { data: session } = useSession();
  const [userData, setUserData] = useState({ credits: 0, reservations: [] });
  const [busySlots, setBusySlots] = useState([]);
  const [selectedDate, setSelectedDate] = useState(null);
  const [selectedTime, setSelectedTime] = useState(times[0]);
  const [message, setMessage] = useState('');
  const [showReservationModal, setShowReservationModal] = useState(false);
  const [showNoSpaceModal, setShowNoSpaceModal] = useState(false);
  const [isFirstReservation, setIsFirstReservation] = useState(false); // Estado para verificar si es la primera reserva
  const [isPrivate, setIsPrivate] = useState(false); // Estado para controlar si la reserva será privada o pública
  const [reservationsAtTime, setReservationsAtTime] = useState(0);
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

    const reservationDateTime = new Date(selectedDate);
    const [hours, minutes] = selectedTime.split(':');
    reservationDateTime.setHours(hours);
    reservationDateTime.setMinutes(minutes);

    const now = new Date();
    const timeDifference = reservationDateTime - now;
    const hoursDifference = timeDifference / (1000 * 60 * 60);

    if (hoursDifference < 18) {
      setMessage('Las reservas deben hacerse al menos 18 horas antes.');
      return;
    }

    try {
      const response = await axios.post('/api/check-reservations', {
        date: selectedDate,
        time: selectedTime,
      });

      setReservationsAtTime(response.data.count);

      if (response.data.isPrivate) {
        // Si la franja es privada, mostramos el mensaje y cerramos el modal
        setMessage('Lo siento, esta franja horaria es privada y no se pueden hacer más reservas.');
        setShowReservationModal(false);  // Aquí cerramos el modal
        return;  // Salimos de la función para que no continúe
      } else if (response.data.count >= 3) {
        setShowNoSpaceModal(true); // Mostrar modal de no hay espacio
      } else if (response.data.count === 0) {
        setIsFirstReservation(true); // Es la primera reserva
        setShowReservationModal(true); // Mostrar el modal para elegir si es privada o pública
      } else {
        setShowReservationModal(true); // Mostrar modal de confirmación de reserva
      }
    } catch (error) {
      setMessage(error.response.data.message);
    }
  };

  const confirmReservation = async () => {
    try {
      // Aquí aseguramos que `isPrivate` se envíe correctamente al backend
      const response = await axios.post('/api/reserve', {
        date: selectedDate,
        time: selectedTime,
        isPrivate: isFirstReservation ? isPrivate : false, // Si es la primera reserva, decidir si es privada
      });

      setMessage(response.data.message);
      const updatedUser = await axios.get('/api/user');
      setUserData(updatedUser.data);
      setShowReservationModal(false);
    } catch (error) {
      setMessage(error.response.data.message);
    }
  };

  return (
    <Container>
      {!session && (
        <WelcomeText>
          <h1>Bienvenido a la reserva de la Moon de CrashPath</h1>
          <p>
            CrashPath Moon es una plataforma donde puedes reservar el tiempo de uso de la moonboard y la zona de entrenamiento de Crashpath.
            Puedes elegir una fecha y hora, y automáticamente la reservamos para ti y se agendará en tu calendario de Google.
            <br /><br />
            ¡Inicia sesión para ver tus créditos disponibles y hacer una reserva!
          </p>
        </WelcomeText>
      )}

      {session ? (
        <>
          <h1>Bienvenido, {session.user.name}!</h1>
          <p>Tienes {userData.credits} créditos disponibles.</p>

          <h2>Selecciona una fecha y una hora para hacer una reserva:</h2>
          <Calendar onClickDay={setSelectedDate} />

          <TimePicker value={selectedTime} onChange={(e) => setSelectedTime(e.target.value)}>
            {times.map((time) => (
              <option key={time} value={time}>{time}</option>
            ))}
          </TimePicker>

          <Button onClick={handleReservation} disabled={!selectedDate || userData.credits <= 0}>
            Reserva {selectedDate && `${selectedDate.toLocaleDateString()} a las ${selectedTime}`}
          </Button>

          {message && <p>{message}</p>}

          <h2>Tus Reservaciones:</h2>
          <ul>
            {userData.reservations.map((reservation, index) => (
              <li key={index}>
                Reserva para el día {new Date(reservation.date).toLocaleDateString()} a las {reservation.time}
              </li>
            ))}
          </ul>

          <Button onClick={() => signOut()}>Cerrar Sesión</Button>
        </>
      ) : (
        <>
          <Button onClick={() => signIn('google')}>Inicia sesión con Google</Button>
        </>
      )}

      {/* Modal para elegir si la reserva es privada o pública */}
      {isFirstReservation && showReservationModal && (
        <ModalOverlay>
          <ModalContent>
            <CloseButton onClick={() => setShowReservationModal(false)}>X</CloseButton>
            <h2>¿Quieres que esta sesión sea privada o pública?</h2>
            <p>Si eliges privada, nadie más podrá reservar en esta franja horaria. Si eliges pública, se pueden agregar hasta 3 personas más.</p>
            <ModalButton onClick={() => { setIsPrivate(true); confirmReservation(); }}>Privada</ModalButton>
            <ModalButton onClick={() => { setIsPrivate(false); confirmReservation(); }}>Pública</ModalButton>
          </ModalContent>
        </ModalOverlay>
      )}

      {/* Modal de confirmación de reserva */}
      {!isFirstReservation && showReservationModal && (
        <ModalOverlay>
          <ModalContent>
            <CloseButton onClick={() => setShowReservationModal(false)}>X</CloseButton>
            <h2>Han reservado {reservationsAtTime} personas para esta hora.</h2>
            <p>¿Quieres reservar?</p>
            <ModalButton onClick={confirmReservation}>Reservar</ModalButton>
          </ModalContent>
        </ModalOverlay>
      )}

      {/* Modal de no hay espacio */}
      {showNoSpaceModal && (
        <ModalOverlay>
          <ModalContent>
            <CloseButton onClick={() => setShowNoSpaceModal(false)}>X</CloseButton>
            <h2>Lo siento, No quedan cupos para esta hora/día.</h2>
          </ModalContent>
        </ModalOverlay>
      )}
    </Container>
  );
}
