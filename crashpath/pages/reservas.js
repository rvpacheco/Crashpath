"use client";

import { useEffect, useState } from 'react';
import { signIn, signOut, useSession } from 'next-auth/react';
import styled from 'styled-components';
import axios from 'axios';
import { Calendar } from 'rsuite';
import 'rsuite/dist/rsuite.min.css';
import { useRouter } from 'next/router';
import Link from 'next/link';

const Container = styled.main`
  min-height: 100vh;
  display: grid;
  place-items: center;
  padding: 24px 16px;
`;

const Card = styled.section`
  width: 100%;
  max-width: 360px;
  text-align: center;
  display: grid;
  gap: 16px;
`;

const WelcomeRow = styled.h1`
  margin: 0;
  font-size: 18px;
  font-weight: 700;
  letter-spacing: .06em;
  text-transform: uppercase;
  color: #1E1E1E;
`;

const BrushName = styled.span`
  font-family: var(--font-brush);
  color: #9a4a23;
  text-transform: none;
`;

const Credits = styled.p`
  margin: 0;
  font-size: 13.5px;
  color: #1f1f1f;
  strong{ color:#9a4a23; }
`;

const Sub = styled.p`
  margin: 0 0 6px;
  font-size: 14px;
  font-weight: 700;
  color: #b5632e;
`;

const CalendarWrap = styled.div`
  display: grid;
  place-items: center;

  .rs-calendar {
    background: #fff;
    border-radius: 12px;
    border: 1px solid #e7e7e7;
    box-shadow: 0 6px 18px rgba(0,0,0,.08);
    padding: 10px;
    width: 100%;
    max-width: 320px;
  }
  .rs-calendar-header-title,
  .rs-calendar-header-title > button {
    font-weight: 600;
  }
  .rs-calendar-table-cell-selected .rs-calendar-table-cell-content {
    background: #FDFD76;
  }
`;

const Controls = styled.div`
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
  align-items: center;
  width: 100%;
  max-width: 360px;
`;

const TimePill = styled.select`
  width: 100%;
  border: 0;
  border-radius: 10px;
  height: 44px;
  text-align: center;
  font-weight: 800;
  letter-spacing: .02em;
  background: #9a4a23;
  color: #fff;
  box-shadow: 0 2px 0 rgba(0,0,0,.12);
  cursor: pointer;
  appearance: none;

  /* opcional: centrar el texto en algunos móviles */
  padding: 0 12px;
`;

const ReserveBtn = styled.button`
  width: 100%;
  border: 0;
  border-radius: 10px;
  height: 44px;
  background: #9a4a23;
  color: #fff;
  font-weight: 700;
  letter-spacing: .04em;
  cursor: pointer;
  box-shadow: 0 2px 0 rgba(0,0,0,.12);
  transition: transform .02s ease, box-shadow .2s ease, filter .2s ease;
  &:active{ transform: translateY(1px); box-shadow: 0 1px 0 rgba(0,0,0,.12); }
  &:disabled{ background:#d3d3d3; cursor:not-allowed; }
`;

const SectionTitle = styled.p`
  margin: 6px 0 0;
  font-size: 13px;
  color: #2b2b2b;
`;

const Logout = styled.button`
  width: 100%;
  max-width: 220px;
  margin: 6px auto 0;
  border: 0;
  border-radius: 10px;
  height: 40px;
  background: #9bbfd0;
  color: #0f2b30;
  font-weight: 700;
  cursor: pointer;
  box-shadow: 0 2px 0 rgba(0,0,0,.12);
`;

const FooterLink = styled(Link)`
  display: inline-block;
  margin-top: 8px;
  font-size: 12.5px;
  color: #2b8dfc;
  text-decoration: underline;
`;

const BrushTitle = styled.h2`
  font-family: var(--font-brush);
  font-size: 28px;
  line-height: 1.1;
  margin: 0;
  color: #9a4a23;
  text-transform: uppercase;
  letter-spacing: 0.02em;
`;

