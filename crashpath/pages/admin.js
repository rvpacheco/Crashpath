import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useSession, signIn, signOut } from "next-auth/react";
import { useRouter } from "next/router";
import axios from "axios";
import styled, { createGlobalStyle } from "styled-components";
import Calendar from "react-calendar";
import "react-calendar/dist/Calendar.css";

/* -------------------- THEME -------------------- */
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

  @media (prefers-reduced-motion: reduce) {
    * { scroll-behavior: auto !important; transition: none !important; animation: none !important; }
  }

  body.modal-open {
    overflow: hidden;
    touch-action: none;
  }
`;

/* -------------------- LAYOUT -------------------- */
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

const CheckinButton = styled.button`
  background: ${palette.accent};
  color: #fff;
  padding: 11px 12px;
  border: none;
  border-radius: 12px;
  cursor: pointer;
  font-size: 14px;
  font-weight: 800;
  letter-spacing: .01em;
  min-height: 44px;
  box-shadow: 0 10px 22px rgba(156,79,36,0.22);
  transition: transform .12s ease, filter .12s ease;
  opacity: ${(p) => (p.disabled ? 0.65 : 1)};

  &:hover { filter: brightness(0.92); transform: translateY(-1px); }
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

/* -------------------- FILTERS + AUDIT UI -------------------- */
const Row = styled.div`
  display: grid;
  gap: 10px;

  @media (min-width: 900px) {
    grid-template-columns: 1fr 360px;
    align-items: start;
  }
`;

const FiltersBar = styled.div`
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  padding: 4px 6px 0;
`;

const FilterChip = styled.button`
  border: 1px solid ${palette.border};
  background: ${(p) => (p.$active ? "rgba(156,79,36,0.14)" : "rgba(255,255,255,0.60)")};
  color: ${(p) => (p.$active ? palette.accent : palette.text)};
  border-radius: 999px;
  padding: 8px 10px;
  font-size: 12.5px;
  font-weight: 800;
  cursor: pointer;

  &:hover { background: rgba(255,255,255,0.85); }
  &:focus-visible { outline: none; box-shadow: 0 0 0 4px ${palette.focus}; }
`;

const AuditPanel = styled.aside`
  display: none;

  @media (min-width: 900px) {
    display: grid;
    gap: 10px;
    border: 1px solid ${palette.border};
    background: rgba(255,255,255,0.60);
    border-radius: 16px;
    padding: 12px;
    box-shadow: 0 10px 24px rgba(0,0,0,0.06);
    position: sticky;
    top: 18px;
    max-height: calc(100vh - 48px);
    overflow: auto;
  }
`;

const AuditTitle = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  gap: 10px;

  h3 {
    margin: 0;
    font-size: 14px;
    color: ${palette.text};
    letter-spacing: .02em;
  }
`;

const AuditList = styled.div`
  display: grid;
  gap: 8px;
`;

const AuditItem = styled.div`
  border: 1px solid rgba(0,0,0,0.06);
  background: rgba(255,255,255,0.70);
  border-radius: 14px;
  padding: 10px;
`;

const AuditLine = styled.div`
  font-size: 13px;
  color: ${palette.text};
  line-height: 1.35;
  b { font-weight: 900; }
`;

const AuditMeta = styled.div`
  margin-top: 6px;
  font-size: 12px;
  color: ${palette.muted};
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
`;

/* -------------------- TABLE / CARDS -------------------- */
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

/* -------------------- MODALS -------------------- */
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

const Select = styled.select`
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

const SuccessBox = styled.div`
  margin-top: 12px;
  padding: 10px 12px;
  border-radius: 12px;
  border: 1px solid rgba(46,158,86,0.30);
  background: rgba(46,158,86,0.10);
  color: ${palette.text};
  font-size: 13px;
  font-weight: 800;
`;

const EmptyState = styled.div`
  padding: 14px;
  border-radius: 14px;
  border: 1px dashed rgba(43,38,32,0.22);
  background: rgba(255,255,255,0.55);
`;

const LinkButton = styled.a`
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 10px 12px;
  border-radius: 12px;
  background: rgba(255,255,255,0.75);
  border: 1px solid ${palette.border};
  color: ${palette.text};
  font-size: 13.5px;
  font-weight: 800;
  text-decoration: none;
  line-height: 1;
  box-shadow: 0 10px 22px rgba(0,0,0,0.08);
  transition: transform .12s ease, filter .12s ease, background .12s ease;

  &:hover {
    background: rgba(255,255,255,0.95);
    filter: brightness(0.98);
    transform: translateY(-1px);
  }
  &:active { transform: translateY(0px); }
  &:focus-visible { outline: none; box-shadow: 0 0 0 4px ${palette.focus}; }
`;

const LinkPill = styled.span`
  display: inline-grid;
  place-items: center;
  width: 28px;
  height: 28px;
  border-radius: 10px;
  background: rgba(156,79,36,0.14);
  border: 1px solid rgba(156,79,36,0.18);
  color: ${palette.accent};
  font-size: 16px;
`;

const CheckinInfoRow = styled.div`
  display: flex;
  gap: 8px;
  align-items: center;
  flex-wrap: wrap;
  padding: 10px 0;
`;

const WaiverBox = styled.div`
  border: 1px solid ${palette.border};
  border-radius: 12px;
  padding: 10px;
  background: rgba(255,255,255,0.80);
  max-height: 220px;
  overflow: auto;
  color: ${palette.text};
  font-size: 13.5px;
  line-height: 1.5;
`;

const MinorBanner = styled.div`
  margin-bottom: 10px;
  padding: 8px 12px;
  border-radius: 10px;
  background: rgba(156,79,36,0.10);
  border: 1px solid rgba(156,79,36,0.25);
  color: ${palette.accent};
  font-size: 13px;
  font-weight: 800;
`;

const CheckboxRow = styled.label`
  display: flex;
  gap: 10px;
  align-items: flex-start;
  text-align: left;
  font-size: 13px;
  color: ${palette.text};
  line-height: 1.35;
  margin-top: 10px;
`;

const SigWrap = styled.div`
  margin-top: 10px;
  text-align: left;
`;

const SigCanvas = styled.canvas`
  width: 100%;
  height: 140px;
  border-radius: 12px;
  border: 1px dashed rgba(43,38,32,0.35);
  background: rgba(255,255,255,0.90);
  touch-action: none;
`;

const SigRow = styled.div`
  display: flex;
  gap: 10px;
  margin-top: 8px;
  justify-content: space-between;
  align-items: center;
`;

const TinyBtn = styled.button`
  border: 1px solid ${palette.border};
  background: rgba(255,255,255,0.75);
  border-radius: 12px;
  padding: 10px 12px;
  cursor: pointer;
  font-weight: 800;
  color: ${palette.text};

  &:hover { background: rgba(255,255,255,0.95); }
  &:focus-visible { outline: none; box-shadow: 0 0 0 4px ${palette.focus}; }
`;

const MensualidadBadge = styled.span`
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 5px 10px;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 800;
  border: 1px solid ${(p) => p.$active ? "rgba(46,158,86,0.30)" : "rgba(216,74,74,0.30)"};
  background: ${(p) => p.$active ? "rgba(46,158,86,0.12)" : "rgba(216,74,74,0.10)"};
  color: ${(p) => (p.$active ? palette.success : palette.danger)};
`;

const AccessTypePill = styled.span`
  display: inline-flex;
  align-items: center;
  padding: 3px 9px;
  border-radius: 999px;
  font-size: 11px;
  font-weight: 800;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  border: 1px solid ${palette.border};
  background: ${(p) => p.$type === "mensualidad" ? "rgba(156,79,36,0.12)" : "rgba(43,38,32,0.07)"};
  color: ${(p) => p.$type === "mensualidad" ? palette.accent : palette.muted};
`;

