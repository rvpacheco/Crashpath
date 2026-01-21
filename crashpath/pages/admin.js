import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useSession, signIn, signOut } from "next-auth/react";
import { useRouter } from "next/router";
import axios from "axios";
import styled, { createGlobalStyle } from "styled-components";
import Calendar from "react-calendar";
import "react-calendar/dist/Calendar.css";

/** =========================
 *  UI/UX goals (mobile-first)
 *  - iPhone/Android friendly spacing + tap targets
 *  - Table becomes cards on small screens
 *  - Search + quick actions on mobile
 *  - Modals rendered in a Portal to avoid iOS/backdrop-filter fixed-position bugs
 *  - Safe states: loading, empty, errors, disable buttons while submitting
 *  - Reduced motion support
 *  ========================= **/

/** Paleta CrashPath **/
const palette = {
  bg: "#E7E1D2",
  card: "rgba(255,255,255,0.55)",
  cardSolid: "#F3EFE6",
  text: "#2B2620",
  muted: "#6B6257",
  border: "rgba(43,38,32,0.14)",
  accent: "#9C4F24",
  accent2: "#C26A34",
  success: "#2E9E56",
  danger: "#D84A4A",
  focus: "rgba(156,79,36,0.18)",
};

const GlobalStyle = createGlobalStyle`
  :root { color-scheme: light; }
  * { box-sizing: border-box; }

  body {
    margin: 0;
    -webkit-font-smoothing: antialiased;
    text-rendering: optimizeLegibility;
  }

  input, button { font-family: inherit; }

  /* React-calendar mobile polish */
  .react-calendar {
    width: 100%;
    border: 1px solid ${palette.border};
    border-radius: 14px;
    overflow: hidden;
    background: rgba(255,255,255,0.75);
  }
  .react-calendar__navigation button { min-height: 44px; }
  .react-calendar__tile {
    min-height: 44px;
    border-radius: 10px;
  }
  .react-calendar__tile:enabled:hover,
  .react-calendar__tile:enabled:focus {
    background: ${palette.focus};
  }

  /* Reduce motion */
  @media (prefers-reduced-motion: reduce) {
    * { scroll-behavior: auto !important; transition: none !important; animation: none !important; }
  }

  /* lock body when modal open */
  body.modal-open {
    overflow: hidden;
    touch-action: none;
  }
`;

const PageShell = styled.div`
  min-height: 100vh;
  padding: 18px 12px 88px;
  background: ${palette.bg};
  position: relative;
  overflow: hidden;

  &::before {
    content: "";
    position: absolute;
    inset: 0;
    background-image: url("/test1.png");
    background-repeat: repeat;
    background-position: center;
    opacity: 0.16;
    pointer-events: none;
  }

  &::after {
    content: "";
    position: absolute;
    inset: 0;
    background: linear-gradient(
      180deg,
      rgba(231, 225, 210, 0.80),
      rgba(231, 225, 210, 0.92)
    );
    pointer-events: none;
  }

  @media (min-width: 768px) {
    padding: 44px 16px 64px;
  }
`;

const AdminContainer = styled.div`
  position: relative;
  z-index: 1;
  max-width: 1160px;
  margin: 0 auto;
  padding: 14px;
  border-radius: 18px;
  background: ${palette.card};
  border: 1px solid ${palette.border};
  box-shadow: 0 18px 45px rgba(0, 0, 0, 0.10);
  backdrop-filter: blur(8px);

  @media (min-width: 768px) {
    padding: 18px;
  }
`;

const TopBar = styled.div`
  display: grid;
  gap: 12px;
  padding: 6px 6px 14px;

  @media (min-width: 768px) {
    grid-template-columns: 1fr auto;
    align-items: center;
    justify-content: space-between;
    padding: 8px 6px 18px;
  }
`;

const TitleGroup = styled.div`
  display: grid;
  gap: 4px;
  text-align: left;
`;

const Title = styled.h1`
  margin: 0;
  color: ${palette.text};
  font-size: 22px;
  letter-spacing: .02em;
  line-height: 1.15;

  @media (min-width: 768px) {
    font-size: 28px;
  }
`;

const Subtitle = styled.p`
  margin: 0;
  color: ${palette.muted};
  font-size: 13px;

  @media (min-width: 768px) {
    font-size: 14px;
  }
`;