const Body = styled.div`
  color: #2c2c2c;
  font-size: 14px;
  line-height: 1.55;
  margin-top: 4px;
  p { margin: 0 0 10px; }
  strong { font-weight: 700; }
`;

const SmallNote = styled.p`
  margin: 0;
  font-size: 13px;
  color: #3a3a3a;
`;

const ModalOverlay = styled.div`
  position: fixed;
  inset: 0;
  background-color: rgba(0,0,0,0.5);
  display: flex; align-items: center; justify-content: center;
  padding: 16px;
  z-index: 50;
`;

/* Modales con gecko */
const FrogCard = styled.div`
  position: relative;
  background: #fff;
  width: 100%;
  max-width: 360px;
  border-radius: 16px;
  padding: 64px 18px 20px;
  box-shadow: 0 12px 28px rgba(0,0,0,0.18);
  text-align: center;
`;

const FrogImg = styled.img`
  position: absolute;
  left: 50%;
  transform: translateX(-50%);
  top: -95px;
  width: 140px;
  height: auto;
`;

const FrogClose = styled.button`
  position: absolute;
  right: 14px;
  top: 12px;
  border: 0;
  background: transparent;
  font-size: 22px;
  color: #9a4a23;
  cursor: pointer;
`;

const FrogSub = styled.p`
  margin: 0 0 6px;
  font-size: 13.5px;
  color: #5a5a5a;
`;

const FrogBrush = styled.h3`
  font-family: var(--font-brush);
  margin: 2px 0 12px;
  font-size: 30px;
  letter-spacing: 0.02em;
  color: #9a4a23;
  text-transform: uppercase;
`;

const FrogBody = styled.p`
  margin: 0 0 12px;
  font-size: 13.5px;
  line-height: 1.5;
  color: #3a3a3a;
`;

const FrogRow = styled.div`
  display: flex;
  gap: 12px;
  justify-content: center;
`;

const PublicBtn = styled.button`
  border: 0;
  border-radius: 12px;
  padding: 12px 18px;
  font-weight: 800;
  letter-spacing: .02em;
  cursor: pointer;
  color: #fff;
  background: #9a4a23;
  box-shadow: 0 2px 0 rgba(0,0,0,.12);
  transition: transform .02s ease, box-shadow .2s ease, filter .2s ease;
  &:active{ transform: translateY(1px); box-shadow: 0 1px 0 rgba(0,0,0,.12); }
  &:hover{ filter: brightness(.98); }
  min-width: 120px;
`;
const PrivateBtn = styled(PublicBtn)` background:#2f6f7a; `;
const NeutralBtn = styled(PublicBtn)` background:#7aaab0; color:#0f2b30; font-weight:700; `;

/* Lista de reservas */
const ResList = styled.ul`
  list-style: none;
  padding: 0;
  margin: 6px 0 0;
  display: grid;
  gap: 8px;
`;

const ResItem = styled.li`
  background: #fff;
  border: 1px solid #e7e7e7;
  border-radius: 10px;
  padding: 10px 12px;
  box-shadow: 0 4px 12px rgba(0,0,0,.06);
  display: flex;
  justify-content: space-between;
  align-items: center;
`;

const ResTitle = styled.span`
  font-size: 13.5px;
  color: #1f1f1f;
  font-weight: 600;
`;

const ResMeta = styled.span`
  display: block;
  font-size: 12.5px;
  color: #6b6b6b;
  margin-top: 2px;
`;

const Badge = styled.span`
  font-size: 11px;
  padding: 4px 8px;
  border-radius: 999px;
  background: ${p => (p.$private ? '#2f6f7a' : '#9a4a23')};
  color: #fff;
  font-weight: 700;
`;

const toISODate = (d) => new Date(d).toISOString().split('T')[0];
const pad2 = (n) => String(n).padStart(2, '0');