const RenovarBtn = styled.button`
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 8px 12px;
  border-radius: 12px;
  border: 1px solid rgba(156,79,36,0.35);
  background: rgba(156,79,36,0.10);
  color: ${palette.accent};
  font-size: 13px;
  font-weight: 800;
  cursor: pointer;
  transition: background 0.15s ease, transform 0.12s ease;

  &:hover { background: rgba(156,79,36,0.18); transform: translateY(-1px); }
  &:disabled { opacity: 0.6; cursor: not-allowed; transform: none; }
  &:focus-visible { outline: none; box-shadow: 0 0 0 4px ${palette.focus}; }
`;

/* -------------------- HELPERS -------------------- */
const formatDate = (date) => {
  try {
    return new Date(date).toLocaleDateString("es-CO");
  } catch {
    return "Fecha inválida";
  }
};

const formatDateTime = (date) => {
  try {
    return new Date(date).toLocaleString("es-CO");
  } catch {
    return "—";
  }
};

function sameDay(a, b) {
  if (!a || !b) return false;
  const A = new Date(a);
  const B = new Date(b);
  return (
    A.getFullYear() === B.getFullYear() &&
    A.getMonth() === B.getMonth() &&
    A.getDate() === B.getDate()
  );
}

/**
 * Para "check-in hoy" en UI:
 * - soporta:
 *   - user.checkedInToday (ideal)
 *   - user.lastCheckinAt
 *   - user.lastVisitAt
 */
function hasCheckedInToday(user) {
  const today = new Date();
  if (user?.checkedInToday === true) return true;
  if (user?.lastCheckinAt) return sameDay(user.lastCheckinAt, today);
  if (user?.lastVisitAt) return sameDay(user.lastVisitAt, today);
  return false;
}

function getMensualidadStatus(mensualidad) {
  if (!mensualidad?.endDate) return { active: false, label: "Sin mensualidad", days: null };
  const now = new Date();
  const end = new Date(mensualidad.endDate);
  const active = end > now;
  const days = Math.ceil((end - now) / (1000 * 60 * 60 * 24));
  const label = active
    ? `Activa · vence ${end.toLocaleDateString("es-CO")}`
    : `Vencida ${end.toLocaleDateString("es-CO")}`;
  return { active, label, days };
}

function userCanCheckin(user) {
  if (user?.accessType === "ticketera") return (user.credits ?? 0) > 0;
  if (user?.accessType === "mensualidad") return getMensualidadStatus(user.mensualidad).active;
  return false;
}

function AccessInfo({ user, onRenovar, busy }) {
  if (user.accessType === "mensualidad") {
    const { active, label } = getMensualidadStatus(user.mensualidad);
    return (
      <div style={{ display: "grid", gap: 6 }}>
        <AccessTypePill $type="mensualidad">Mensualidad</AccessTypePill>
        <MensualidadBadge $active={active}>
          {active ? "🟢" : "🔴"} {label}
        </MensualidadBadge>
        <RenovarBtn onClick={() => onRenovar(user._id)} disabled={busy}>
          🔄 {active ? "Extender" : "Renovar"}
        </RenovarBtn>
      </div>
    );
  }
  return (
    <div style={{ display: "grid", gap: 6 }}>
      <AccessTypePill $type="ticketera">Tiquetera</AccessTypePill>
      <Badge>
        <b>{user.credits ?? 0}</b>
        <Muted>créditos</Muted>
      </Badge>
    </div>
  );
}

function ModalPortal({ children }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return null;
  return createPortal(children, document.body);
}

function normalizeDocType(v) {
  return typeof v === "string" ? v.trim().toUpperCase() : v;
}

function isCanvasBlank(canvas) {
  if (!canvas) return true;
  const ctx = canvas.getContext("2d");
  if (!ctx) return true;
  const { width, height } = canvas;
  const data = ctx.getImageData(0, 0, width, height).data;
  for (let i = 3; i < data.length; i += 4) {
    if (data[i] !== 0) return false;
  }
  return true;
}

const INITIAL_FORM = {
  name: "",
  email: "",
  documentType: "CC",
  documentNumber: "",
  phone: "",
  epsName: "",
  emergencyContactName: "",
  emergencyContactPhone: "",
  accessType: "ticketera",
  mensualidadMeses: 1,
  esMinor: false,
};

/**
 * -------------------- Audit event shape (desde backend) --------------------
 * {
 *   _id,
 *   ts,                // Date
 *   action,            // "CHECKIN" | "ADJUST_CREDITS" | ...
 *   actorEmail,        // admin email
 *   actorName,
 *   userId,
 *   userName,
 *   userEmail,
 *   summary,           // string listo para UI
 *   meta: {}           // opcional
 * }
 */
function AuditFeed({ events, onReload, loading }) {
  return (
    <AuditPanel>


        <AuditList>
          {events.map((e) => (
            <AuditItem key={e._id || `${e.ts}-${e.action}-${e.userId || "x"}`}>
              <AuditLine>
                {e.summary ? (
                  <span>{e.summary}</span>
                ) : (
                  <>
                    <b>{e.action}</b> · {e.userName || e.userEmail || "Usuario"} · por{" "}
                    <b>{e.actorName || e.actorEmail || "admin"}</b>
                  </>
                )}
              </AuditLine>
              <AuditMeta>
                <span>{formatDateTime(e.ts)}</span>
                {e.userEmail ? <span>· {e.userEmail}</span> : null}
              </AuditMeta>
            </AuditItem>
          ))}
        </AuditList>
 
    </AuditPanel>
  );
}