const TopActions = styled.div`
  display: grid;
  gap: 10px;

  @media (min-width: 768px) {
    display: flex;
    justify-content: flex-end;
    align-items: center;
    gap: 10px;
  }
`;

const SearchBar = styled.div`
  display: grid;
  grid-template-columns: 1fr auto;
  gap: 10px;

  @media (min-width: 768px) {
    grid-template-columns: 380px auto;
  }
`;

const SearchInput = styled.input`
  width: 100%;
  padding: 12px 12px;
  border-radius: 12px;
  border: 1px solid ${palette.border};
  background: rgba(255,255,255,0.80);
  font-size: 15px;
  outline: none;

  &:focus {
    border-color: rgba(156,79,36,0.45);
    box-shadow: 0 0 0 4px ${palette.focus};
  }
`;

const SecondaryButton = styled.button`
  background: rgba(255,255,255,0.65);
  color: ${palette.text};
  padding: 11px 12px;
  border: 1px solid ${palette.border};
  border-radius: 12px;
  cursor: pointer;
  font-size: 14px;
  min-height: 44px;

  &:hover { background: rgba(255,255,255,0.80); }
  &:focus-visible { outline: none; box-shadow: 0 0 0 4px ${palette.focus}; }
`;

const Button = styled.button`
  background: ${(p) => (p.variant === "danger" ? palette.danger : palette.success)};
  color: #fff;
  padding: 11px 12px;
  border: none;
  border-radius: 12px;
  cursor: pointer;
  font-size: 14px;
  letter-spacing: .01em;
  min-height: 44px;
  box-shadow: 0 10px 22px rgba(0,0,0,0.10);
  transition: transform .12s ease, filter .12s ease;
  opacity: ${(p) => (p.disabled ? 0.65 : 1)};

  &:hover { filter: brightness(0.95); transform: translateY(-1px); }
  &:active { transform: translateY(0px); }
  &:disabled { cursor: not-allowed; transform: none; }

  &:focus-visible { outline: none; box-shadow: 0 0 0 4px ${palette.focus}; }
`;

const Muted = styled.span`
  color: ${palette.muted};
  font-size: 13px;
`;

const Divider = styled.div`
  height: 1px;
  background: rgba(0,0,0,0.06);
  margin: 14px 0;
`;

const Badge = styled.span`
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 6px 10px;
  border-radius: 999px;
  border: 1px solid ${palette.border};
  background: rgba(255,255,255,0.55);
  font-size: 13px;

  b { font-weight: 800; }
`;

const PrivacyTag = styled.span`
  padding: 4px 8px;
  border-radius: 999px;
  font-size: 12px;
  border: 1px solid ${palette.border};
  background: ${(p) => (p.private ? "rgba(156,79,36,0.14)" : "rgba(46,158,86,0.12)")};
`;

const IconButton = styled.button`
  width: 40px;
  height: 40px;
  border-radius: 12px;
  border: 1px solid rgba(0,0,0,0.10);
  background: rgba(255,255,255,0.75);
  color: ${palette.danger};
  cursor: pointer;
  font-size: 20px;
  line-height: 1;
  display: grid;
  place-items: center;

  &:hover { background: rgba(255,255,255,0.95); }
  &:focus-visible { outline: none; box-shadow: 0 0 0 4px ${palette.focus}; }
  &:disabled { opacity: 0.6; cursor: not-allowed; }
`;

const Actions = styled.div`
  display: flex;
  gap: 10px;
  justify-content: flex-end;
  flex-wrap: wrap;
`;

/** Desktop table (hidden on mobile) **/
const TableWrapper = styled.div`
  width: 100%;
  overflow-x: auto;
  border-radius: 14px;
  border: 1px solid ${palette.border};
  background: ${palette.cardSolid};
  display: none;

  @media (min-width: 900px) {
    display: block;
  }
`;

const Table = styled.table`
  width: 100%;
  border-collapse: collapse;
  min-width: 920px;
`;

const Th = styled.th`
  background: linear-gradient(180deg, ${palette.accent}, ${palette.accent2});
  color: #fff;
  padding: 12px 14px;
  text-align: left;
  font-size: 14px;
  letter-spacing: .02em;
  white-space: nowrap;
`;

const Tr = styled.tr`
  &:nth-child(even) td { background: rgba(255,255,255,0.45); }
  &:hover td { background: rgba(255,255,255,0.70); }
`;

