"use client";

/**
 * MoonSection — sección de reservas de la Moonboard
 * Se embebe en reservas.js justo después del historial de visitas.
 *
 * Props:
 *   session        — sesión de next-auth
 *   canUseMoon     — bool: waiver firmado + perfil completo + acceso válido
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import axios from "axios";
import styled from "styled-components";

/* ─── Estilos locales (misma paleta que reservas.js) ─────────────────── */

const Wrap = styled.div`
  margin-top: 8px;
  display: grid;
  gap: 12px;
  width: 100%;
`;

const SectionTitle = styled.p`
  margin: 0;
  font-size: 13px;
  color: #2b2b2b;
  font-weight: 700;
`;

const ActiveCard = styled.div`
  background: #eaf4f6;
  border: 1px solid #a8d4db;
  border-radius: 12px;
  padding: 12px 14px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 10px;
`;

const ActiveInfo = styled.div`
  text-align: left;
`;

const ActiveTitle = styled.p`
  margin: 0;
  font-size: 13.5px;
  font-weight: 800;
  color: #1f1f1f;
`;

const ActiveMeta = styled.p`
  margin: 2px 0 0;
  font-size: 12.5px;
  color: #2f6f7a;
  font-weight: 600;
`;

const CancelBtn = styled.button`
  border: 0;
  border-radius: 10px;
  padding: 8px 12px;
  background: #f0e0d6;
  color: #9a4a23;
  font-weight: 800;
  font-size: 12px;
  cursor: pointer;
  white-space: nowrap;
`;

const DayTab = styled.div`
  display: flex;
  gap: 6px;
  overflow-x: auto;
  padding-bottom: 2px;
  scrollbar-width: none;
  &::-webkit-scrollbar { display: none; }
`;

const TabBtn = styled.button`
  flex-shrink: 0;
  border: 1px solid ${(p) => (p.$active ? "#2f6f7a" : "#e7e7e7")};
  border-radius: 10px;
  padding: 6px 12px;
  background: ${(p) => (p.$active ? "#2f6f7a" : "#fff")};
  color: ${(p) => (p.$active ? "#fff" : "#1f1f1f")};
  font-weight: 700;
  font-size: 12px;
  cursor: pointer;
  white-space: nowrap;
`;

const SlotGrid = styled.div`
  display: grid;
  gap: 8px;
`;

const SlotRow = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  border: 1px solid #e7e7e7;
  border-radius: 10px;
  padding: 10px 12px;
  background: ${(p) => (p.$mine ? "#eaf4f6" : p.$taken ? "#f7f7f7" : "#fff")};
  box-shadow: 0 2px 8px rgba(0,0,0,0.04);
`;

const SlotLabel = styled.span`
  font-size: 13px;
  font-weight: 700;
  color: ${(p) => (p.$past ? "#aaa" : "#1f1f1f")};
`;

const SlotStatus = styled.span`
  font-size: 12px;
  font-weight: 600;
  color: ${(p) => (p.$available ? "#2f6f7a" : p.$mine ? "#9a4a23" : "#aaa")};
`;

const ReserveBtn = styled.button`
  border: 0;
  border-radius: 8px;
  padding: 6px 12px;
  background: #9a4a23;
  color: #fff;
  font-weight: 800;
  font-size: 12px;
  cursor: pointer;
  &:disabled {
    background: #d3d3d3;
    cursor: not-allowed;
  }
`;

const SmallNote = styled.p`
  margin: 0;
  font-size: 12.5px;
  color: #6b6b6b;
  text-align: center;
`;

const Msg = styled.p`
  margin: 0;
  font-size: 12.5px;
  color: #9a4a23;
  font-weight: 600;
  text-align: center;
