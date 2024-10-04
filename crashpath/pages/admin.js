import { useEffect, useState } from 'react';
import { useSession, signIn, signOut } from 'next-auth/react';
import { useRouter } from 'next/router';
import axios from 'axios';
import styled from 'styled-components';

const AdminContainer = styled.div`
  max-width: 900px;
  margin: 0 auto;
  padding: 20px;
  background-color: #fff;
  border-radius: 8px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);

  @media (max-width: 768px) {
    padding: 10px;
  }

  @media (max-width: 480px) {
    max-width: 100%;
    padding: 5px;
  }
`;

const TableWrapper = styled.div`
  width: 100%;
  overflow-x: auto; /* Permite que la tabla se desplace horizontalmente en pantallas pequeñas */
  margin-bottom: 20px;

  @media (max-width: 480px) {
    overflow-x: scroll; /* Hace la tabla desplazable horizontalmente */
    -webkit-overflow-scrolling: touch; /* Suaviza el desplazamiento en dispositivos táctiles */
  }
`;

const Table = styled.table`
  width: 100%;
  border-collapse: collapse;
  margin-bottom: 20px;

  @media (max-width: 768px) {
    font-size: 14px;
  }

  @media (max-width: 480px) {
    font-size: 12px;
  }
`;

const Th = styled.th`
  background-color: #007bff;
  color: white;
  padding: 10px;
  text-align: left;

  @media (max-width: 768px) {
    padding: 8px;
  }

  @media (max-width: 480px) {
    padding: 6px;
  }
`;

const Td = styled.td`
  padding: 10px;
  border-bottom: 1px solid #ccc;

  @media (max-width: 768px) {
    padding: 8px;
  }

  @media (max-width: 480px) {
    padding: 6px;
  }
`;

const Button = styled.button`
  background-color: #28a745;
  color: white;
  padding: 8px 12px;
  border: none;
  border-radius: 5px;
  cursor: pointer;
  font-size: 12px;
  margin-right: 5px;
  white-space: nowrap; /* Asegura que el texto del botón no se divida en dos líneas */

  &:hover {
    background-color: #218838;
  }

  &.danger {
    background-color: #dc3545;
    color: white;
    border-radius: 50%;
    width: 25px;
    height: 25px;
    padding: 0;
    font-size: 14px;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;

    &:hover {
      background-color: #c82333;
    }
  }

  @media (max-width: 480px) {
    font-size: 10px; /* Reducir tamaño de letra en pantallas pequeñas */
    padding: 6px 8px;
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
  border-radius: 10px;
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
  z-index: 1000;

  @media (max-width: 480px) {
    width: 90%;
    padding: 15px;
  }
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

export default function AdminPage() {
  const { data: session } = useSession();
  const router = useRouter();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [credits, setCredits] = useState(0);

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
    setShowModal(true);
  };

  const submitCredits = async () => {
    try {
      await axios.post('/api/admin/adjust-credits', {
        userId: selectedUser,
        credits: parseInt(credits),
      });
      setShowModal(false);
      setCredits(0);
      fetchUsers();
    } catch (error) {
      console.error('Error modifying credits:', error);
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
    return <div>Loading...</div>;
  }

  return (
    <AdminContainer>
      <h1>Panel de Administración</h1>
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
                          {new Date(reservation.date).toLocaleDateString()} - {reservation.time}
                          <Button
                            className="danger"
                            onClick={() => removeReservation(user._id, reservation._id)}
                          >
                            &times;
                          </Button>
                        </li>
                      ))}
                    </ul>
                  </Td>
                  <Td>
                    <Button onClick={() => handleAddCredits(user._id)}>Modificar Créditos</Button>
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        </TableWrapper>
      )}
      <Button onClick={() => signOut()}>Cerrar Sesión</Button>

      <Overlay show={showModal} onClick={() => setShowModal(false)} />
      <Modal show={showModal}>
        <h2>Modificar Créditos</h2>
        <input
          type="number"
          value={credits}
          onChange={(e) => setCredits(e.target.value)}
          placeholder="Ingrese la cantidad (+ para agregar, - para eliminar)"
        />
        <Button onClick={submitCredits}>Confirmar</Button>
        <Button className="danger" onClick={() => setShowModal(false)}>
          Cancelar
        </Button>
      </Modal>
    </AdminContainer>
  );
}