const Td = styled.td`
  padding: 12px 14px;
  border-bottom: 1px solid rgba(0,0,0,0.06);
  text-align: left;
  color: ${palette.text};
  vertical-align: top;
`;

/** Mobile cards (hidden on desktop) **/
const CardsGrid = styled.div`
  display: grid;
  gap: 12px;

  @media (min-width: 900px) {
    display: none;
  }
`;

const UserCard = styled.div`
  background: rgba(255,255,255,0.70);
  border: 1px solid ${palette.border};
  border-radius: 16px;
  padding: 12px;
  box-shadow: 0 10px 24px rgba(0,0,0,0.08);
`;

const CardHeader = styled.div`
  display: grid;
  gap: 6px;
`;

const NameRow = styled.div`
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 10px;
`;

const UserName = styled.div`
  color: ${palette.text};
  font-weight: 900;
  font-size: 15px;
  line-height: 1.2;
`;

const UserEmail = styled.div`
  color: ${palette.muted};
  font-size: 13px;
  word-break: break-word;
`;

const CardBody = styled.div`
  margin-top: 10px;
  display: grid;
  gap: 10px;
`;

const ReservationList = styled.div`
  display: grid;
  gap: 8px;
`;

const ReservationRow = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding: 10px 10px;
  border-radius: 14px;
  border: 1px solid rgba(0,0,0,0.06);
  background: rgba(255,255,255,0.6);
`;

const Pill = styled.span`
  display: inline-flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  color: ${palette.text};
  b { font-weight: 800; }
`;

/** Modals (Portal) **/
const Overlay = styled.div`
  display: ${({ show }) => (show ? "block" : "none")};
  position: fixed;
  inset: 0;
  background: rgba(0,0,0,0.55);
  z-index: 9998;
`;

const Modal = styled.div`
  display: ${({ show }) => (show ? "block" : "none")};
  position: fixed;
  z-index: 9999;
  left: 50%;
  top: 50%;
  transform: translate(-50%, -50%);

  width: calc(100% - 18px);
  max-width: 520px;

  background: ${palette.cardSolid};
  border: 1px solid ${palette.border};
  box-shadow: 0 20px 60px rgba(0,0,0,0.25);
  border-radius: 16px;
  padding: 14px;

  max-height: calc(100vh - 24px);
  overflow: auto;

  @media (min-width: 768px) {
    width: 460px;
    padding: 18px;
  }
`;

const SheetHandle = styled.div`
  display: block;
  width: 44px;
  height: 5px;
  border-radius: 999px;
  background: rgba(0,0,0,0.14);
  margin: 0 auto 10px;

  @media (min-width: 768px) {
    display: none;
  }
`;

const ModalTitle = styled.h2`
  margin: 0 0 10px;
  font-size: 18px;
  color: ${palette.text};

  @media (min-width: 768px) {
    font-size: 20px;
  }
`;

const Input = styled.input`
  padding: 12px 12px;
  width: 100%;
  margin: 10px 0;
  font-size: 16px;
  border-radius: 12px;
  border: 1px solid ${palette.border};
  background: rgba(255,255,255,0.80);
  outline: none;

  &:focus {
    border-color: rgba(156,79,36,0.45);
    box-shadow: 0 0 0 4px ${palette.focus};
  }
`;

const RadioRow = styled.div`
  display: flex;
  gap: 10px;
  align-items: center;
  margin-top: 10px;
  flex-wrap: wrap;
  color: ${palette.text};

  label {
    display: inline-flex;
    gap: 8px;
    align-items: center;
    padding: 10px 10px;
    border-radius: 12px;
    border: 1px solid ${palette.border};
    background: rgba(255,255,255,0.60);
    cursor: pointer;
    user-select: none;
  }
`;

const ErrorBox = styled.div`
  margin-top: 12px;
  padding: 10px 12px;
  border-radius: 12px;
  border: 1px solid rgba(216,74,74,0.30);
  background: rgba(216,74,74,0.10);
  color: ${palette.text};
  font-size: 13px;
`;

const EmptyState = styled.div`
  padding: 14px;
  border-radius: 14px;
  border: 1px dashed rgba(43,38,32,0.22);
  background: rgba(255,255,255,0.55);