export default function AdminPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);

  // Audit
  const [auditEvents, setAuditEvents] = useState([]);
  const [auditLoading, setAuditLoading] = useState(false);

  // Quick filters
  const [quickFilter, setQuickFilter] = useState("all"); // all | waiver | mensualidadVencida | sinCreditos | menores | checkinHoy

  const [showCreditsModal, setShowCreditsModal] = useState(false);
  const [showReservationModal, setShowReservationModal] = useState(false);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [showNewUserModal, setShowNewUserModal] = useState(false);
  const [showRenovarModal, setShowRenovarModal] = useState(false);
  const [showCheckinModal, setShowCheckinModal] = useState(false);
  const [newUserStep, setNewUserStep] = useState(1);

  const [newUserForm, setNewUserForm] = useState(INITIAL_FORM);

  const [waiverAccepted, setWaiverAccepted] = useState(false);
  const canvasRef = useRef(null);
  const drawingRef = useRef(false);
  const hasInkRef = useRef(false);
  const lastPointRef = useRef({ x: 0, y: 0 });

  const [selectedUser, setSelectedUser] = useState(null);
  const [viewingUser, setViewingUser] = useState(null);
  const [checkinUser, setCheckinUser] = useState(null);
  const [checkinSuccess, setCheckinSuccess] = useState("");

  const [credits, setCredits] = useState(0);
  const [renovarMonths, setRenovarMonths] = useState(1);

  const [selectedDate, setSelectedDate] = useState(null);
  const [selectedTime, setSelectedTime] = useState("");
  const [isPrivate, setIsPrivate] = useState(false);
  const [isFirstReservation, setIsFirstReservation] = useState(false);

  const [query, setQuery] = useState("");
  const [uiError, setUiError] = useState("");
  const [busy, setBusy] = useState(false);

  const didInit = useRef(false);

  const waiverCityLine = `Bucaramanga, Santander — ${new Date().toLocaleDateString("es-CO")}`;

  useEffect(() => {
    if (didInit.current) return;
    if (status === "loading") return;
    didInit.current = true;
    if (!session) { signIn(); return; }
    if (!session.isAdmin) { router.push("/"); return; }
    fetchUsers();
    fetchAudit(); // ✅ inicial
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

  const fetchAudit = async () => {
    setAuditLoading(true);
    try {
      const res = await axios.get("/api/admin/audit?limit=40");
      setAuditEvents(Array.isArray(res.data?.events) ? res.data.events : []);
    } catch (e) {
      // no bloquea el panel si falla
      console.warn("Audit fetch failed:", e?.message);
    } finally {
      setAuditLoading(false);
    }
  };

  const counts = useMemo(() => {
    const total = users.length;
    const waiverPend = users.filter((u) => u?.waiverStatus !== "signed").length;
    const mensualidadVencida = users.filter((u) =>
      u?.accessType === "mensualidad" && !getMensualidadStatus(u?.mensualidad).active
    ).length;
    const sinCreditos = users.filter((u) =>
      u?.accessType === "ticketera" && (u?.credits ?? 0) <= 0
    ).length;
    const menores = users.filter((u) => !!u?.esMinor).length;
    const checkinHoy = users.filter((u) => hasCheckedInToday(u)).length;

    return { total, waiverPend, mensualidadVencida, sinCreditos, menores, checkinHoy };
  }, [users]);

  const filteredUsers = useMemo(() => {
    const q = query.trim().toLowerCase();

    let list = users;

    // Search
    if (q) {
      list = list.filter((u) => {
        const name = (u?.name || "").toLowerCase();
        const email = (u?.email || "").toLowerCase();
        return name.includes(q) || email.includes(q);
      });
    }

    // Quick filter
    switch (quickFilter) {
      case "waiver":
        list = list.filter((u) => u?.waiverStatus !== "signed");
        break;
      case "mensualidadVencida":
        list = list.filter((u) => u?.accessType === "mensualidad" && !getMensualidadStatus(u?.mensualidad).active);
        break;
      case "sinCreditos":
        list = list.filter((u) => u?.accessType === "ticketera" && (u?.credits ?? 0) <= 0);
        break;
      case "menores":
        list = list.filter((u) => !!u?.esMinor);
        break;
      case "checkinHoy":
        list = list.filter((u) => hasCheckedInToday(u));
        break;
      default:
        break;
    }

    return list;
  }, [users, query, quickFilter]);

  const appendAuditEvent = (evt) => {
    if (!evt) return;
    setAuditEvents((prev) => [evt, ...(prev || [])].slice(0, 80));
  };

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

  const handleViewProfile = (user) => {
    setViewingUser(user);
    setShowProfileModal(true);
  };

  const handleRenovar = (userId) => {
    setUiError("");
    setSelectedUser(userId);
    setRenovarMonths(1);
    setShowRenovarModal(true);
  };

  const handleCheckin = (user) => {
    setUiError("");
    setCheckinSuccess("");
    setCheckinUser(user);
    setShowCheckinModal(true);
  };

  const submitCheckin = async () => {
    setUiError("");
    setCheckinSuccess("");
    if (!checkinUser) return;
    setBusy(true);
    try {
      const res = await axios.post("/api/admin/visits/checkin", {
        userId: checkinUser._id,
      });

      const code = res.data?.code;
      if (code === "ALREADY_CHECKED_IN") {
        setCheckinSuccess("✅ Este usuario ya hizo check-in hoy.");
      } else {
        const creditsMsg =
          checkinUser.accessType === "ticketera"
            ? ` Créditos restantes: ${res.data.credits}`
            : "";
        setCheckinSuccess(`✅ Check-in registrado.${creditsMsg}`);
      }

      // ✅ Auditoría (persistida por backend)
      if (res.data?.auditEvent) appendAuditEvent(res.data.auditEvent);

      await fetchUsers();
      // opcional: refetchAudit si quieres “source of truth”
      // await fetchAudit();
    } catch (error) {
      const msg = error?.response?.data?.message || "No se pudo registrar el check-in.";
      setUiError(msg);
    } finally {
      setBusy(false);
    }
  };

  const checkFirstReservation = async (date, time) => {
    if (!date || !time) return;
    const formattedDate = date.toISOString().split("T")[0];
    try {
      const response = await axios.post("/api/check-first-reservation", { date: formattedDate, time });
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
    if (!selectedUser) { setUiError("Selecciona un usuario antes de modificar créditos."); return; }
    if (!Number.isFinite(amount)) { setUiError("Créditos inválidos."); return; }
    setBusy(true);
    try {
      const res = await axios.post("/api/admin/adjust-credits", {
        userId: selectedUser,
        credits: parseInt(amount, 10),
      });
      setShowCreditsModal(false);
      setCredits(0);

      if (res.data?.auditEvent) appendAuditEvent(res.data.auditEvent);

      await fetchUsers();
    } catch (error) {
      console.error("Error modifying credits:", error);
      setUiError("No se pudieron modificar los créditos. Intenta nuevamente.");
    } finally {
      setBusy(false);
    }
  };

  const submitRenovar = async () => {
    setUiError("");
    if (!selectedUser) return;
    setBusy(true);
    try {
      const res = await axios.post("/api/admin/mensualidad/renovar", { userId: selectedUser, months: renovarMonths });
      setShowRenovarModal(false);

      if (res.data?.auditEvent) appendAuditEvent(res.data.auditEvent);

      await fetchUsers();
    } catch (error) {
      setUiError(error?.response?.data?.message || "No se pudo renovar.");
    } finally {
      setBusy(false);
    }
  };

  const addReservation = async () => {
    setUiError("");
    if (!selectedUser) { setUiError("Selecciona un usuario antes de crear una reserva."); return; }
    if (!selectedDate || !selectedTime) { setUiError("Selecciona una fecha y una hora."); return; }
    const formattedDate = selectedDate.toISOString().split("T")[0];
    setBusy(true);
    try {
      const res = await axios.post("/api/reserve", {
        userId: selectedUser,
        date: formattedDate,
        time: selectedTime,
        isPrivate
      });

      setShowReservationModal(false);

      if (res.data?.auditEvent) appendAuditEvent(res.data.auditEvent);

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
      const res = await axios.post("/api/admin/remove-reservation", { userId, reservationId });

      if (res.data?.auditEvent) appendAuditEvent(res.data.auditEvent);

      await fetchUsers();
    } catch (error) {
      console.error("Error removing reservation:", error);
      setUiError("No se pudo eliminar la reserva. Intenta nuevamente.");
    } finally {
      setBusy(false);
    }
  };

  function getCanvasCtx() {
    const c = canvasRef.current;
    if (!c) return null;
    return c.getContext("2d");
  }

  function resizeCanvasToDevicePixels() {
    const c = canvasRef.current;
    if (!c) return;
    const rect = c.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    c.width = Math.floor(rect.width * dpr);
    c.height = Math.floor(rect.height * dpr);
    const ctx = c.getContext("2d");
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.scale(dpr, dpr);
    ctx.lineWidth = 2.5;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = "#1f1f1f";
  }

  function getLocalPos(e) {
    const c = canvasRef.current;
    const rect = c.getBoundingClientRect();
    if (e?.clientX != null) return { x: e.clientX - rect.left, y: e.clientY - rect.top };
    const t = e?.touches?.[0] || e?.changedTouches?.[0];
    if (t) return { x: t.clientX - rect.left, y: t.clientY - rect.top };
    return { x: 0, y: 0 };
  }

  function startDraw(e) { drawingRef.current = true; lastPointRef.current = getLocalPos(e); e?.preventDefault?.(); }

  function moveDraw(e) {
    if (!drawingRef.current) return;
    const ctx = getCanvasCtx();
    if (!ctx) return;
    const p = getLocalPos(e);
    ctx.beginPath();
    ctx.moveTo(lastPointRef.current.x, lastPointRef.current.y);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
    lastPointRef.current = p;
    hasInkRef.current = true;
    e?.preventDefault?.();
  }

  function endDraw(e) { drawingRef.current = false; e?.preventDefault?.(); }

  function clearSignature() {
    const c = canvasRef.current;
    const ctx = getCanvasCtx();
    if (!c || !ctx) return;
    const rect = c.getBoundingClientRect();
    ctx.clearRect(0, 0, rect.width, rect.height);
    hasInkRef.current = false;
  }

  function exportSignatureDataUrl() {
    const c = canvasRef.current;
    if (!c) return "";
    return c.toDataURL("image/png");
  }

  const openNewUser = () => {
    setUiError("");
    setShowNewUserModal(true);
    setNewUserStep(1);
    setSelectedUser(null);
    setWaiverAccepted(false);
    hasInkRef.current = false;
    setNewUserForm(INITIAL_FORM);
  };

  const closeNewUser = () => {
    if (busy) return;
    setShowNewUserModal(false);
    setNewUserStep(1);
    setSelectedUser(null);
    setWaiverAccepted(false);
    clearSignature();
  };

  const createNewUser = async () => {
    setUiError("");
    const payload = {
      ...newUserForm,
      name: (newUserForm.name || "").trim(),
      email: (newUserForm.email || "").trim().toLowerCase(),
      documentType: normalizeDocType(newUserForm.documentType),
      documentNumber: (newUserForm.documentNumber || "").trim(),
      phone: (newUserForm.phone || "").trim(),
      epsName: (newUserForm.epsName || "").trim(),
      emergencyContactName: (newUserForm.emergencyContactName || "").trim(),
      emergencyContactPhone: (newUserForm.emergencyContactPhone || "").trim(),
      accessType: newUserForm.accessType ?? "ticketera",
      mensualidadMeses: newUserForm.accessType === "mensualidad" ? newUserForm.mensualidadMeses : undefined,
      esMinor: newUserForm.esMinor ?? false,
    };

    if (!payload.name) return setUiError("El nombre es obligatorio.");
    if (!payload.email) return setUiError("El email es obligatorio.");
    if (!payload.documentType) return setUiError("El tipo de documento es obligatorio.");
    if (!payload.documentNumber) return setUiError("El número de documento es obligatorio.");
    if (!payload.phone) return setUiError("El teléfono es obligatorio.");
    if (!payload.epsName) return setUiError("La EPS es obligatoria.");
    if (!payload.emergencyContactName || !payload.emergencyContactPhone) {
      return setUiError("Completa el contacto de emergencia.");
    }

    setBusy(true);
    try {
      const response = await axios.post("/api/admin/users/create", payload);
      const createdUser = response.data?.user;
      const userId = createdUser?._id || response.data?.userId;
      if (!userId) { setUiError("No llegó el userId del backend."); return; }
      setSelectedUser(userId);
      setNewUserStep(2);
      setTimeout(() => { resizeCanvasToDevicePixels(); clearSignature(); }, 0);

      if (response.data?.auditEvent) appendAuditEvent(response.data.auditEvent);
    } catch (error) {
      console.error(error);
      setUiError(error?.response?.data?.message || "No se pudo crear el usuario.");
    } finally {
      setBusy(false);
    }
  };

  const buildWaiverSnapshot = () => {
    const isMinor = newUserForm.esMinor;
    const clause5 = isMinor
      ? `5) Representante legal (MENOR DE EDAD): El participante es menor de edad. Este consentimiento es aceptado por su padre, madre o representante legal, quien declara tener la autoridad legal para firmar en nombre del menor, asume todas las obligaciones aquí descritas y autoriza su participación en las actividades de CrashPath.`
      : `5) Menores de edad: Si el participante es menor de edad, este documento debe ser aceptado por su padre, madre o representante legal. El adulto responsable declara y garantiza que tiene la autoridad legal para aceptar en nombre del menor y asume las obligaciones aquí descritas.`;

    return `CRASHPATH – CONSENTIMIENTO INFORMADO, ASUNCIÓN DE RIESGO Y EXONERACIÓN DE RESPONSABILIDAD (v1)
${isMinor ? "[PARTICIPANTE MENOR DE EDAD]" : ""}
Bucaramanga, Santander

Yo, como participante/usuario de CrashPath, declaro que he leído y entendido el presente documento y que acepto voluntariamente entrenar, escalar y/o utilizar las instalaciones, equipos y servicios ofrecidos por CrashPath.

1) Naturaleza de la actividad y riesgos: Entiendo que la escalada, el entrenamiento físico y el uso de muros, presas, colchonetas, pesas, barras, campus/board, máquinas u otros elementos conllevan riesgos inherentes, incluyendo pero no limitados a: caídas, golpes, lesiones musculares, tendinosas o articulares, fracturas, esguinces, laceraciones, sobreesfuerzo, mareos, lesiones por uso indebido del equipo y accidentes derivados de mi actuación o la de terceros.

2) Asunción de riesgo: Acepto y asumo plenamente todos los riesgos conocidos y desconocidos relacionados con mi participación, incluso aquellos que puedan derivarse de condiciones del entorno, de otros usuarios o de mis propias decisiones. Reconozco que estos riesgos pueden resultar en lesiones graves, incapacidad permanente o, en casos extremos, muerte.

3) Condición de salud y aptitud: Declaro que me encuentro en condiciones físicas y de salud adecuadas para realizar actividad física. Me comprometo a informar de manera veraz cualquier condición médica relevante (por ejemplo: lesiones previas, enfermedades, embarazo, uso de medicamentos, alergias, problemas cardiacos o respiratorios). Entiendo que CrashPath no realiza diagnósticos médicos y que es mi responsabilidad consultar a un profesional de la salud si tengo dudas sobre mi aptitud.

4) Normas y uso responsable: Me comprometo a cumplir las normas internas, instrucciones del staff y señalización del lugar, así como a utilizar correctamente el equipo y mantener una conducta segura. Entiendo que el incumplimiento de normas o la conducta imprudente aumenta el riesgo de accidentes y puede dar lugar a la suspensión del servicio y/o retiro de las instalaciones.

${clause5}

6) Emergencias y atención: Autorizo a CrashPath a contactar a mi persona de emergencia y a solicitar asistencia médica o ambulancia si el staff lo considera necesario. Entiendo que cualquier costo de atención médica, traslado o tratamiento será de mi cuenta o de mi seguro, y que el personal de CrashPath no sustituye servicios profesionales de salud.

7) Exoneración y limitación de responsabilidad: En la máxima medida permitida por la ley aplicable, libero y exonero a CrashPath, sus propietarios, administradores, empleados, instructores y colaboradores de toda responsabilidad por lesiones, pérdidas o daños sufridos durante o con ocasión de mi participación, incluyendo daños derivados de mi propia negligencia, imprudencia o la de terceros. Esta exoneración no pretende cubrir conductas dolosas o culpa grave cuando la ley no lo permita.

8) Daños a instalaciones y equipo: Me hago responsable por los daños que cause por mal uso intencional o negligente de las instalaciones o equipos, y autorizo a CrashPath a cobrar o reclamar el valor de reposición o reparación cuando aplique.

9) Tratamiento de datos personales: Autorizo el tratamiento de mis datos personales y de contacto de emergencia para fines operativos y de seguridad (por ejemplo: control de acceso, emergencias, registro de visitas), conforme a la política de privacidad de CrashPath y a la normativa vigente sobre protección de datos personales en Colombia.

10) Firma electrónica: Entiendo y acepto que mi aceptación mediante checkbox y mi firma digital (trazo en pantalla o nombre digitado) constituyen una manifestación de voluntad válida y equivalente a una firma manuscrita para efectos de este consentimiento.

Declaro que he leído, entendido y acepto este documento en su totalidad. Acepto entrenar bajo mi propia responsabilidad y confirmo que la información suministrada es veraz.`.trim();
  };

  const submitNewUserWaiver = async () => {
    setUiError("");
    if (!selectedUser) return setUiError("No hay userId seleccionado.");
    if (!waiverAccepted) return setUiError("Debes aceptar el waiver.");
    const canvas = canvasRef.current;
    if (!canvas) return setUiError("Canvas no disponible.");
    if (isCanvasBlank(canvas) || !hasInkRef.current) return setUiError("La firma es obligatoria.");

    const signatureImageUrl = exportSignatureDataUrl();
    const waiverTextSnapshot = buildWaiverSnapshot();

    setBusy(true);
    try {
      const res = await axios.post("/api/admin/waiver/sign", {
        userId: selectedUser,
        version: "v1",
        method: "signature",
        waiverTextSnapshot,
        signatureImageUrl,
        signatureText: newUserForm.esMinor
          ? `Representante legal de ${newUserForm.name?.trim() || ""}`
          : newUserForm.name?.trim() || "",
        esMinor: newUserForm.esMinor,
      });

      if (res.data?.auditEvent) appendAuditEvent(res.data.auditEvent);

      closeNewUser();
      await fetchUsers();
    } catch (error) {
      console.error(error);
      setUiError(error?.response?.data?.message || "No se pudo firmar el waiver.");
    } finally {
      setBusy(false);
    }
  };
  const formatPrettyDayTime = (date) => {
    try {
      const d = new Date(date);
      const day = d.toLocaleDateString("es-CO", { weekday: "long", year: "numeric", month: "long", day: "numeric" });
      const time = d.toLocaleTimeString("es-CO", { hour: "numeric", minute: "2-digit" });
      return `${day} · ${time}`;
    } catch {
      return "—";
    }
  };

  const statusLabel = (v) => {
    switch (v) {
      case "checked_in": return "Check-in";
      case "registered": return "Registrado";
      case "no_show": return "No asistió";
      case "cancelled": return "Cancelado";
      default: return v || "—";
    }
  };
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [historyUser, setHistoryUser] = useState(null);
  const [historyVisits, setHistoryVisits] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  useEffect(() => {
    const open =
      showCreditsModal ||
      showReservationModal ||
      showProfileModal ||
      showNewUserModal ||
      showRenovarModal ||
      showCheckinModal ||
      showHistoryModal;

    document.body.classList.toggle("modal-open", open);
    return () => document.body.classList.remove("modal-open");
  }, [showCreditsModal, showReservationModal, showProfileModal, showNewUserModal, showRenovarModal, showCheckinModal]);

  const userAudit = useMemo(() => {
    if (!viewingUser?._id) return [];
    return (auditEvents || []).filter((e) => String(e.userId) === String(viewingUser._id)).slice(0, 12);
  }, [auditEvents, viewingUser]);
  const openHistory = async (user) => {
    setUiError("");
    setHistoryUser(user);
    setHistoryVisits([]);
    setShowHistoryModal(true);
    setHistoryLoading(true);

    try {
      const res = await axios.get(`/api/admin/users/${user._id}/visits?limit=80`);
      setHistoryVisits(Array.isArray(res.data?.visits) ? res.data.visits : []);
    } catch (e) {
      console.error(e);
      setUiError(e?.response?.data?.message || "No se pudo cargar el historial.");
    } finally {
      setHistoryLoading(false);
    }
  };

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
            <Subtitle>CrashPath · usuarios, créditos y reservas</Subtitle>
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
              <SecondaryButton onClick={fetchUsers} title="Recargar">Recargar</SecondaryButton>
            </SearchBar>
            <Button onClick={openNewUser} disabled={busy}>+ Nuevo miembro</Button>
            <SecondaryButton onClick={() => signOut()}>Cerrar sesión</SecondaryButton>
          </TopActions>
        </TopBar>

        {/* ✅ FILTROS RÁPIDOS */}
        <FiltersBar>
          <FilterChip $active={quickFilter === "all"} onClick={() => setQuickFilter("all")}>
            Todos · {counts.total}
          </FilterChip>
          <FilterChip $active={quickFilter === "waiver"} onClick={() => setQuickFilter("waiver")}>
            Waiver pendiente · {counts.waiverPend}
          </FilterChip>
          <FilterChip $active={quickFilter === "mensualidadVencida"} onClick={() => setQuickFilter("mensualidadVencida")}>
            Mensualidad vencida · {counts.mensualidadVencida}
          </FilterChip>
          <FilterChip $active={quickFilter === "sinCreditos"} onClick={() => setQuickFilter("sinCreditos")}>
            Sin créditos · {counts.sinCreditos}
          </FilterChip>
          <FilterChip $active={quickFilter === "menores"} onClick={() => setQuickFilter("menores")}>
            Menores · {counts.menores}
          </FilterChip>
          <FilterChip $active={quickFilter === "checkinHoy"} onClick={() => setQuickFilter("checkinHoy")}>
            Check-in hoy · {counts.checkinHoy}
          </FilterChip>
        </FiltersBar>

        {uiError ? <ErrorBox role="alert">{uiError}</ErrorBox> : null}

        <Divider />

        <Row>
          {/* LEFT: USERS */}
          <div>
            {loading ? (
              <Muted>Cargando usuarios...</Muted>
            ) : filteredUsers.length === 0 ? (
              <EmptyState>
                <div style={{ display: "grid", gap: 6 }}>
                  <b style={{ color: palette.text }}>No hay usuarios</b>
                  <Muted>{query.trim() ? "No hay resultados para tu búsqueda." : "Aún no hay usuarios cargados."}</Muted>
                </div>
              </EmptyState>
            ) : (
              <>
                {/* ── MOBILE CARDS ── */}
                <CardsGrid>
                  {filteredUsers.map((user) => (
                    <UserCard key={user._id}>
                      <CardHeader>
                        <NameRow>
                          <div>
                            <UserName>
                              {user.name || "Sin nombre"}{" "}
                              {hasCheckedInToday(user) ? <span title="Check-in hoy">✅</span> : null}
                            </UserName>
                            <UserEmail>{user.email || "Sin email"}</UserEmail>
                          </div>
                          <AccessInfo user={user} onRenovar={handleRenovar} busy={busy} />
                        </NameRow>
                      </CardHeader>

                      <CardBody>
                        <div>
                          <Muted style={{ display: "block", marginBottom: 6 }}>Reservas</Muted>
                          {user.reservations?.length ? (
                            <ReservationList>
                              {user.reservations.map((r) => (
                                <ReservationRow key={r._id}>
                                  <Pill>
                                    <b>{formatDate(r.date)}</b>
                                    <Muted>·</Muted>
                                    <span>{r.time}</span>
                                    <PrivacyTag private={r.isPrivate}>{r.isPrivate ? "Privada" : "Pública"}</PrivacyTag>
                                  </Pill>
                                  <IconButton title="Eliminar reserva" onClick={() => removeReservation(user._id, r._id)} disabled={busy}>×</IconButton>
                                </ReservationRow>
                              ))}
                            </ReservationList>
                          ) : (
                            <Muted>Sin reservas</Muted>
                          )}
                        </div>

                        <Actions>
                          {user?.waiverStatus === "signed" ? (
                            <LinkButton href={`/api/admin/waiver/pdf?email=${encodeURIComponent(user.email)}`} target="_blank" rel="noreferrer" style={{ flex: "1" }} title="Descargar Waiver firmado">
                              <LinkPill>⬇️</LinkPill>
                              Waiver PDF
                            </LinkButton>
                          ) : (
                            <SecondaryButton disabled style={{ flex: "1", opacity: 0.7 }}>Waiver pendiente</SecondaryButton>
                          )}
                          <SecondaryButton onClick={() => handleViewProfile(user)} disabled={busy}>Ver datos</SecondaryButton>
                          {user.accessType === "ticketera" && (
                            <Button onClick={() => handleAddCredits(user._id)} disabled={busy}>Créditos</Button>
                          )}
                          <Button onClick={() => handleCreateReservation(user._id)} disabled={busy}>Reserva</Button>
                          <CheckinButton onClick={() => handleCheckin(user)} disabled={busy}>
                            ✓ Check-in
                          </CheckinButton>
                          <SecondaryButton onClick={() => openHistory(user)} disabled={busy}>
                            Historial
                          </SecondaryButton>
                        </Actions>
                      </CardBody>
                    </UserCard>
                  ))}
                </CardsGrid>

                {/* ── DESKTOP TABLE ── */}
                <TableWrapper>
                  <Table>
                    <thead>
                      <tr>
                        <Th>Nombre</Th>
                        <Th>Email</Th>
                        <Th>Acceso</Th>
                        <Th>Waiver</Th>
                        <Th>Reservas</Th>
                        <Th style={{ textAlign: "right" }}>Acciones</Th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredUsers.map((user) => (
                        <Tr key={user._id}>
                          <Td>
                            {user.name || <Muted>Sin nombre</Muted>}{" "}
                            {hasCheckedInToday(user) ? <span title="Check-in hoy">✅</span> : null}
                          </Td>
                          <Td><Muted style={{ wordBreak: "break-word" }}>{user.email}</Muted></Td>
                          <Td><AccessInfo user={user} onRenovar={handleRenovar} busy={busy} /></Td>
                          <Td>
                            {user?.waiverStatus === "signed" ? (
                              <LinkButton href={`/api/admin/waiver/pdf?email=${encodeURIComponent(user.email)}`} target="_blank" rel="noreferrer" title="Descargar Waiver firmado">
                                <LinkPill>⬇️</LinkPill>
                                Descargar PDF
                              </LinkButton>
                            ) : (
                              <Muted>No firmado</Muted>
                            )}
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
                                      <PrivacyTag private={r.isPrivate}>{r.isPrivate ? "Privada" : "Pública"}</PrivacyTag>
                                    </Pill>
                                    <IconButton title="Eliminar reserva" onClick={() => removeReservation(user._id, r._id)} disabled={busy}>×</IconButton>
                                  </ReservationRow>
                                ))}
                              </ReservationList>
                            ) : (
                              <Muted>Sin reservas</Muted>
                            )}
                          </Td>
                          <Td>
                            <Actions>
                              <CheckinButton onClick={() => handleCheckin(user)} disabled={busy}>
                                ✓ Check-in
                              </CheckinButton>

                              <SecondaryButton onClick={() => handleViewProfile(user)} disabled={busy}>Ver datos</SecondaryButton>
                              {user.accessType === "ticketera" && (
                                <Button onClick={() => handleAddCredits(user._id)} disabled={busy}>Modificar créditos</Button>
                              )}
                              <Button onClick={() => handleCreateReservation(user._id)} disabled={busy}>Crear reserva</Button>
                              <SecondaryButton onClick={() => openHistory(user)} disabled={busy}>
                                Historial
                              </SecondaryButton>
                            </Actions>
                          </Td>
                        </Tr>
                      ))}
                    </tbody>
                  </Table>
                </TableWrapper>
              </>
            )}
          </div>

          {/* RIGHT: AUDIT */}
          <AuditFeed events={auditEvents} onReload={fetchAudit} loading={auditLoading} />
        </Row>
      </AdminContainer>

      <ModalPortal>
        {/* ── MODAL: HISTORIAL ── */}
        <Overlay
          show={showHistoryModal}
          onClick={() => (!busy ? setShowHistoryModal(false) : null)}
        />

        <Modal show={showHistoryModal} role="dialog" aria-modal="true">
          <SheetHandle />
          <ModalTitle>Historial de ingresos</ModalTitle>

          {historyUser ? (
            <>
              <div style={{ fontSize: 15, fontWeight: 900, color: palette.text }}>
                {historyUser.name || "Sin nombre"}
              </div>
              <Muted style={{ display: "block", marginBottom: 10 }}>
                {historyUser.email}
              </Muted>
            </>
          ) : null}

          {historyLoading ? (
            <Muted>Cargando historial…</Muted>
          ) : historyVisits.length === 0 ? (
            <EmptyState>
              <b style={{ color: palette.text }}>Sin historial</b>
              <Muted>No hay visitas registradas para este usuario.</Muted>
            </EmptyState>
          ) : (
            <div style={{ display: "grid", gap: 8 }}>
              {historyVisits.map((v) => {
                // Usa checkedInAt si existe (más “real”), si no date
                const ts = v.checkedInAt || v.date;
                return (
                  <div
                    key={v.id}
                    style={{
                      border: "1px solid rgba(0,0,0,0.06)",
                      borderRadius: 12,
                      padding: 10,
                      background: "rgba(255,255,255,0.7)",
                    }}
                  >
                    <div style={{ fontSize: 13, color: palette.text, display: "flex", justifyContent: "space-between", gap: 10 }}>
                      <span>
                        <b>{statusLabel(v.status)}</b>
                        <span style={{ color: palette.muted }}> · </span>
                        <span>{formatPrettyDayTime(ts)}</span>
                      </span>

                      <span style={{ color: palette.muted, fontSize: 12 }}>
                        {v.createdBy === "admin" ? "Admin" : "Usuario"}
                      </span>
                    </div>

                    {v.notes ? (
                      <div style={{ marginTop: 6, fontSize: 12.5, color: palette.muted }}>
                        📝 {v.notes}
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          )}

          <Actions style={{ justifyContent: "flex-end", marginTop: 12 }}>
            <SecondaryButton onClick={() => setShowHistoryModal(false)} disabled={busy}>
              Cerrar
            </SecondaryButton>
          </Actions>
        </Modal>
        {/* ── MODAL: CRÉDITOS ── */}
        <Overlay show={showCreditsModal} onClick={() => (!busy ? setShowCreditsModal(false) : null)} />
        <Modal show={showCreditsModal} role="dialog" aria-modal="true">
          <SheetHandle />
          <ModalTitle>Modificar Créditos</ModalTitle>
          <Input type="number" value={credits} onChange={(e) => setCredits(e.target.value)} placeholder="Ingrese la cantidad (+ o -)" inputMode="numeric" />
          <Actions style={{ justifyContent: "flex-end" }}>
            <Button onClick={submitCredits} disabled={busy}>{busy ? "Guardando..." : "Confirmar"}</Button>
            <SecondaryButton onClick={() => setShowCreditsModal(false)} disabled={busy}>Cancelar</SecondaryButton>
          </Actions>
        </Modal>

        {/* ── MODAL: RENOVAR MENSUALIDAD ── */}
        <Overlay show={showRenovarModal} onClick={() => (!busy ? setShowRenovarModal(false) : null)} />
        <Modal show={showRenovarModal} role="dialog" aria-modal="true">
          <SheetHandle />
          <ModalTitle>Renovar Mensualidad</ModalTitle>
          <p style={{ margin: "0 0 12px", fontSize: 14, color: palette.muted }}>
            ¿Cuántos meses deseas agregar? Si tiene mensualidad activa, se extiende desde la fecha de vencimiento actual.
          </p>
          <Select value={renovarMonths} onChange={(e) => setRenovarMonths(Number(e.target.value))}>
            {[1, 2, 3, 6].map((m) => (
              <option key={m} value={m}>{m} {m === 1 ? "mes" : "meses"}</option>
            ))}
          </Select>
          <Actions style={{ marginTop: 12 }}>
            <Button onClick={submitRenovar} disabled={busy}>{busy ? "Renovando..." : "Confirmar"}</Button>
            <SecondaryButton onClick={() => setShowRenovarModal(false)} disabled={busy}>Cancelar</SecondaryButton>
          </Actions>
        </Modal>

        {/* ── MODAL: CHECK-IN ── */}
        <Overlay show={showCheckinModal} onClick={() => (!busy ? setShowCheckinModal(false) : null)} />
        <Modal show={showCheckinModal} role="dialog" aria-modal="true">
          <SheetHandle />
          <ModalTitle>Registrar Check-in</ModalTitle>

          {checkinUser && (
            <>
              <div style={{ fontSize: 16, fontWeight: 900, color: palette.text, marginBottom: 4 }}>
                {checkinUser.name}
              </div>
              <Muted style={{ display: "block", marginBottom: 10 }}>{checkinUser.email}</Muted>

              <CheckinInfoRow>
                <AccessTypePill $type={checkinUser.accessType}>
                  {checkinUser.accessType}
                </AccessTypePill>
                {checkinUser.accessType === "ticketera" ? (
                  <Badge>
                    <b>{checkinUser.credits ?? 0}</b>
                    <Muted>créditos</Muted>
                  </Badge>
                ) : (
                  (() => {
                    const { active, label } = getMensualidadStatus(checkinUser.mensualidad);
                    return (
                      <MensualidadBadge $active={active}>
                        {active ? "🟢" : "🔴"} {label}
                      </MensualidadBadge>
                    );
                  })()
                )}
              </CheckinInfoRow>

              {hasCheckedInToday(checkinUser) ? (
                <SuccessBox role="status">✅ Ya aparece con check-in hoy.</SuccessBox>
              ) : null}

              {/* Alertas de acceso denegado */}
              {checkinUser.accessType === "ticketera" && (checkinUser.credits ?? 0) <= 0 && (
                <ErrorBox role="alert" style={{ marginTop: 8 }}>
                  ⚠️ Sin créditos — no se puede registrar el check-in.
                </ErrorBox>
              )}
              {checkinUser.accessType === "mensualidad" && !getMensualidadStatus(checkinUser.mensualidad).active && (
                <ErrorBox role="alert" style={{ marginTop: 8 }}>
                  ⚠️ Mensualidad vencida — no se puede registrar el check-in.
                </ErrorBox>
              )}
            </>
          )}

          {uiError ? <ErrorBox role="alert">{uiError}</ErrorBox> : null}
          {checkinSuccess ? <SuccessBox role="status">{checkinSuccess}</SuccessBox> : null}

          <Actions style={{ marginTop: 14 }}>
            {!checkinSuccess ? (
              <CheckinButton
                onClick={submitCheckin}
                disabled={busy || !checkinUser || !userCanCheckin(checkinUser)}
              >
                {busy ? "Registrando..." : "✓ Confirmar Check-in"}
              </CheckinButton>
            ) : null}
            <SecondaryButton onClick={() => { setShowCheckinModal(false); setCheckinSuccess(""); setUiError(""); }} disabled={busy}>
              {checkinSuccess ? "Cerrar" : "Cancelar"}
            </SecondaryButton>
          </Actions>
        </Modal>

        {/* ── MODAL: RESERVA ── */}
        <Overlay show={showReservationModal} onClick={() => (!busy ? setShowReservationModal(false) : null)} />
        <Modal show={showReservationModal} role="dialog" aria-modal="true">
          <SheetHandle />
          <ModalTitle>Crear Nueva Reserva</ModalTitle>
          <Calendar onClickDay={handleDateSelection} />
          <Input type="time" value={selectedTime} onChange={handleTimeSelection} />
          {isFirstReservation && (
            <RadioRow>
              <label><input type="radio" checked={!isPrivate} onChange={() => setIsPrivate(false)} />Pública</label>
              <label><input type="radio" checked={isPrivate} onChange={() => setIsPrivate(true)} />Privada</label>
            </RadioRow>
          )}
          <Actions style={{ justifyContent: "flex-end", marginTop: 12 }}>
            <Button onClick={addReservation} disabled={busy}>{busy ? "Creando..." : "Confirmar"}</Button>
            <SecondaryButton onClick={() => setShowReservationModal(false)} disabled={busy}>Cancelar</SecondaryButton>
          </Actions>
        </Modal>

        {/* ── MODAL: VER DATOS ── */}
        <Overlay show={showProfileModal} onClick={() => (!busy ? setShowProfileModal(false) : null)} />
        <Modal show={showProfileModal} role="dialog" aria-modal="true">
          <SheetHandle />
          <ModalTitle>Datos del usuario</ModalTitle>
          {viewingUser ? (
            <div style={{ display: "grid", gap: 10, fontSize: 14, color: palette.text }}>
              <b>Identidad</b>
              <div>Nombre: {viewingUser.name || "—"}</div>
              <div>Email: {viewingUser.email || "—"}</div>
              <div>Teléfono: {viewingUser.phone || "—"}</div>
              <div>Documento: {viewingUser.documentType || "—"} {viewingUser.documentNumber || ""}</div>
              {viewingUser.esMinor && (
                <div style={{ color: palette.accent, fontWeight: 800 }}>⚠️ Menor de edad</div>
              )}

              <Divider />

              <b>Acceso</b>
              <div>Tipo: <AccessTypePill $type={viewingUser.accessType}>{viewingUser.accessType || "ticketera"}</AccessTypePill></div>
              {viewingUser.accessType === "ticketera" ? (
                <div>Créditos: <b>{viewingUser.credits ?? 0}</b></div>
              ) : (
                <div>
                  Estado:{" "}
                  {(() => {
                    const { active, label } = getMensualidadStatus(viewingUser.mensualidad);
                    return <MensualidadBadge $active={active}>{active ? "🟢" : "🔴"} {label}</MensualidadBadge>;
                  })()}
                </div>
              )}

              <Divider />

              <b>Contacto de emergencia</b>
              <div>Nombre: {viewingUser.emergencyContactName || "—"}</div>
              <div>Teléfono: {viewingUser.emergencyContactPhone || "—"}</div>

              <Divider />

              <b>Salud / Seguro</b>
              <div>EPS: {viewingUser.epsName || "—"}</div>
              <div>Aseguradora: {viewingUser.insuranceProvider || "—"}</div>
              <div>Póliza: {viewingUser.insurancePolicyNumber || "—"}</div>

              <Divider />

              <b>Waiver</b>
              <div>Estado: <strong>{viewingUser.waiverStatus === "signed" ? "Firmado" : "Pendiente"}</strong></div>
              {viewingUser.waiverStatus === "signed" ? (
                <>
                  <div>Firmado el: {viewingUser.waiverSignedAt ? new Date(viewingUser.waiverSignedAt).toLocaleString("es-CO") : "—"}</div>
                  <div>Método: {viewingUser.waiverMethod || "—"}</div>
                  <div>Versión: {viewingUser.waiverVersion || "—"}</div>
                  <div>IP: {viewingUser.waiverMeta?.ip || "—"}</div>
                  <div>User-Agent: {viewingUser.waiverMeta?.userAgent || "—"}</div>
                  {viewingUser.waiverSignatureText ? <div>Firma: {viewingUser.waiverSignatureText}</div> : null}
                  {viewingUser.waiverSignatureUrl ? (
                    <>
                      <Divider />
                      <b>Firma digital</b>
                      <img src={viewingUser.waiverSignatureUrl} alt="Firma del usuario" style={{ maxWidth: "100%", borderRadius: 10, border: `1px solid ${palette.border}`, background: "rgba(255,255,255,0.85)", padding: 8 }} />
                    </>
                  ) : null}
                  <Divider />
                  <LinkButton href={`/api/admin/waiver/pdf?email=${encodeURIComponent(viewingUser.email || "")}`} target="_blank" rel="noreferrer" title="Abrir PDF del Waiver" style={{ justifyContent: "center" }}>
                    <LinkPill>⬇️</LinkPill>
                    Abrir Waiver PDF
                  </LinkButton>
                </>
              ) : null}

              {/* ✅ Historial por usuario */}
              <Divider />
              

              <Actions style={{ justifyContent: "flex-end", marginTop: 12 }}>
                <Button onClick={() => setShowProfileModal(false)} disabled={busy}>Cerrar</Button>
              </Actions>
            </div>
          ) : (
            <Muted>No hay datos para mostrar.</Muted>
          )}
        </Modal>

        {/* ── MODAL: NUEVO MIEMBRO ── */}
        <Overlay show={showNewUserModal} onClick={() => (!busy ? closeNewUser() : null)} />
        <Modal show={showNewUserModal} role="dialog" aria-modal="true">
          <SheetHandle />
          <ModalTitle>
            {newUserStep === 1
              ? "Nuevo Miembro"
              : newUserForm.esMinor
                ? "Waiver — Menor de Edad"
                : "Firma de Waiver"}
          </ModalTitle>

          {newUserStep === 1 ? (
            <>
              <Select value={newUserForm.accessType} onChange={(e) => setNewUserForm((s) => ({ ...s, accessType: e.target.value }))}>
                <option value="ticketera">Tiquetera (créditos)</option>
                <option value="mensualidad">Mensualidad</option>
              </Select>

              {newUserForm.accessType === "mensualidad" && (
                <Select value={newUserForm.mensualidadMeses} onChange={(e) => setNewUserForm((s) => ({ ...s, mensualidadMeses: Number(e.target.value) }))}>
                  {[1, 2, 3, 6, 12].map((m) => (
                    <option key={m} value={m}>{m} {m === 1 ? "mes" : "meses"}</option>
                  ))}
                </Select>
              )}

              <Input placeholder="Nombre" value={newUserForm.name} onChange={(e) => setNewUserForm((s) => ({ ...s, name: e.target.value }))} />
              <Input placeholder="Email" value={newUserForm.email} onChange={(e) => setNewUserForm((s) => ({ ...s, email: e.target.value }))} />

              <Select value={newUserForm.documentType} onChange={(e) => setNewUserForm((s) => ({ ...s, documentType: e.target.value }))}>
                <option value="CC">CC</option>
                <option value="CE">CE</option>
                <option value="TI">TI</option>
                <option value="PP">PP</option>
                <option value="NIT">NIT</option>
                <option value="OTRO">OTRO</option>
              </Select>

              <Input placeholder="Número Documento" value={newUserForm.documentNumber} onChange={(e) => setNewUserForm((s) => ({ ...s, documentNumber: e.target.value }))} />
              <Input placeholder="Teléfono" value={newUserForm.phone} onChange={(e) => setNewUserForm((s) => ({ ...s, phone: e.target.value }))} />
              <Input placeholder="EPS" value={newUserForm.epsName} onChange={(e) => setNewUserForm((s) => ({ ...s, epsName: e.target.value }))} />
              <Input placeholder="Contacto Emergencia" value={newUserForm.emergencyContactName} onChange={(e) => setNewUserForm((s) => ({ ...s, emergencyContactName: e.target.value }))} />
              <Input placeholder="Teléfono Emergencia" value={newUserForm.emergencyContactPhone} onChange={(e) => setNewUserForm((s) => ({ ...s, emergencyContactPhone: e.target.value }))} />

              <RadioRow>
                <label>
                  <input type="radio" checked={!newUserForm.esMinor} onChange={() => setNewUserForm((s) => ({ ...s, esMinor: false }))} />
                  Mayor de edad
                </label>
                <label>
                  <input type="radio" checked={newUserForm.esMinor} onChange={() => setNewUserForm((s) => ({ ...s, esMinor: true }))} />
                  Menor de edad
                </label>
              </RadioRow>

              <Actions style={{ marginTop: 12 }}>
                <Button onClick={createNewUser} disabled={busy}>{busy ? "Creando..." : "Continuar"}</Button>
                <SecondaryButton onClick={closeNewUser} disabled={busy}>Cancelar</SecondaryButton>
              </Actions>
            </>
          ) : (
            <>
              {newUserForm.esMinor && (
                <MinorBanner>
                  ⚠️ Participante menor de edad — debe firmar el padre, madre o representante legal.
                </MinorBanner>
              )}

              <WaiverBox>
                <p style={{ margin: "0 0 10px" }}>
                  <strong>CRASHPATH – CONSENTIMIENTO INFORMADO, ASUNCIÓN DE RIESGO Y EXONERACIÓN DE RESPONSABILIDAD (v1)</strong>
                </p>
                <p style={{ margin: "0 0 10px", fontSize: 12.5, color: "#6b6b6b" }}>{waiverCityLine}</p>

                <p style={{ margin: 0 }}>
                  (Texto del waiver igual que tu versión actual…)
                </p>
              </WaiverBox>

              <CheckboxRow>
                <input type="checkbox" checked={waiverAccepted} onChange={(e) => setWaiverAccepted(e.target.checked)} style={{ marginTop: 2 }} />
                <span>
                  {newUserForm.esMinor
                    ? "Acepto el consentimiento como representante legal del menor"
                    : "Acepto el consentimiento"}
                </span>
              </CheckboxRow>

              <SigWrap>
                <Muted style={{ display: "block", marginBottom: 6 }}>
                  {newUserForm.esMinor ? "Firma del representante legal (dibuja aquí)" : "Firma (dibuja aquí)"}
                </Muted>
                <SigCanvas
                  ref={canvasRef}
                  onMouseDown={startDraw}
                  onMouseMove={moveDraw}
                  onMouseUp={endDraw}
                  onMouseLeave={endDraw}
                  onTouchStart={startDraw}
                  onTouchMove={moveDraw}
                  onTouchEnd={endDraw}
                />
                <SigRow>
                  <Muted>
                    Firmando como:{" "}
                    <b style={{ color: palette.text }}>
                      {newUserForm.esMinor
                        ? `Representante legal de ${newUserForm.name || "—"}`
                        : newUserForm.name || "—"}
                    </b>
                  </Muted>
                  <TinyBtn type="button" onClick={() => { setUiError(""); clearSignature(); }} disabled={busy}>
                    Limpiar
                  </TinyBtn>
                </SigRow>
              </SigWrap>

              <Actions style={{ marginTop: 12 }}>
                <Button onClick={submitNewUserWaiver} disabled={busy}>{busy ? "Guardando..." : "Crear miembro"}</Button>
                <SecondaryButton onClick={() => setNewUserStep(1)} disabled={busy}>Atrás</SecondaryButton>
              </Actions>
            </>
          )}
        </Modal>
      </ModalPortal>
    </PageShell>
  );
}