import { useEffect, useState } from 'react';
import { signIn, signOut, useSession } from 'next-auth/react';
import styled from 'styled-components';
import axios from 'axios';
import { Calendar} from 'rsuite';
import 'rsuite/dist/rsuite.min.css';
import { useRouter } from 'next/router';
import { DigitalClock } from '@mui/x-date-pickers/DigitalClock';
import { LocalizationProvider } from '@mui/x-date-pickers';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
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
    font-size: 20px;
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

const times = Array.from({ length: 27 }, (_, i) => {
  const hour = Math.floor(i / 2) + 7; // Empieza en las 7 horas
  const minutes = i % 2 === 0 ? '00' : '30'; // Alterna entre :00 y :30
  return `${hour.toString().padStart(2, '0')}:${minutes}`;
});

export default function Home() {
  const { data: session } = useSession();
  const [userData, setUserData] = useState({ credits: 0, reservations: [] });
  const [busySlots, setBusySlots] = useState([]);
  const [selectedDate, setSelectedDate] = useState(null);
  const [selectedTime, setSelectedTime] = useState(null);
  const [message, setMessage] = useState('');
  const [showReservationModal, setShowReservationModal] = useState(false);
  const [showNoSpaceModal, setShowNoSpaceModal] = useState(false);
  const [isFirstReservation, setIsFirstReservation] = useState(false); // Estado para verificar si es la primera reserva
  const [isPrivate, setIsPrivate] = useState(false); // Estado para controlar si la reserva será privada o pública
  const [reservationsAtTime, setReservationsAtTime] = useState(0);
  const [showConsentModal, setShowConsentModal] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false); // Estado para el modal de 
  const [showPrivateSlotModal, setShowPrivateSlotModal] = useState(false); // Nuevo estado para franja privada
  const [isSubmitting, setIsSubmitting] = useState(false); // Nuevo estado para prevenir múltiples envíos


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

  const handleReservation = async () => {
    if (!selectedDate) {
      setMessage('Por favor seleccione una fecha');
      return;
    }

    if (!selectedTime) {
      setMessage('Por favor seleccione una hora válida');
      return;
    }

    const reservationDateTime = new Date(selectedDate);
    reservationDateTime.setHours(selectedTime.getHours());
    reservationDateTime.setMinutes(selectedTime.getMinutes());

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
        time: `${reservationDateTime.getHours().toString().padStart(2, '0')}:${reservationDateTime.getMinutes().toString().padStart(2, '0')}`,
      });

      setReservationsAtTime(response.data.count);

      if (response.data.isPrivate) {
        // Si la franja es privada, mostrar el modal de franja privada
        setShowPrivateSlotModal(true);
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
      // Convertir la fecha a ISO antes de enviarla al backend si es necesario
      const formattedDate = new Date(selectedDate).toISOString().split('T')[0];  // Enviar solo la parte de la fecha
      const response = await axios.post('/api/reserve', {
        date: formattedDate,  // Asegúrate de enviar la fecha en formato ISO
        time: selectedTime,   // La hora en formato HH:mm
        isPrivate: isFirstReservation ? isPrivate : false,
      });

      setMessage(response.data.message);
      const updatedUser = await axios.get('/api/user');
      setUserData(updatedUser.data);
      setShowReservationModal(false);
    } catch (error) {
      setMessage(error.response.data.message);
    }
  };
  const finalizeReservation = async () => {
    if (isSubmitting) return; // Si ya está enviando, evita que la función se ejecute nuevamente
    setIsSubmitting(true); // Establecer el estado a 'enviando' para evitar múltiples envíos

    try {
      const formattedDate = new Date(selectedDate).toISOString().split('T')[0];
      const response = await axios.post('/api/reserve', {
        date: formattedDate,
        time: selectedTime,
        isPrivate,
      });

      setMessage(response.data.message);
      setShowConfirmModal(false); // Cierra el modal de confirmación después de hacer la reserva
      setShowReservationModal(false); // Cierra el modal de reserva
      setIsSubmitting(false); // Restablece el estado después de que se complete la solicitud
    } catch (error) {
      setMessage(error.response.data.message);
      setIsSubmitting(false); // Restablece el estado en caso de error
    }
  };


  return (
    <LocalizationProvider dateAdapter={AdapterDateFns}>
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
<h1 style={{ fontSize: '30px' }}>Bienvenido, {session.user.name}!</h1>
          <p>Tienes {userData.credits} créditos disponibles.</p>

          <strong>Selecciona una fecha y una hora para hacer una reserva:</strong>
          <Calendar
            compact
            onSelect={(date) => setSelectedDate(date)}
            value={selectedDate}
          />

<DigitalClock
            onChange={(value) => setSelectedTime(value)}
            ampm={true}
            timeStep={30} // Intervalos de 30 minutos
            minTime={new Date(0, 0, 0, 7, 0)} // 07:00
            maxTime={new Date(0, 0, 0, 20, 0)} // 20:00
          />

          <Button onClick={handleReservation} disabled={!selectedDate || userData.credits <= 0}>
            Reserva {selectedDate && `${selectedDate.toLocaleDateString()} a las ${selectedTime}`}
          </Button>

          {message && <p>{message}</p>}
        </>
      ) : (
        <>
          <Button onClick={handleSignIn}>Inicia sesión con Google</Button>
        </>
      )}

      {/* Modal para elegir si la reserva es privada o pública */}
      {isFirstReservation && showReservationModal && (
        <ModalOverlay>
          <ModalContent>
            <CloseButton onClick={() => setShowReservationModal(false)}>X</CloseButton>
            <h2>¿Quieres que esta sesión sea privada o pública?</h2>
            <p>Si eliges privada, nadie más podrá reservar en esta franja horaria. Si eliges pública, se pueden agregar hasta 3 personas más.</p>
            <ModalButton onClick={() => { setIsPrivate(true); setShowConfirmModal(true); setShowReservationModal(false); }}>Privada</ModalButton>
            <ModalButton onClick={() => { setIsPrivate(false); setShowConfirmModal(true); setShowReservationModal(false); }}>Pública</ModalButton>
          </ModalContent>
        </ModalOverlay>
      )}


      {/* Modal de confirmación de reserva pública */}
      {!isFirstReservation && showReservationModal && (
        <ModalOverlay>
          <ModalContent>
            <CloseButton onClick={() => setShowReservationModal(false)}>X</CloseButton>
            <h2>Han reservado {reservationsAtTime} personas para esta hora.</h2>
            <p>¿Quieres reservar?</p>
            <ModalButton onClick={() => { setShowConfirmModal(true); setShowReservationModal(false); }}>
              Reservar
            </ModalButton>
          </ModalContent>
        </ModalOverlay>
      )}

      {/* Modal para franja horaria privada */}
      {showPrivateSlotModal && (
        <ModalOverlay>
          <ModalContent>
            <CloseButton onClick={() => setShowPrivateSlotModal(false)}>X</CloseButton>
            <h2>Lo siento, esta franja horaria ya es privada.</h2>
            <p>Por favor, selecciona otra hora para tu reserva.</p>
          </ModalContent>
        </ModalOverlay>
      )}

      {/* Modal de confirmación final de reserva */}
      {showConfirmModal && (
        <ModalOverlay>
          <ModalContent>
            <CloseButton onClick={() => setShowConfirmModal(false)}>X</CloseButton>
            <h2>¿Estás segur@ que quieres reservar a las {selectedTime} del día {new Date(selectedDate).toLocaleDateString()}?</h2>
            <ModalButton
              onClick={finalizeReservation}
              disabled={isSubmitting} // Deshabilitar el botón mientras se envía
            >
              {isSubmitting ? 'Reservando...' : 'Confirmar'}
            </ModalButton>
            <ModalButton
              danger
              onClick={() => setShowConfirmModal(false)}
              disabled={isSubmitting} // Deshabilitar el botón mientras se envía
            >
              Cancelar
            </ModalButton>
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
      <footer style={{ textAlign: 'center', marginTop: '40px' }}>
        <Link href="/privacy" style={{ color: '#007bff', textDecoration: 'none' }}>
          Política de Privacidad
        </Link>
      </footer>
    </Container>
    </LocalizationProvider>
  );
}
