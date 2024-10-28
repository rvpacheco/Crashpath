import { useEffect, useState } from 'react';
import { useSession, signIn, signOut } from 'next-auth/react';
import { useRouter } from 'next/router';
import axios from 'axios';
import styled from 'styled-components';
import Calendar from 'react-calendar';
import 'react-calendar/dist/Calendar.css';
// Estilos
const AdminContainer = styled.div`
  max-width: 1100px;
  margin: 40px auto;
  padding: 20px;
  background-color: #f9f9f9;
  border-radius: 12px;
  box-shadow: 0 8px 20px rgba(0, 0, 0, 0.1);
  text-align: center;
`;

const Title = styled.h1`
  color: #333;
  margin-bottom: 20px;
  font-size: 32px;
`;

const TableWrapper = styled.div`
  width: 100%;
  overflow-x: auto;
  margin-bottom: 20px;
`;

const Table = styled.table`
  width: 100%;
  border-collapse: collapse;
  background-color: #fff;
  border-radius: 8px;
  box-shadow: 0 4px 10px rgba(0, 0, 0, 0.1);
  overflow: hidden;
`;

const Th = styled.th`
  background-color: #007bff;
  color: white;
  padding: 12px 15px;
  text-align: left;
  font-size: 16px;
  white-space: nowrap;
`;

const Td = styled.td`
  padding: 12px 15px;
  border-bottom: 1px solid #f0f0f0;
  text-align: left;
  color: #555;
`;

const ActionContainer = styled.div`
  display: flex;
  gap: 10px;
  justify-content: center;
`;

const Button = styled.button`
  background-color: ${(props) => (props.danger ? '#dc3545' : '#28a745')};
  color: white;
  padding: 8px 12px;
  border: none;
  border-radius: 5px;
  cursor: pointer;
  font-size: 14px;
  transition: background-color 0.3s;

  &:hover {
    background-color: ${(props) => (props.danger ? '#c82333' : '#218838')};
  }
`;

const DangerButton = styled(Button)`
  background-color: #dc3545;
  border-radius: 50%;
  width: 30px;
  height: 30px;
  padding: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 16px;

  &:hover {
    background-color: #c82333;
  }
`;

const Modal = styled.div`
  display: ${({ show }) => (show ? 'block' : 'none')};
  position: fixed;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  background-color: #fff;
  padding: 20px;
  border-radius: 12px;
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
  z-index: 1000;
  width: 400px;
  max-width: 90%;
`;

const Overlay = styled.div`
  display: ${({ show }) => (show ? 'block' : 'none')};
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background-color: rgba(0, 0, 0, 0.5);
  z-index: 500;
`;

const ModalTitle = styled.h2`
  margin-bottom: 20px;
  font-size: 24px;
  color: #333;
`;

const Input = styled.input`
  padding: 10px;
  width: 100%;
  margin: 10px 0;
  font-size: 16px;
  border-radius: 8px;
  border: 1px solid #ccc;
`;