`;

/* ─── Helpers ─────────────────────────────────────────────────────────── */

const DAY_NAMES = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
const MONTH_NAMES = ["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"];

function formatTabDate(dateStr) {
  const [y, m, d] = dateStr.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  return `${DAY_NAMES[date.getDay()]} ${d} ${MONTH_NAMES[m - 1]}`;
}

function isTodayStr(dateStr) {
  const today = new Date();
  const todayStr = `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,"0")}-${String(today.getDate()).padStart(2,"0")}`;
  return dateStr === todayStr;
}

/* ─── Componente ─────────────────────────────────────────────────────── */

export default function MoonSection({ session, canUseMoon }) {
  const [days, setDays] = useState([]);
  const [myReservation, setMyReservation] = useState(null);
  const [selectedDay, setSelectedDay] = useState(0);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [msg, setMsg] = useState("");

  const fetchSlots = useCallback(async () => {
    if (!session) return;
    setLoading(true);
    try {
      const res = await axios.get("/api/moon/slots");
      setDays(res.data.days || []);
      setMyReservation(res.data.myReservation || null);
    } catch {
      setMsg("No pude cargar los slots.");
    } finally {
      setLoading(false);
    }
  }, [session]);

  useEffect(() => {
    fetchSlots();
  }, [fetchSlots]);

  const handleReserve = async (dateStr, hour) => {
    if (submitting) return;
    setSubmitting(true);
    setMsg("");
    try {
      await axios.post("/api/moon/reserve", { date: dateStr, startHour: hour });
      await fetchSlots();
      setMsg("✅ Reserva confirmada.");
    } catch (e) {
      const code = e?.response?.data?.code;
      const message = e?.response?.data?.message || "Error al reservar.";
      if (code === "ALREADY_RESERVED") setMsg("Ya tienes una reserva activa. Cancélala primero.");
      else if (code === "SLOT_TAKEN") setMsg("Ese slot ya fue tomado, elige otro.");
      else if (code === "PAST_HOUR") setMsg("Esa hora ya pasó.");
      else setMsg(message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancel = async () => {
    if (!myReservation || submitting) return;
    setSubmitting(true);
    setMsg("");
    try {
      await axios.post("/api/moon/cancel", { reservationId: myReservation._id });
      await fetchSlots();
      setMsg("Reserva cancelada.");
    } catch {
      setMsg("Error al cancelar.");
    } finally {
      setSubmitting(false);
    }
  };

  const currentDay = days[selectedDay];

  if (!session) return null;

  return (
    <Wrap>
      <SectionTitle>🌑 Moonboard — Reservar slot (1h 30min)</SectionTitle>

      {!canUseMoon ? (
        <SmallNote>
          Completa el waiver y tu perfil para poder reservar la moonboard.
        </SmallNote>
      ) : (
        <>
          {/* Reserva activa del usuario */}
          {myReservation && (
            <ActiveCard>
              <ActiveInfo>
                <ActiveTitle>Tu reserva activa</ActiveTitle>
                <ActiveMeta>
                  {formatTabDate(myReservation.date)}{isTodayStr(myReservation.date) ? " (hoy)" : ""} ·{" "}
                  {String(myReservation.startHour).padStart(2, "0")}:00 –{" "}
                  {String(myReservation.startHour + 1).padStart(2, "0")}:30
                </ActiveMeta>
              </ActiveInfo>
              <CancelBtn onClick={handleCancel} disabled={submitting}>
                {submitting ? "..." : "CANCELAR"}
              </CancelBtn>
            </ActiveCard>
          )}

          {/* Selector de día */}
          {loading ? (
            <SmallNote>Cargando slots…</SmallNote>
          ) : (
            <>
              <DayTab>
                {days.map((day, i) => (
                  <TabBtn
                    key={day.date}
                    $active={selectedDay === i}
                    onClick={() => { setSelectedDay(i); setMsg(""); }}
                  >
                    {day.isToday ? "Hoy" : formatTabDate(day.date)}
                  </TabBtn>
                ))}
              </DayTab>

              {currentDay && (
                <SlotGrid>
                  {currentDay.slots.map((slot) => (
                    <SlotRow
                      key={slot.hour}
                      $mine={slot.isMySlot}
                      $taken={slot.taken && !slot.isMySlot}
                    >
                      <SlotLabel $past={slot.isPast}>{slot.label}</SlotLabel>

                      {slot.isMySlot ? (
                        <SlotStatus $mine>Tu reserva ✓</SlotStatus>
                      ) : slot.isPast ? (
                        <SlotStatus>—</SlotStatus>
                      ) : slot.taken ? (
                        <SlotStatus>Ocupado</SlotStatus>
                      ) : (
                        <ReserveBtn
                          onClick={() => handleReserve(currentDay.date, slot.hour)}
                          disabled={submitting || !!myReservation}
                          title={myReservation ? "Ya tienes una reserva activa" : ""}
                        >
                          RESERVAR
                        </ReserveBtn>
                      )}
                    </SlotRow>
                  ))}
                </SlotGrid>
              )}
            </>
          )}

          {msg && <Msg>{msg}</Msg>}
        </>
      )}
    </Wrap>
  );
}