`;

/** Small utilities */
const formatDate = (date) => {
  try {
    const d = new Date(date);
    return d.toLocaleDateString();
  } catch {
    return "Fecha inválida";
  }
};

/** Portal helper */
function ModalPortal({ children }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return null;
  return createPortal(children, document.body);
}

export default function AdminPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);

  const [showCreditsModal, setShowCreditsModal] = useState(false);
  const [showReservationModal, setShowReservationModal] = useState(false);

  const [selectedUser, setSelectedUser] = useState(null);
  const [credits, setCredits] = useState(0);

  const [selectedDate, setSelectedDate] = useState(null);
  const [selectedTime, setSelectedTime] = useState("");
  const [isPrivate, setIsPrivate] = useState(false);
  const [isFirstReservation, setIsFirstReservation] = useState(false);

  const [query, setQuery] = useState("");
  const [uiError, setUiError] = useState("");
  const [busy, setBusy] = useState(false);

  const didInit = useRef(false);

  useEffect(() => {
    if (didInit.current) return;
    if (status === "loading") return;

    didInit.current = true;

    if (!session) {
      signIn();
      return;
    }
    if (!session.isAdmin) {
      router.push("/");
      return;
    }

    fetchUsers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session, status, router]);

  const fetchUsers = async () => {
    setUiError("");
    setLoading(true);
    try {
      const response = await axios.get("/api/admin/users");
      setUsers(Array.isArray(response.data?.users) ? response.data.users : []);
    } catch (error) {
      console.error("Error fetching users:", error);
      setUiError("No se pudieron cargar los usuarios. Revisa tu conexión o intenta de nuevo.");
    } finally {
      setLoading(false);
    }
  };

  const filteredUsers = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return users;

    return users.filter((u) => {
      const name = (u?.name || "").toLowerCase();
      const email = (u?.email || "").toLowerCase();
      return name.includes(q) || email.includes(q);
    });
  }, [users, query]);

  const handleAddCredits = (userId) => {
    setUiError("");
    setSelectedUser(userId);
    setCredits(0);
    setShowCreditsModal(true);
  };

  const handleCreateReservation = (userId) => {
    setUiError("");
    setSelectedUser(userId);
    setSelectedDate(null);
    setSelectedTime("");
    setIsPrivate(false);
    setIsFirstReservation(false);
    setShowReservationModal(true);
  };

  const checkFirstReservation = async (date, time) => {
    if (!date || !time) return;
    const formattedDate = date.toISOString().split("T")[0];
    try {
      const response = await axios.post("/api/check-first-reservation", {
        date: formattedDate,
        time,
      });
      setIsFirstReservation(!!response.data?.isFirstReservation);
    } catch (error) {
      console.error("Error checking first reservation:", error);
      setIsFirstReservation(false);
    }
  };

  const handleDateSelection = (date) => {
    setSelectedDate(date);
    if (selectedTime) checkFirstReservation(date, selectedTime);
  };

  const handleTimeSelection = (event) => {
    const time = event.target.value;
    setSelectedTime(time);
    if (selectedDate) checkFirstReservation(selectedDate, time);
  };

  const submitCredits = async () => {
    setUiError("");
    const amount = Number(credits);

    if (!selectedUser) {
      setUiError("Selecciona un usuario antes de modificar créditos.");
      return;
    }
    if (!Number.isFinite(amount)) {
      setUiError("Créditos inválidos.");
      return;
    }

    setBusy(true);
    try {
      await axios.post("/api/admin/adjust-credits", {
        userId: selectedUser,
        credits: parseInt(amount, 10),
      });
      setShowCreditsModal(false);
      setCredits(0);
      await fetchUsers();
    } catch (error) {
      console.error("Error modifying credits:", error);
      setUiError("No se pudieron modificar los créditos. Intenta nuevamente.");
    } finally {
      setBusy(false);
    }
  };

  const addReservation = async () => {
    setUiError("");
    if (!selectedUser) {
      setUiError("Selecciona un usuario antes de crear una reserva.");
      return;
    }
    if (!selectedDate || !selectedTime) {
      setUiError("Selecciona una fecha y una hora.");
      return;
    }

    const formattedDate = selectedDate.toISOString().split("T")[0];

    setBusy(true);
    try {
      await axios.post("/api/reserve", {
        userId: selectedUser,
        date: formattedDate,
        time: selectedTime,
        isPrivate,
      });

      setShowReservationModal(false);
      await fetchUsers();
    } catch (error) {
      console.error("Error creating reservation:", error);
      setUiError("No se pudo crear la reserva. Verifica disponibilidad y vuelve a intentar.");
    } finally {
      setBusy(false);
    }
  };

  const removeReservation = async (userId, reservationId) => {
    setUiError("");
    if (!userId || !reservationId) return;

    const ok = window.confirm("¿Eliminar esta reserva?");
    if (!ok) return;

    setBusy(true);
    try {
      await axios.post("/api/admin/remove-reservation", { userId, reservationId });
      await fetchUsers();
    } catch (error) {
      console.error("Error removing reservation:", error);
      setUiError("No se pudo eliminar la reserva. Intenta nuevamente.");
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    const open = showCreditsModal || showReservationModal;
    document.body.classList.toggle("modal-open", open);
    return () => document.body.classList.remove("modal-open");
  }, [showCreditsModal, showReservationModal]);

  if (status === "loading" || (!session && status !== "authenticated")) {
    return (
      <PageShell>
        <GlobalStyle />
        <AdminContainer>
          <Title>Panel de Administración</Title>
          <Divider />
          <Muted>Cargando sesión...</Muted>
        </AdminContainer>
      </PageShell>
    );
  }

  return (
    <PageShell>
      <GlobalStyle />

      <AdminContainer>
        <TopBar>
          <TitleGroup>
            <Title>Panel de Administración</Title>
            <Subtitle>CrashPath Moon · usuarios, créditos y reservas</Subtitle>
          </TitleGroup>

          <TopActions>
            <SearchBar>
              <SearchInput
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Buscar por nombre o email…"
                inputMode="search"
                aria-label="Buscar usuario"
              />
              <SecondaryButton onClick={fetchUsers} title="Recargar">
                Recargar
              </SecondaryButton>
            </SearchBar>

            <SecondaryButton onClick={() => signOut()}>
              Cerrar sesión
            </SecondaryButton>
          </TopActions>
        </TopBar>

        {uiError ? <ErrorBox role="alert">{uiError}</ErrorBox> : null}

        <Divider />

        {loading ? (
          <Muted>Cargando usuarios...</Muted>
        ) : filteredUsers.length === 0 ? (
          <EmptyState>
            <div style={{ display: "grid", gap: 6 }}>
              <b style={{ color: palette.text }}>No hay usuarios</b>
              <Muted>
                {query.trim()
                  ? "No hay resultados para tu búsqueda."
                  : "Aún no hay usuarios cargados."}
              </Muted>
            </div>
          </EmptyState>
        ) : (
          <>
            {/* MOBILE CARDS */}
            <CardsGrid>
              {filteredUsers.map((user) => (
                <UserCard key={user._id}>
                  <CardHeader>
                    <NameRow>
                      <div>
                        <UserName>{user.name || "Sin nombre"}</UserName>
                        <UserEmail>{user.email || "Sin email"}</UserEmail>
                      </div>

                      <Badge title="Créditos">
                        <b>{user.credits ?? 0}</b>
                        <Muted>créditos</Muted>
                      </Badge>
                    </NameRow>
                  </CardHeader>

                  <CardBody>
                    <div>
                      <Muted style={{ display: "block", marginBottom: 6 }}>
                        Reservas
                      </Muted>

                      {user.reservations?.length ? (
                        <ReservationList>
                          {user.reservations.map((r) => (
                            <ReservationRow key={r._id}>
                              <Pill>
                                <b>{formatDate(r.date)}</b>
                                <Muted>·</Muted>
                                <span>{r.time}</span>
                                <PrivacyTag private={r.isPrivate}>
                                  {r.isPrivate ? "Privada" : "Pública"}
                                </PrivacyTag>
                              </Pill>

                              <IconButton
                                title="Eliminar reserva"
                                onClick={() => removeReservation(user._id, r._id)}
                                disabled={busy}
                              >
                                ×
                              </IconButton>
                            </ReservationRow>
                          ))}
                        </ReservationList>
                      ) : (
                        <Muted>Sin reservas</Muted>
                      )}
                    </div>

                    <Actions>
                      <Button onClick={() => handleAddCredits(user._id)} disabled={busy}>
                        Créditos
                      </Button>
                      <Button onClick={() => handleCreateReservation(user._id)} disabled={busy}>
                        Reserva
                      </Button>
                    </Actions>
                  </CardBody>
                </UserCard>
              ))}
            </CardsGrid>

            {/* DESKTOP TABLE */}
            <TableWrapper>
              <Table>
                <thead>
                  <tr>
                    <Th>Nombre</Th>
                    <Th>Email</Th>
                    <Th>Créditos</Th>
                    <Th>Reservas</Th>
                    <Th style={{ textAlign: "right" }}>Acciones</Th>
                  </tr>
                </thead>

                <tbody>
                  {filteredUsers.map((user) => (
                    <Tr key={user._id}>
                      <Td>{user.name || <Muted>Sin nombre</Muted>}</Td>
                      <Td>
                        <Muted style={{ wordBreak: "break-word" }}>{user.email}</Muted>
                      </Td>

                      <Td>
                        <Badge>
                          <b>{user.credits ?? 0}</b>
                          <Muted>créditos</Muted>
                        </Badge>
                      </Td>

                      <Td>
                        {user.reservations?.length ? (
                          <ReservationList>
                            {user.reservations.map((r) => (
                              <ReservationRow key={r._id}>
                                <Pill>
                                  <b>{formatDate(r.date)}</b>
                                  <Muted>·</Muted>
                                  <span>{r.time}</span>
                                  <PrivacyTag private={r.isPrivate}>
                                    {r.isPrivate ? "Privada" : "Pública"}
                                  </PrivacyTag>
                                </Pill>

                                <IconButton
                                  title="Eliminar reserva"
                                  onClick={() => removeReservation(user._id, r._id)}
                                  disabled={busy}
                                >
                                  ×
                                </IconButton>
                              </ReservationRow>
                            ))}
                          </ReservationList>
                        ) : (
                          <Muted>Sin reservas</Muted>
                        )}
                      </Td>

                      <Td>
                        <Actions>
                          <Button onClick={() => handleAddCredits(user._id)} disabled={busy}>
                            Modificar créditos
                          </Button>
                          <Button onClick={() => handleCreateReservation(user._id)} disabled={busy}>
                            Crear reserva
                          </Button>
                        </Actions>
                      </Td>
                    </Tr>
                  ))}
                </tbody>
              </Table>
            </TableWrapper>
          </>
        )}
      </AdminContainer>

      {/* PORTAL MODALS (outside AdminContainer to avoid iOS fixed/backdrop-filter bugs) */}
      <ModalPortal>
        {/* Modal créditos */}
        <Overlay
          show={showCreditsModal}
          onClick={() => (!busy ? setShowCreditsModal(false) : null)}
        />
        <Modal show={showCreditsModal} role="dialog" aria-modal="true">
          <SheetHandle />
          <ModalTitle>Modificar Créditos</ModalTitle>

          <Input
            type="number"
            value={credits}
            onChange={(e) => setCredits(e.target.value)}
            placeholder="Ingrese la cantidad (+ o -)"
            inputMode="numeric"
          />

          <Actions style={{ justifyContent: "flex-end" }}>
            <Button onClick={submitCredits} disabled={busy}>
              {busy ? "Guardando..." : "Confirmar"}
            </Button>
            <SecondaryButton onClick={() => setShowCreditsModal(false)} disabled={busy}>
              Cancelar
            </SecondaryButton>
          </Actions>
        </Modal>

        {/* Modal reservas */}
        <Overlay
          show={showReservationModal}
          onClick={() => (!busy ? setShowReservationModal(false) : null)}
        />
        <Modal show={showReservationModal} role="dialog" aria-modal="true">
          <SheetHandle />
          <ModalTitle>Crear Nueva Reserva</ModalTitle>

          <Calendar onClickDay={handleDateSelection} />

          <Input type="time" value={selectedTime} onChange={handleTimeSelection} />

          {isFirstReservation && (
            <RadioRow>
              <label>
                <input
                  type="radio"
                  checked={!isPrivate}
                  onChange={() => setIsPrivate(false)}
                />
                Pública
              </label>
              <label>
                <input
                  type="radio"
                  checked={isPrivate}
                  onChange={() => setIsPrivate(true)}
                />
                Privada
              </label>
            </RadioRow>
          )}

          <Actions style={{ justifyContent: "flex-end", marginTop: 12 }}>
            <Button onClick={addReservation} disabled={busy}>
              {busy ? "Creando..." : "Confirmar"}
            </Button>
            <SecondaryButton onClick={() => setShowReservationModal(false)} disabled={busy}>
              Cancelar
            </SecondaryButton>
          </Actions>
        </Modal>
      </ModalPortal>
    </PageShell>
  );
}