export default function AdminPage() {
  const { data: session } = useSession();
  const router = useRouter();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreditsModal, setShowCreditsModal] = useState(false); // Para el modal de créditos
  const [showReservationModal, setShowReservationModal] = useState(false); // Para el modal de reservas
  const [selectedUser, setSelectedUser] = useState(null);
  const [credits, setCredits] = useState(0);
  const [selectedDate, setSelectedDate] = useState(null);
  const [selectedTime, setSelectedTime] = useState('');
  const [isPrivate, setIsPrivate] = useState(false);  // Estado para la opción de privacidad
  const [isFirstReservation, setIsFirstReservation] = useState(false);  // Indicador para la primera reserva

  useEffect(() => {
    if (!session) {
      signIn();
    } else if (!session.isAdmin) {
      router.push('/');
    } else {
      fetchUsers();
    }
  }, [session, router]);

  const fetchUsers = async () => {
    try {
      const response = await axios.get('/api/admin/users');
      setUsers(response.data.users);
      setLoading(false);
    } catch (error) {
      console.error('Error fetching users:', error);
    }
  };

  const handleAddCredits = (userId) => {
    setSelectedUser(userId);
    setShowCreditsModal(true); // Mostrar modal para créditos
  };

  const handleCreateReservation = (userId) => {
    setSelectedUser(userId);
    setShowReservationModal(true); // Mostrar modal para reservas
  };

  // Verificación de si es la primera reserva
  const checkFirstReservation = async (date, time) => {
    const formattedDate = date.toISOString().split('T')[0];
    try {
      const response = await axios.post('/api/check-first-reservation', {
        date: formattedDate,
        time: time,
      });
      setIsFirstReservation(response.data.isFirstReservation);
    } catch (error) {
      console.error('Error checking first reservation:', error);
    }
  };

  // Actualiza el estado de la fecha seleccionada
  const handleDateSelection = (date) => {
    setSelectedDate(date);
    if (selectedTime) {
      checkFirstReservation(date, selectedTime);  // Verificamos si es la primera reserva
    }
  };

  // Actualiza el estado del tiempo seleccionado y asegura el formato adecuado
  const handleTimeSelection = (event) => {
    const time = event.target.value;  // Captura el valor en formato "HH:mm"
    setSelectedTime(time);
    if (selectedDate) {
      checkFirstReservation(selectedDate, time);  // Verificamos si es la primera reserva
    }
  };

  const submitCredits = async () => {
    try {
      await axios.post('/api/admin/adjust-credits', {
        userId: selectedUser,
        credits: parseInt(credits),
      });
      setShowCreditsModal(false); // Cerrar modal
      setCredits(0);
      fetchUsers();
    } catch (error) {
      console.error('Error modifying credits:', error);
    }
  };

  const addReservation = async () => {
    if (!selectedDate || !selectedTime) {
      alert('Por favor selecciona una fecha y hora.');
      return;
    }

    const formattedDate = selectedDate.toISOString().split('T')[0]; // Formato YYYY-MM-DD

    try {
      await axios.post('/api/reserve', {
        userId: selectedUser,
        date: formattedDate,  // Enviamos la fecha en formato YYYY-MM-DD
        time: selectedTime,    // La hora seleccionada en formato HH:mm
        isPrivate: isPrivate,  // Enviar si la reserva es privada o pública
      });
      
      setShowReservationModal(false); // Cerrar modal
      fetchUsers();
    } catch (error) {
      console.error('Error creating reservation:', error);
    }
  };

  const removeReservation = async (userId, reservationId) => {
    try {
      await axios.post('/api/admin/remove-reservation', { userId, reservationId });
      fetchUsers();
    } catch (error) {
      console.error('Error removing reservation:', error);
    }
  };

  if (!session) {
    return <div>Cargando...</div>;
  }

  return (
    <AdminContainer>
      <Title>Panel de Administración</Title>
      {loading ? (
        <p>Cargando usuarios...</p>
      ) : (
        <TableWrapper>
          <Table>
            <thead>
              <tr>
                <Th>Nombre</Th>
                <Th>Email</Th>
                <Th>Créditos</Th>
                <Th>Reservas</Th>
                <Th>Acciones</Th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr key={user._id}>
                  <Td>{user.name}</Td>
                  <Td>{user.email}</Td>
                  <Td>{user.credits}</Td>
                  <Td>
                    <ul>
                      {user.reservations.map((reservation) => (
                        <li key={reservation._id}>
                          {new Date(reservation.date).toLocaleDateString()} - {reservation.time} -{' '}
                          {reservation.isPrivate ? 'Privada' : 'Pública'}
                          <DangerButton
                            onClick={() => removeReservation(user._id, reservation._id)}
                          >
                            &times;
                          </DangerButton>
                        </li>
                      ))}
                    </ul>
                  </Td>
                  <Td>
                    <ActionContainer>
                      <Button onClick={() => handleAddCredits(user._id)}>
                        Modificar Créditos
                      </Button>
                      <Button onClick={() => handleCreateReservation(user._id)}>
                        Crear Reserva
                      </Button>
                    </ActionContainer>
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        </TableWrapper>
      )}
      <Button onClick={() => signOut()}>Cerrar Sesión</Button>

      {/* Modal para agregar créditos */}
      <Overlay show={showCreditsModal} onClick={() => setShowCreditsModal(false)} />
      <Modal show={showCreditsModal}>
        <ModalTitle>Modificar Créditos</ModalTitle>
        <Input
          type="number"
          value={credits}
          onChange={(e) => setCredits(e.target.value)}
          placeholder="Ingrese la cantidad (+ o -)"
        />
        <ActionContainer>
          <Button onClick={submitCredits}>Confirmar</Button>
          <Button danger onClick={() => setShowCreditsModal(false)}>
            Cancelar
          </Button>
        </ActionContainer>
      </Modal>

      {/* Modal para agregar reservas */}
      <Overlay show={showReservationModal} onClick={() => setShowReservationModal(false)} />
      <Modal show={showReservationModal}>
        <ModalTitle>Crear Nueva Reserva</ModalTitle>
        <Calendar onClickDay={handleDateSelection} />
        <Input
          type="time"
          value={selectedTime}
          onChange={handleTimeSelection}  // Actualizamos el estado con el valor de la hora seleccionada
        />
        
        {/* Mostrar la opción de privacidad solo si es la primera reserva */}
        {isFirstReservation && (
          <div>
            <label>
              <input
                type="radio"
                value={false}
                checked={!isPrivate}
                onChange={() => setIsPrivate(false)}
              />
              Pública
            </label>
            <label>
              <input
                type="radio"
                value={true}
                checked={isPrivate}
                onChange={() => setIsPrivate(true)}
              />
              Privada
            </label>
          </div>
        )}
        
        <ActionContainer>
          <Button onClick={addReservation}>Confirmar Reserva</Button>
          <Button danger onClick={() => setShowReservationModal(false)}>
            Cancelar
          </Button>
        </ActionContainer>
      </Modal>
    </AdminContainer>
  );
}