const buildTimeSlots = (startHour = 8, endHour = 20, stepMinutes = 30) => {
  const out = [];
  for (let h = startHour; h <= endHour; h++) {
    for (let m = 0; m < 60; m += stepMinutes) {
      if (h === endHour && m > 0) break; // solo permite 20:00 exacto
      out.push(`${pad2(h)}:${pad2(m)}`);
    }
  }
  return out;
};

const TIME_SLOTS = buildTimeSlots(8, 20, 30);
export default function Home() {
  const { data: session } = useSession();
  const [userData, setUserData] = useState({ credits: 0, reservations: [] });
  const [busySlots, setBusySlots] = useState([]);
  const [selectedDate, setSelectedDate] = useState(null);
  const [selectedTime, setSelectedTime] = useState('');
  const [message, setMessage] = useState('');
  const [showReservationModal, setShowReservationModal] = useState(false);
  const [showNoSpaceModal, setShowNoSpaceModal] = useState(false);
  const [isFirstReservation, setIsFirstReservation] = useState(false);
  const [isPrivate, setIsPrivate] = useState(false);
  const [reservationsAtTime, setReservationsAtTime] = useState(0);
  const [showConsentModal, setShowConsentModal] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [showPrivateSlotModal, setShowPrivateSlotModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const router = useRouter();

  useEffect(() => {
    if (session) {
      if (session.isAdmin) {
        router.push('/admin');
      } else {
        axios.get('/api/user').then((res) => setUserData(res.data));
        axios.get('/api/calendar').then((res) => setBusySlots(res.data.busySlots || []));
      }
    }
  }, [session, router]);

  useEffect(() => {
    if (session && (!Array.isArray(userData.reservations) || userData.reservations.length === 0)) {
      axios.get('/api/reservations')
        .then(r => {
          if (Array.isArray(r.data)) {
            setUserData(u => ({ ...u, reservations: r.data }));
          }
        })
        .catch(() => { });
    }
  }, [session, userData.reservations]);

  const handleSignIn = () => setShowConsentModal(true);
  const handleAccept = () => { setShowConsentModal(false); signIn('google'); };
  const handleReject = () => setShowConsentModal(false);

  const handleTimeSelection = (e) => {
    const value = e.target.value;
    if (!value) { setSelectedTime(''); return; }

    const [hours, minutes] = value.split(':').map(Number);

    const isTooEarly = hours < 8;
    const isTooLate = hours > 20 || (hours === 20 && minutes > 0);

    if (isTooEarly || isTooLate) {
      setMessage('Por favor selecciona una hora entre las 08:00 y las 20:00.');
      setSelectedTime('');
      return;
    }

    setMessage('');
    setSelectedTime(value);
  };
  const handleReservation = async () => {
    if (!selectedDate) { setMessage('Por favor selecciona una fecha'); return; }
    if (!selectedTime) { setMessage('Por favor selecciona una hora válida'); return; }

    const [h, m] = selectedTime.split(':').map(Number);
    const when = new Date(selectedDate);
    when.setHours(h); when.setMinutes(m); when.setSeconds(0); when.setMilliseconds(0);

    const now = new Date();
    const hoursDiff = (when.getTime() - now.getTime()) / (1000 * 60 * 60);
    if (hoursDiff < 18) { setMessage('Las reservas deben hacerse al menos 18 horas antes.'); return; }

    try {
      const res = await axios.post('/api/check-reservations', {
        date: toISODate(selectedDate),
        time: selectedTime,
      });

      const count = res.data?.count ?? 0;
      setReservationsAtTime(count);

      if (res.data?.isPrivate) { setShowPrivateSlotModal(true); return; }
      if (count >= 3) { setShowNoSpaceModal(true); return; }

      if (count === 0) {
        setIsFirstReservation(true);
        setShowReservationModal(true);
      } else {
        setIsFirstReservation(false);
        setShowConfirmModal(true);
      }
    } catch (error) {
      setMessage(error?.response?.data?.message ?? 'Error al verificar disponibilidad');
    }
  };

  const finalizeReservation = async () => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    try {
      const payload = {
        date: toISODate(selectedDate),
        time: selectedTime,
        isPrivate,
      };
      const res = await axios.post('/api/reserve', payload);
      setMessage(res.data?.message ?? 'Reserva realizada');

      const updated = await axios.get('/api/user');
      setUserData(updated.data);

      setShowConfirmModal(false);
      setShowReservationModal(false);
    } catch (error) {
      setMessage(error?.response?.data?.message ?? 'Error al reservar');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Container>
      {!session ? (
        <Card>
          <WelcomeRow>Bienvenid@ a la reserva de</WelcomeRow>
          <BrushTitle>La Moon de CrashPath</BrushTitle>
          <Body>
            <p><strong>CrashPath Moon</strong> es una plataforma donde puedes reservar el tiempo de uso de la moonboard y la zona de entrenamiento de CrashPath.</p>
            <p>Puedes elegir la <strong>fecha y hora</strong>, automáticamente la reservamos para ti y se agendará en tu calendario de Google.</p>
            <SmallNote>Inicia sesión para ver tus créditos disponibles y hacer una reserva</SmallNote>
          </Body>
          <ReserveBtn onClick={handleSignIn}>Inicia sesión con Google</ReserveBtn>
          <FooterLink href="/privacy">Conoce nuestra política de privacidad</FooterLink>
        </Card>
      ) : (
        <Card>
          <WelcomeRow>
            Bienvenid@, <BrushName>{session.user.name}</BrushName>
          </WelcomeRow>
          <Credits>Tienes <strong>{userData.credits}</strong> créditos disponibles</Credits>
          <Sub>Selecciona fecha y hora para tu reserva</Sub>

          <CalendarWrap>
            <Calendar compact onSelect={(date) => setSelectedDate(date)} value={selectedDate} />
          </CalendarWrap>

          <Controls>
            <TimePill value={selectedTime} onChange={handleTimeSelection}>
              <option value="">--:--</option>
              {TIME_SLOTS.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </TimePill>
            <ReserveBtn
              onClick={handleReservation}
              disabled={!selectedDate || !selectedTime || userData.credits <= 0}
            >
              Reservar
            </ReserveBtn>
          </Controls>

          <SectionTitle>Tus reservas</SectionTitle>

          {Array.isArray(userData.reservations) && userData.reservations.length > 0 ? (
            <ResList>
              {userData.reservations.map((r, idx) => {
                const key = r._id || `${r.date}-${r.time}-${idx}`;
                const dateObj = r.date ? new Date(r.date) : null;
                const dateStr = r.date
                  ? (isNaN(dateObj?.getTime?.()) ? String(r.date) : dateObj.toLocaleDateString())
                  : '';
                const timeStr = r.time || r.hour || '';
                const isPriv = !!r.isPrivate;
                return (
                  <ResItem key={key}>
                    <div>
                      <ResTitle>{dateStr}{timeStr ? ` — ${timeStr}` : ''}</ResTitle>
                      <ResMeta>{isPriv ? 'Sesión privada' : 'Sesión pública'}</ResMeta>
                    </div>
                    <Badge $private={isPriv}>{isPriv ? 'Privada' : 'Pública'}</Badge>
                  </ResItem>
                );
              })}
            </ResList>
          ) : (
            <SmallNote>No tienes reservas activas.</SmallNote>
          )}

          <Logout onClick={() => signOut()}>Cerrar sesión</Logout>
          <FooterLink href="/privacy">Conoce nuestra política de privacidad</FooterLink>
          {message && <SmallNote>{message}</SmallNote>}
        </Card>
      )}

      {showReservationModal && (
        <ModalOverlay>
          <FrogCard>
            <FrogClose onClick={() => setShowReservationModal(false)}>×</FrogClose>
            <FrogImg src="/gecko.png" alt="Gecko" />
            <FrogSub>¿Cómo deseas reservar</FrogSub>
            <FrogBrush>La Moonboard?</FrogBrush>
            <FrogBody>Si eliges privada, nadie más podrá reservar en esta franja horaria. Si eliges pública, se pueden agregar hasta 3 personas más.</FrogBody>
            <FrogRow>
              <PublicBtn onClick={() => { setIsPrivate(false); setShowReservationModal(false); setShowConfirmModal(true); }}>PÚBLICA</PublicBtn>
              <PrivateBtn onClick={() => { setIsPrivate(true); setShowReservationModal(false); setShowConfirmModal(true); }}>PRIVADA</PrivateBtn>
            </FrogRow>
          </FrogCard>
        </ModalOverlay>
      )}

      {showConfirmModal && (
        <ModalOverlay>
          <FrogCard>
            <FrogClose onClick={() => setShowConfirmModal(false)}>×</FrogClose>
            <FrogImg src="/gecko.png" alt="Gecko" />
            <FrogSub>Confirmar</FrogSub>
            <FrogBrush>Tu reserva</FrogBrush>
            <FrogBody>
              ¿Reservar a las <strong>{selectedTime}</strong> del día <strong>{selectedDate ? new Date(selectedDate).toLocaleDateString() : ''}</strong>?
            </FrogBody>
            <FrogRow>
              <PublicBtn onClick={finalizeReservation} disabled={isSubmitting}>
                {isSubmitting ? 'Reservando...' : 'CONFIRMAR'}
              </PublicBtn>
              <NeutralBtn onClick={() => setShowConfirmModal(false)} disabled={isSubmitting}>
                CANCELAR
              </NeutralBtn>
            </FrogRow>
          </FrogCard>
        </ModalOverlay>
      )}

      {showPrivateSlotModal && (
        <ModalOverlay>
          <FrogCard>
            <FrogClose onClick={() => setShowPrivateSlotModal(false)}>×</FrogClose>
            <FrogImg src="/gecko.png" alt="Gecko" />
            <FrogSub>Ups…</FrogSub>
            <FrogBrush>Franja privada</FrogBrush>
            <FrogBody>Esta franja horaria ya es privada. Por favor, selecciona otra hora.</FrogBody>
            <FrogRow>
              <PublicBtn onClick={() => setShowPrivateSlotModal(false)}>ENTENDIDO</PublicBtn>
            </FrogRow>
          </FrogCard>
        </ModalOverlay>
      )}

      {showNoSpaceModal && (
        <ModalOverlay>
          <FrogCard>
            <FrogClose onClick={() => setShowNoSpaceModal(false)}>×</FrogClose>
            <FrogImg src="/gecko.png" alt="Gecko" />
            <FrogSub>Lo sentimos</FrogSub>
            <FrogBrush>Sin cupos</FrogBrush>
            <FrogBody>No quedan cupos para esta hora/día.</FrogBody>
            <FrogRow>
              <PublicBtn onClick={() => setShowNoSpaceModal(false)}>OK</PublicBtn>
            </FrogRow>
          </FrogCard>
        </ModalOverlay>
      )}

      {showConsentModal && (
        <ModalOverlay>
          <FrogCard>
            <FrogClose onClick={() => setShowConsentModal(false)}>×</FrogClose>
            <FrogImg src="/gecko.png" alt="Gecko" />
            <FrogSub>Consentimiento para utilizar</FrogSub>
            <FrogBrush>Google Calendar</FrogBrush>
            <FrogBody>Esta aplicación requiere acceso a tu Google Calendar para poder agregar eventos.</FrogBody>
            <FrogRow>
              <PublicBtn onClick={handleAccept}>ACEPTAR</PublicBtn>
              <NeutralBtn onClick={handleReject}>RECHAZAR</NeutralBtn>
            </FrogRow>
          </FrogCard>
        </ModalOverlay>
      )}
    </Container>
  );
}
