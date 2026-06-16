
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useSession, signIn, signOut } from "next-auth/react";
import { useRouter } from "next/router";
import axios from "axios";
import styled, { createGlobalStyle } from "styled-components";
import { Eye, EyeOff } from "lucide-react";
import { getWaiverSnapshot, waiverToParagraphs } from "@/lib/waiver";
import { PrivacyProvider, usePrivacy } from "@/components/PrivacyContext";

// ============================================
// SISTEMA DE DISEÑO MINIMALISTA
// ============================================
const palette = {
  bg: "#F5F5F5",
  card: "#FFFFFF",
  text: "#1A1A1A",
  textLight: "#757575",
  border: "#E0E0E0",
  accent: "#0066CC",
  danger: "#DC2626",
  success: "#16A34A",
  warning: "#F59E0B",
  hover: "#F5F5F5"
};

const spacing = {
  xs: "4px",
  sm: "8px",
  md: "12px",
  lg: "16px",
  xl: "24px"
};

const borderRadius = {
  sm: "4px",
  md: "6px",
  lg: "8px"
};

const fontSize = {
  sm: "12px",
  md: "14px",
  lg: "16px",
  xl: "20px",
  xxl: "28px"
};

const GlobalStyle = createGlobalStyle`
  * {
    box-sizing: border-box;
    margin: 0;
    padding: 0;
  }
  
  body {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif;
    font-size: ${fontSize.md};
    line-height: 1.5;
    color: ${palette.text};
    background: ${palette.bg};
  }
  
  body.modal-open {
    overflow: hidden;
  }
  
  button, input, select, textarea {
    font-family: inherit;
  }
`;

const PageShell = styled.div`
  min-height: 100vh;
  padding: ${spacing.lg};
  background: ${palette.bg};
  
  @media (max-width: 768px) {
    padding: ${spacing.sm};
  }
`;

const Container = styled.div`
  max-width: 1400px;
  margin: 0 auto;
  background: ${palette.card};
  border-radius: ${borderRadius.lg};
  border: 1px solid ${palette.border};
  overflow: hidden;
`;

const Header = styled.div`
  padding: ${spacing.lg} ${spacing.xl};
  border-bottom: 1px solid ${palette.border};
  background: ${palette.card};
  
  @media (max-width: 768px) {
    padding: ${spacing.md};
  }
`;

const Title = styled.h1`
  font-size: ${fontSize.xl};
  font-weight: 600;
  margin-bottom: ${spacing.xs};
  color: ${palette.text};
`;

const Subtitle = styled.p`
  font-size: ${fontSize.sm};
  color: ${palette.textLight};
`;

const TopBar = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: ${spacing.md};
  padding: ${spacing.lg} ${spacing.xl} ${spacing.md} ${spacing.xl};
  flex-wrap: wrap;
  
  @media (max-width: 768px) {
    padding: ${spacing.md};
    flex-direction: column;
    align-items: stretch;
    gap: ${spacing.sm};
  }
`;

const SearchInput = styled.input`
  padding: ${spacing.sm} ${spacing.md};
  border: 1px solid ${palette.border};
  border-radius: ${borderRadius.sm};
  font-size: ${fontSize.md};
  width: 300px;
  outline: none;
  
  &:focus {
    border-color: ${palette.accent};
    box-shadow: 0 0 0 2px rgba(0,102,204,0.1);
  }
  
  @media (max-width: 768px) {
    width: 100%;
  }
`;

const Button = styled.button`
  padding: ${props => props.$small ? `${spacing.xs} ${spacing.sm}` : `${spacing.sm} ${spacing.md}`};
  border-radius: ${borderRadius.sm};
  font-size: ${props => props.$small ? fontSize.sm : fontSize.md};
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
  border: none;
  white-space: nowrap;
  
  ${props => {
    switch (props.$variant) {
      case "danger":
        return `
          background: ${palette.danger};
          color: white;
          &:hover { background: #b91c1c; }
        `;
      case "success":
        return `
          background: ${palette.success};
          color: white;
          &:hover { background: #15803d; }
        `;
      case "secondary":
        return `
          background: transparent;
          color: ${palette.text};
          border: 1px solid ${palette.border};
          &:hover { background: ${palette.hover}; }
        `;
      default:
        return `
          background: ${palette.accent};
          color: white;
          &:hover { background: #0052a3; }
        `;
    }
  }}
  
  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
  
  &:focus-visible {
    outline: none;
    box-shadow: 0 0 0 2px ${palette.accent};
  }
  
  @media (max-width: 768px) {
    font-size: ${fontSize.sm};
    padding: ${spacing.sm} ${spacing.md};
    white-space: normal;
    flex: 1;
    text-align: center;
  }
`;

const FiltersBar = styled.div`
  display: flex;
  gap: ${spacing.sm};
  flex-wrap: wrap;
  padding: ${spacing.md} ${spacing.xl};
  border-bottom: 1px solid ${palette.border};
  background: ${palette.bg};
  
  @media (max-width: 768px) {
    padding: ${spacing.sm};
    gap: ${spacing.xs};
  }
`;

const FilterChip = styled.button`
  padding: ${spacing.xs} ${spacing.md};
  border-radius: ${borderRadius.sm};
  font-size: ${fontSize.sm};
  background: ${props => props.$active ? palette.accent : "white"};
  color: ${props => props.$active ? "white" : palette.text};
  border: 1px solid ${props => props.$active ? palette.accent : palette.border};
  cursor: pointer;
  transition: all 0.2s ease;
  
  &:hover {
    background: ${props => props.$active ? palette.accent : palette.hover};
  }
  
  @media (max-width: 768px) {
    font-size: ${fontSize.xs};
    padding: ${spacing.xs} ${spacing.sm};
  }
`;

// ============================================
// DASHBOARD COLLAPSIBLE
// ============================================
const DashboardHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: ${spacing.md} ${spacing.xl};
  background: ${palette.bg};
  border-bottom: 1px solid ${palette.border};
  cursor: pointer;
  user-select: none;
  
  &:hover {
    background: ${palette.hover};
  }
  
  @media (max-width: 768px) {
    padding: ${spacing.sm} ${spacing.md};
  }
`;

const DashboardTitle = styled.div`
  font-weight: 600;
  display: flex;
  align-items: center;
  gap: ${spacing.sm};
`;

const Chevron = styled.span`
  transition: transform 0.2s ease;
  transform: ${props => props.$expanded ? 'rotate(180deg)' : 'rotate(0deg)'};
  display: inline-block;
`;

const KPIGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: ${spacing.md};
  padding: ${spacing.lg} ${spacing.xl};
  background: ${palette.bg};
  border-bottom: 1px solid ${palette.border};
  
  @media (max-width: 768px) {
    padding: ${spacing.md};
    grid-template-columns: repeat(2, 1fr);
    gap: ${spacing.sm};
  }
`;

const KPICard = styled.div`
  background: ${palette.card};
  border: 1px solid ${palette.border};
  border-radius: ${borderRadius.md};
  padding: ${spacing.md};
  text-align: center;
  transition: all 0.2s ease;
  
  &:hover {
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgba(0,0,0,0.08);
  }
  
  @media (max-width: 768px) {
    padding: ${spacing.sm};
  }
`;

const KPIValue = styled.div`
  font-size: ${fontSize.xxl};
  font-weight: 700;
  color: ${props => props.$color || palette.accent};
  line-height: 1.2;
  
  @media (max-width: 768px) {
    font-size: ${fontSize.xl};
  }
`;

const KPILabel = styled.div`
  font-size: ${fontSize.sm};
  color: ${palette.textLight};
  margin-top: ${spacing.xs};
  
  @media (max-width: 768px) {
    font-size: ${fontSize.xs};
  }
`;

const KPISub = styled.div`
  font-size: ${fontSize.xs};
  color: ${palette.textLight};
  margin-top: ${spacing.xs};
`;

// ============================================
// FILTERS ROW
// ============================================
const FilterRow = styled.div`
  display: flex;
  gap: ${spacing.md};
  padding: ${spacing.md} ${spacing.xl};
  background: ${palette.card};
  border-bottom: 1px solid ${palette.border};
  flex-wrap: wrap;
  align-items: flex-end;
  
  @media (max-width: 768px) {
    padding: ${spacing.sm};
    flex-direction: column;
    gap: ${spacing.sm};
  }
`;

const FilterGroup = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${spacing.xs};
  min-width: 150px;
  
  @media (max-width: 768px) {
    min-width: auto;
  }
`;

const FilterLabel = styled.label`
  font-size: ${fontSize.sm};
  font-weight: 600;
  color: ${palette.textLight};
`;

const DateInput = styled.input`
  padding: ${spacing.sm} ${spacing.md};
  border: 1px solid ${palette.border};
  border-radius: ${borderRadius.sm};
  font-size: ${fontSize.md};
  outline: none;
  
  &:focus {
    border-color: ${palette.accent};
    box-shadow: 0 0 0 2px rgba(0,102,204,0.1);
  }
`;

const SortIcon = styled.span`
  display: inline-block;
  margin-left: ${spacing.xs};
  font-size: ${fontSize.sm};
  opacity: ${props => props.$active ? 1 : 0.3};
`;

// ============================================
// PAGINATION
// ============================================
const PaginationWrapper = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: ${spacing.md} ${spacing.xl};
  border-top: 1px solid ${palette.border};
  background: ${palette.bg};
  flex-wrap: wrap;
  gap: ${spacing.md};
  
  @media (max-width: 768px) {
    padding: ${spacing.sm};
    flex-direction: column;
    font-size: ${fontSize.sm};
  }
`;

const PaginationControls = styled.div`
  display: flex;
  gap: ${spacing.xs};
  align-items: center;
  flex-wrap: wrap;
`;

const PageButton = styled.button`
  padding: ${spacing.xs} ${spacing.sm};
  border: 1px solid ${palette.border};
  border-radius: ${borderRadius.sm};
  background: ${props => props.$active ? palette.accent : "white"};
  color: ${props => props.$active ? "white" : palette.text};
  cursor: pointer;
  min-width: 36px;
  
  &:hover:not(:disabled) {
    background: ${props => props.$active ? palette.accent : palette.hover};
  }
  
  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
  
  @media (max-width: 768px) {
    min-width: 32px;
    padding: ${spacing.xs};
    font-size: ${fontSize.sm};
  }
`;

// ============================================
// TABLE COMPONENTS
// ============================================
const TableWrapper = styled.div`
  overflow-x: auto;
  padding: 0 ${spacing.xl};
  
  @media (max-width: 768px) {
    display: none;
  }
`;

const Table = styled.table`
  width: 100%;
  border-collapse: collapse;
  font-size: ${fontSize.sm};
`;

const Th = styled.th`
  text-align: left;
  padding: ${spacing.md};
  background: ${palette.bg};
  color: ${palette.textLight};
  font-weight: 600;
  border-bottom: 1px solid ${palette.border};
  cursor: pointer;
  user-select: none;
  
  &:hover {
    background: ${palette.hover};
  }
`;

const Td = styled.td`
  padding: ${spacing.md};
  border-bottom: 1px solid ${palette.border};
  vertical-align: middle;
`;

const Tr = styled.tr`
  &:hover {
    background: ${palette.hover};
  }
`;

// ============================================
// MOBILE CARD COMPONENT
// ============================================
const CardsGrid = styled.div`
  display: none;
  gap: ${spacing.sm};
  padding: ${spacing.sm};
  
  @media (max-width: 768px) {
    display: grid;
  }
`;

const Card = styled.div`
  background: white;
  border: 1px solid ${palette.border};
  border-radius: ${borderRadius.md};
  padding: ${spacing.sm};
`;

const CardHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: start;
  margin-bottom: ${spacing.sm};
  flex-wrap: wrap;
  gap: ${spacing.sm};
`;

const CardTitle = styled.div`
  font-weight: 600;
  color: ${palette.text};
  font-size: ${fontSize.md};
`;

const CardEmail = styled.div`
  font-size: ${fontSize.sm};
  color: ${palette.textLight};
  margin-top: ${spacing.xs};
`;

const CardInfo = styled.div`
  font-size: ${fontSize.sm};
  color: ${palette.textLight};
  margin-bottom: ${spacing.sm};
  padding-bottom: ${spacing.sm};
  border-bottom: 1px solid ${palette.border};
`;

// Botón de acciones flotante para móvil
const MobileActionsButton = styled.button`
  position: fixed;
  bottom: ${spacing.lg};
  right: ${spacing.lg};
  width: 56px;
  height: 56px;
  border-radius: 28px;
  background: ${palette.accent};
  color: white;
  border: none;
  box-shadow: 0 4px 12px rgba(0,0,0,0.2);
  cursor: pointer;
  display: none;
  align-items: center;
  justify-content: center;
  font-size: 24px;
  z-index: 100;
  
  &:hover {
    background: #0052a3;
  }
  
  @media (max-width: 768px) {
    display: flex;
  }
`;

const MobileActionsMenu = styled.div`
  position: fixed;
  bottom: 80px;
  right: ${spacing.lg};
  background: white;
  border: 1px solid ${palette.border};
  border-radius: ${borderRadius.md};
  box-shadow: 0 4px 12px rgba(0,0,0,0.15);
  display: ${props => props.$show ? 'block' : 'none'};
  z-index: 100;
  min-width: 180px;
  
  button {
    display: flex;
    align-items: center;
    gap: ${spacing.sm};
    width: 100%;
    padding: ${spacing.sm} ${spacing.md};
    border: none;
    background: none;
    text-align: left;
    cursor: pointer;
    font-size: ${fontSize.sm};
    
    &:hover {
      background: ${palette.hover};
    }
    
    &:not(:last-child) {
      border-bottom: 1px solid ${palette.border};
    }
  }
`;

const Badge = styled.span`
  display: inline-flex;
  align-items: center;
  padding: ${spacing.xs} ${spacing.sm};
  border-radius: ${borderRadius.sm};
  font-size: ${fontSize.sm};
  background: ${props => {
    if (props.$success) return palette.success + "10";
    if (props.$danger) return palette.danger + "10";
    if (props.$warning) return palette.warning + "10";
    return palette.bg;
  }};
  color: ${props => {
    if (props.$success) return palette.success;
    if (props.$danger) return palette.danger;
    if (props.$warning) return palette.warning;
    return palette.text;
  }};
  border: 1px solid ${props => {
    if (props.$success) return palette.success + "30";
    if (props.$danger) return palette.danger + "30";
    if (props.$warning) return palette.warning + "30";
    return palette.border;
  }};
`;

const Dropdown = styled.div`
  position: relative;
  display: inline-block;
`;

const DropdownMenu = styled.div`
  position: absolute;
  right: 0;
  top: 100%;
  margin-top: ${spacing.xs};
  background: white;
  border: 1px solid ${palette.border};
  border-radius: ${borderRadius.sm};
  box-shadow: 0 2px 8px rgba(0,0,0,0.1);
  min-width: 180px;
  z-index: 10;
`;

const DropdownItem = styled.button`
  display: flex;
  align-items: center;
  gap: ${spacing.sm};
  width: 100%;
  padding: ${spacing.sm} ${spacing.md};
  text-align: left;
  background: none;
  border: none;
  cursor: pointer;
  font-size: ${fontSize.sm};
  color: ${props => props.$danger ? palette.danger : palette.text};
  
  &:hover {
    background: ${palette.hover};
  }
  
  &:not(:last-child) {
    border-bottom: 1px solid ${palette.border};
  }
`;

const Overlay = styled.div`
  display: ${props => props.$show ? "block" : "none"};
  position: fixed;
  inset: 0;
  background: rgba(0,0,0,0.5);
  z-index: 9998;
`;

const Modal = styled.div`
  display: ${props => props.$show ? "block" : "none"};
  position: fixed;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  background: white;
  border-radius: ${borderRadius.lg};
  width: 90%;
  max-width: 500px;
  max-height: 90vh;
  overflow: auto;
  z-index: 9999;
  box-shadow: 0 4px 12px rgba(0,0,0,0.15);
`;

const ModalContent = styled.div`
  padding: ${spacing.xl};
  
  @media (max-width: 768px) {
    padding: ${spacing.lg};
  }
`;

const ModalHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: ${spacing.lg};
  padding-bottom: ${spacing.md};
  border-bottom: 1px solid ${palette.border};
`;

const ModalTitle = styled.h2`
  font-size: ${fontSize.lg};
  font-weight: 600;
  color: ${palette.text};
`;

const Input = styled.input`
  width: 100%;
  padding: ${spacing.sm} ${spacing.md};
  border: 1px solid ${palette.border};
  border-radius: ${borderRadius.sm};
  font-size: ${fontSize.md};
  margin-bottom: ${spacing.md};
  outline: none;
  
  &:focus {
    border-color: ${palette.accent};
    box-shadow: 0 0 0 2px rgba(0,102,204,0.1);
  }
`;

const Select = styled.select`
  width: 100%;
  padding: ${spacing.sm} ${spacing.md};
  border: 1px solid ${palette.border};
  border-radius: ${borderRadius.sm};
  font-size: ${fontSize.md};
  margin-bottom: ${spacing.md};
  background: white;
  outline: none;
  
  &:focus {
    border-color: ${palette.accent};
    box-shadow: 0 0 0 2px rgba(0,102,204,0.1);
  }
`;

const ErrorBox = styled.div`
  padding: ${spacing.md};
  background: ${palette.danger}10;
  border: 1px solid ${palette.danger}30;
  border-radius: ${borderRadius.sm};
  color: ${palette.danger};
  font-size: ${fontSize.sm};
  margin-bottom: ${spacing.md};
`;

const SuccessBox = styled.div`
  padding: ${spacing.md};
  background: ${palette.success}10;
  border: 1px solid ${palette.success}30;
  border-radius: ${borderRadius.sm};
  color: ${palette.success};
  font-size: ${fontSize.sm};
  margin-bottom: ${spacing.md};
`;

const ActionButtons = styled.div`
  display: flex;
  gap: ${spacing.sm};
  justify-content: flex-end;
  margin-top: ${spacing.lg};
`;

const Divider = styled.hr`
  border: none;
  border-top: 1px solid ${palette.border};
  margin: ${spacing.md} 0;
`;

const WaiverBox = styled.div`
  border: 1px solid ${palette.border};
  border-radius: ${borderRadius.sm};
  padding: ${spacing.md};
  background: ${palette.bg};
  max-height: 300px;
  overflow: auto;
  font-size: ${fontSize.sm};
  line-height: 1.5;
  margin-bottom: ${spacing.md};
`;

const CheckboxRow = styled.label`
  display: flex;
  gap: ${spacing.sm};
  align-items: flex-start;
  font-size: ${fontSize.sm};
  margin-bottom: ${spacing.md};
  cursor: pointer;
`;

const SigCanvas = styled.canvas`
  width: 100%;
  height: 150px;
  border: 1px solid ${palette.border};
  border-radius: ${borderRadius.sm};
  background: white;
  touch-action: none;
`;

const SigRow = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: ${spacing.sm};
`;

const RadioRow = styled.div`
  display: flex;
  gap: ${spacing.md};
  margin-bottom: ${spacing.md};
  flex-wrap: wrap;
  
  label {
    display: flex;
    align-items: center;
    gap: ${spacing.xs};
    cursor: pointer;
  }
`;

const StatsRow = styled.div`
  display: flex;
  gap: ${spacing.md};
  flex-wrap: wrap;
  margin-bottom: ${spacing.md};
`;

const StatPill = styled.div`
  display: flex;
  align-items: baseline;
  gap: ${spacing.xs};
  padding: ${spacing.sm} ${spacing.md};
  background: ${palette.bg};
  border-radius: ${borderRadius.sm};
  border: 1px solid ${palette.border};
`;

const StatPillNum = styled.span`
  font-size: ${fontSize.xl};
  font-weight: 600;
  color: ${palette.accent};
`;

const StatPillLabel = styled.span`
  font-size: ${fontSize.sm};
  color: ${palette.textLight};
`;

const DayGroup = styled.div`
  border: 1px solid ${palette.border};
  border-radius: ${borderRadius.sm};
  margin-bottom: ${spacing.md};
  overflow: hidden;
`;

const DayGroupHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: ${spacing.sm} ${spacing.md};
  background: ${palette.bg};
  border-bottom: 1px solid ${palette.border};
  font-weight: 600;
`;

const AttendanceRow = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: ${spacing.sm} ${spacing.md};
  border-bottom: 1px solid ${palette.border};
  
  &:last-child {
    border-bottom: none;
  }
`;

const PeriodTabs = styled.div`
  display: flex;
  gap: ${spacing.sm};
  margin-bottom: ${spacing.md};
  flex-wrap: wrap;
`;

const PeriodTab = styled.button`
  padding: ${spacing.xs} ${spacing.md};
  border-radius: ${borderRadius.sm};
  font-size: ${fontSize.sm};
  background: ${props => props.$active ? palette.accent : "white"};
  color: ${props => props.$active ? "white" : palette.text};
  border: 1px solid ${props => props.$active ? palette.accent : palette.border};
  cursor: pointer;
  
  &:hover {
    background: ${props => props.$active ? palette.accent : palette.hover};
  }
`;

// ============================================
// EDIT VISIT MODAL
// ============================================
const EditVisitModal = ({ visit, user, onClose, onSave, busy }) => {
  const { maskName, maskEmail } = usePrivacy();
  const [status, setStatus] = useState(visit?.status || "checked_in");
  const [notes, setNotes] = useState(visit?.notes || "");
  const [date, setDate] = useState(() => {
    const d = visit?.checkedInAt || visit?.date;
    return d ? new Date(d).toISOString().slice(0, 16) : "";
  });

  const handleSave = async () => {
    await onSave({
      visitId: visit._id,
      userId: user._id,
      status,
      notes,
      date: new Date(date).toISOString()
    });
    onClose();
  };

  return (
    <ModalContent>
      <ModalHeader>
        <ModalTitle>Editar visita</ModalTitle>
      </ModalHeader>
      <div style={{ marginBottom: spacing.md }}>
        <div style={{ fontWeight: 600, marginBottom: spacing.xs }}>Usuario</div>
        <div>{maskName(user.name)} ({maskEmail(user.email)})</div>
      </div>
      <div style={{ marginBottom: spacing.md }}>
        <div style={{ fontWeight: 600, marginBottom: spacing.xs }}>Fecha y hora</div>
        <Input
          type="datetime-local"
          value={date}
          onChange={(e) => setDate(e.target.value)}
        />
      </div>
      <div style={{ marginBottom: spacing.md }}>
        <div style={{ fontWeight: 600, marginBottom: spacing.xs }}>Estado</div>
        <Select value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="checked_in">Check-in ✅</option>
          <option value="registered">Registrado</option>
          <option value="no_show">No asistió</option>
          <option value="cancelled">Cancelado</option>
        </Select>
      </div>
      <div style={{ marginBottom: spacing.md }}>
        <div style={{ fontWeight: 600, marginBottom: spacing.xs }}>Notas (opcional)</div>
        <Input
          placeholder="Ej: Entró tarde, etc."
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />
      </div>
      <ActionButtons>
        <Button onClick={handleSave} disabled={busy}>Guardar cambios</Button>
        <Button $variant="secondary" onClick={onClose}>Cancelar</Button>
      </ActionButtons>
    </ModalContent>
  );
};

// ============================================
// HELPERS
// ============================================
const DAY_NAMES = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
const MONTH_NAMES = ["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"];

const formatDateTime = (date) => {
  try { return new Date(date).toLocaleString("es-CO"); }
  catch { return "—"; }
};

const formatDate = (date) => {
  try { return new Date(date).toLocaleDateString("es-CO"); }
  catch { return "—"; }
};

function sameDay(a, b) {
  if (!a || !b) return false;
  const A = new Date(a), B = new Date(b);
  return A.getFullYear() === B.getFullYear() && A.getMonth() === B.getMonth() && A.getDate() === B.getDate();
}

function hasCheckedInToday(user) {
  const today = new Date();
  // Fuente de verdad: el array de visitas (refleja cancelaciones). NO usar
  // lastCheckinAt/lastVisitAt/checkedInToday como atajo: son campos pegajosos
  // que NO se limpian al cancelar, y dejaban al usuario marcado como presente
  // aunque se cancelara su check-in.
  const visits = user?.visits || [];
  return visits.some((v) => {
    const ts = v?.checkedInAt || v?.date;
    return ts && sameDay(ts, today) && v?.status !== "cancelled";
  });
}

function getMensualidadStatus(mensualidad) {
  if (!mensualidad?.endDate) return { active: false, label: "Sin mensualidad", days: null };
  const now = new Date();
  const end = new Date(mensualidad.endDate);
  const active = end > now;
  const days = Math.ceil((end - now) / (1000 * 60 * 60 * 24));
  const label = active
    ? `Vence ${end.toLocaleDateString("es-CO")}`
    : `Vencida ${end.toLocaleDateString("es-CO")}`;
  return { active, label, days };
}

function userCanCheckin(user) {
  if (user?.accessType === "ticketera") return (user.credits ?? 0) > 0;
  if (user?.accessType === "mensualidad") return getMensualidadStatus(user.mensualidad).active;
  return false;
}

function formatDayLabel(dateInput) {
  if (!dateInput) return "Fecha desconocida";
  try {
    const d = new Date(dateInput);
    const today = new Date();
    const yesterday = new Date();
    yesterday.setDate(today.getDate() - 1);
    if (sameDay(d, today)) return "Hoy";
    if (sameDay(d, yesterday)) return "Ayer";
    return d.toLocaleDateString("es-CO", { weekday: "long", day: "numeric", month: "long" });
  } catch { return String(dateInput); }
}

function formatCheckinTime(dateInput) {
  if (!dateInput) return null;
  try {
    return new Date(dateInput).toLocaleTimeString("es-CO", {
      hour: "2-digit", minute: "2-digit", hour12: true,
    });
  } catch { return null; }
}

function startOfPeriod(period) {
  const d = new Date();
  if (period === "week") {
    const day = d.getDay();
    d.setDate(d.getDate() - day);
  } else if (period === "month") {
    d.setDate(1);
  }
  d.setHours(0, 0, 0, 0);
  return d;
}

function formatTabDate(dateStr) {
  const [y, m, d] = dateStr.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  return `${DAY_NAMES[date.getDay()]} ${d} ${MONTH_NAMES[m - 1]}`;
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
  for (let i = 3; i < data.length; i += 4) { if (data[i] !== 0) return false; }
  return true;
}

const INITIAL_FORM = {
  name: "", email: "", documentType: "CC", documentNumber: "",
  phone: "", epsName: "", emergencyContactName: "", emergencyContactPhone: "",
  accessType: "ticketera", mensualidadMeses: 1, esMinor: false,
};

// ============================================
// SUBCOMPONENTES
// ============================================
function AccessInfo({ user, onRenovar, onChangeAccess, busy }) {
  if (user.accessType === "mensualidad") {
    const { active, label } = getMensualidadStatus(user.mensualidad);
    return (
      <div style={{ display: "flex", gap: spacing.sm, alignItems: "center", flexWrap: "wrap" }}>
        <Badge $success={active} $danger={!active}>
          {active ? "✓" : "✗"} {label}
        </Badge>
        <Button $variant="secondary" $small onClick={() => onRenovar(user._id)} disabled={busy}>
          Renovar
        </Button>
        <Button $variant="secondary" $small onClick={() => onChangeAccess(user)} disabled={busy}>
          Cambiar
        </Button>
      </div>
    );
  }
  return (
    <div style={{ display: "flex", gap: spacing.sm, alignItems: "center", flexWrap: "wrap" }}>
      <Badge>{user.credits ?? 0} créditos</Badge>
      <Button $variant="secondary" $small onClick={() => onChangeAccess(user)} disabled={busy}>
        Cambiar
      </Button>
    </div>
  );
}

function ActionMenu({ user, onCheckin, onMoon, onViewProfile, onCredits, onHistory, onDelete, onEditVisit, busy }) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef(null);
  
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener("click", handleClickOutside);
    return () => document.removeEventListener("click", handleClickOutside);
  }, []);
  
  const lastVisit = user?.visits?.[0];
  
  return (
    <Dropdown ref={menuRef}>
      <Button $variant="secondary" onClick={() => setOpen(!open)} disabled={busy}>
        ⋯ Acciones
      </Button>
      {open && (
        <DropdownMenu>
          <DropdownItem onClick={() => { onCheckin(user); setOpen(false); }}>
            ✓ Check-in
          </DropdownItem>
          <DropdownItem onClick={() => { onMoon(user); setOpen(false); }}>
            🌑 MoonBoard
          </DropdownItem>
          <DropdownItem onClick={() => { onViewProfile(user); setOpen(false); }}>
            👤 Ver datos
          </DropdownItem>
          <DropdownItem onClick={() => { onCredits(user._id); setOpen(false); }}>
            💰 Créditos
          </DropdownItem>
          <DropdownItem onClick={() => { onHistory(user); setOpen(false); }}>
            📜 Historial
          </DropdownItem>
          {lastVisit && (
            <DropdownItem onClick={() => { onEditVisit(user, lastVisit); setOpen(false); }}>
              ✏️ Editar última visita
            </DropdownItem>
          )}
          <DropdownItem $danger onClick={() => { onDelete(user); setOpen(false); }}>
            🗑️ Eliminar
          </DropdownItem>
        </DropdownMenu>
      )}
    </Dropdown>
  );
}

// Componente de acciones móvil
function MobileActionMenu({ user, onCheckin, onMoon, onViewProfile, onCredits, onHistory, onDelete, onEditVisit, busy }) {
  const { maskName } = usePrivacy();
  const [open, setOpen] = useState(false);
  
  const lastVisit = user?.visits?.[0];
  const actions = [
    { icon: "✓", label: "Check-in", action: () => onCheckin(user) },
    { icon: "🌑", label: "MoonBoard", action: () => onMoon(user) },
    { icon: "👤", label: "Ver datos", action: () => onViewProfile(user) },
    { icon: "💰", label: "Créditos", action: () => onCredits(user._id) },
    { icon: "📜", label: "Historial", action: () => onHistory(user) },
    ...(lastVisit ? [{ icon: "✏️", label: "Editar visita", action: () => onEditVisit(user, lastVisit) }] : []),
    { icon: "🗑️", label: "Eliminar", action: () => onDelete(user), danger: true }
  ];
  
  return (
    <>
      <Button $small onClick={() => setOpen(true)} disabled={busy}>
        ⋯ Acciones
      </Button>
      {open && (
        <Overlay $show={open} onClick={() => setOpen(false)} />
      )}
      {open && (
        <div style={{
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          background: 'white',
          borderRadius: `${borderRadius.lg} ${borderRadius.lg} 0 0`,
          zIndex: 10000,
          maxHeight: '70vh',
          overflow: 'auto',
          padding: spacing.md,
          boxShadow: '0 -4px 12px rgba(0,0,0,0.1)'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.md, paddingBottom: spacing.sm, borderBottom: `1px solid ${palette.border}` }}>
            <span style={{ fontWeight: 600 }}>Acciones para {maskName(user.name?.split(' ')[0]) || 'usuario'}</span>
            <Button $variant="secondary" $small onClick={() => setOpen(false)}>Cerrar</Button>
          </div>
          {actions.map((action, idx) => (
            <Button
              key={idx}
              $variant={action.danger ? "danger" : "secondary"}
              onClick={() => { action.action(); setOpen(false); }}
              disabled={busy}
              style={{ marginBottom: spacing.sm, width: '100%', justifyContent: 'flex-start' }}
            >
              {action.icon} {action.label}
            </Button>
          ))}
        </div>
      )}
    </>
  );
}

function ModalPortal({ children }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return null;
  return createPortal(children, document.body);
}

function AuditFeed({ events, loading }) {
  const { maskName, maskEmail } = usePrivacy();

  // Los summaries vienen del servidor con nombre/email embebidos en texto libre;
  // se sustituyen usando los campos estructurados del evento.
  const displaySummary = (e) => {
    let summary = e.summary || `${e.action} - ${e.userName || e.userEmail || ""}`;
    if (e.userName) summary = summary.split(e.userName).join(maskName(e.userName));
    if (e.userEmail) summary = summary.split(e.userEmail).join(maskEmail(e.userEmail));
    return summary;
  };

  return (
    <div style={{ 
      padding: spacing.lg, 
      borderLeft: `1px solid ${palette.border}`,
      background: palette.bg,
      minWidth: "280px",
      display: "none",
      "@media (min-width: 1024px)": {
        display: "block"
      }
    }}>
      <div style={{ fontWeight: 600, marginBottom: spacing.md }}>
        Actividad reciente
        {loading && <span style={{ color: palette.textLight, marginLeft: spacing.sm }}>···</span>}
      </div>
      <div style={{ display: "grid", gap: spacing.sm }}>
        {(events || []).slice(0, 15).map((e) => (
          <div key={e._id || `${e.ts}-${e.action}`} style={{ 
            fontSize: fontSize.sm, 
            padding: spacing.sm,
            borderBottom: `1px solid ${palette.border}`,
            background: "white",
            borderRadius: borderRadius.sm
          }}>
            <div style={{ fontWeight: 500 }}>{displaySummary(e)}</div>
            <div style={{ color: palette.textLight, fontSize: fontSize.sm, marginTop: spacing.xs }}>
              {formatDateTime(e.ts)}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ============================================
// COMPONENTE PRINCIPAL
// ============================================
export default function AdminPage() {
  return (
    <PrivacyProvider>
      <AdminPanel />
    </PrivacyProvider>
  );
}

function AdminPanel() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const { privacyMode, togglePrivacyMode, maskName, maskEmail, maskPhone, maskDocument } = usePrivacy();

  // Estados de datos
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [auditEvents, setAuditEvents] = useState([]);
  const [auditLoading, setAuditLoading] = useState(false);
  const [quickFilter, setQuickFilter] = useState("all");
  const [query, setQuery] = useState("");
  const [uiError, setUiError] = useState("");
  const [busy, setBusy] = useState(false);

  // Dashboard collapsible
  const [dashboardExpanded, setDashboardExpanded] = useState(true);

  // Paginación, Filtros, Ordenamiento
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(20);
  const [sortField, setSortField] = useState("name");
  const [sortDirection, setSortDirection] = useState("asc");
  
  const [registrationFilter, setRegistrationFilter] = useState("all");
  const [registrationStartDate, setRegistrationStartDate] = useState("");
  const [registrationEndDate, setRegistrationEndDate] = useState("");
  
  const [showCheckinsByDateModal, setShowCheckinsByDateModal] = useState(false);
  const [selectedDate, setSelectedDate] = useState("");
  const [checkinsByDate, setCheckinsByDate] = useState([]);

  // KPIs
  const [kpiPeriod, setKpiPeriod] = useState("week");

  // Modales
  const [showCreditsModal, setShowCreditsModal] = useState(false);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [showNewUserModal, setShowNewUserModal] = useState(false);
  const [showRenovarModal, setShowRenovarModal] = useState(false);
  const [showCheckinModal, setShowCheckinModal] = useState(false);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [showWaiverModal, setShowWaiverModal] = useState(false);
  const [showAccessModal, setShowAccessModal] = useState(false);
  const [showAttendanceModal, setShowAttendanceModal] = useState(false);
  const [showMoonModal, setShowMoonModal] = useState(false);
  const [showCancelMoonModal, setShowCancelMoonModal] = useState(false);
  const [showEditVisitModal, setShowEditVisitModal] = useState(false);

  // New user
  const [newUserStep, setNewUserStep] = useState(1);
  const [newUserForm, setNewUserForm] = useState(INITIAL_FORM);
  const [waiverAccepted, setWaiverAccepted] = useState(false);
  const canvasRef = useRef(null);
  const drawingRef = useRef(false);
  const hasInkRef = useRef(false);
  const lastPointRef = useRef({ x: 0, y: 0 });

  // Seleccionados
  const [selectedUser, setSelectedUser] = useState(null);
  const [viewingUser, setViewingUser] = useState(null);
  const [waiverUser, setWaiverUser] = useState(null);
  const [checkinUser, setCheckinUser] = useState(null);
  const [checkinSuccess, setCheckinSuccess] = useState("");
  
  // Edit visit
  const [editingVisit, setEditingVisit] = useState(null);
  const [editingVisitUser, setEditingVisitUser] = useState(null);

  // Access modal
  const [accessUser, setAccessUser] = useState(null);
  const [accessTypeDraft, setAccessTypeDraft] = useState("ticketera");
  const [accessMonthsDraft, setAccessMonthsDraft] = useState(1);
  const [accessCreditsDraft, setAccessCreditsDraft] = useState(0);

  // Credits / renovar
  const [credits, setCredits] = useState(0);
  const [creditsSuccess, setCreditsSuccess] = useState("");
  const [renovarMonths, setRenovarMonths] = useState(1);

  // Attendance
  const [attendancePeriod, setAttendancePeriod] = useState("week");
  const [attendanceSearch, setAttendanceSearch] = useState("");

  // Profile editing
  const [editingProfile, setEditingProfile] = useState(false);
  const [editForm, setEditForm] = useState({});
  const [editSuccess, setEditSuccess] = useState("");

  // History
  const [historyUser, setHistoryUser] = useState(null);
  const [historyVisits, setHistoryVisits] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  // Moon
  const [moonUser, setMoonUser] = useState(null);
  const [moonDays, setMoonDays] = useState([]);
  const [moonSelectedDay, setMoonSelectedDay] = useState(0);
  const [moonLoading, setMoonLoading] = useState(false);
  const [moonSubmitting, setMoonSubmitting] = useState(false);
  const [moonMsg, setMoonMsg] = useState("");
  const [moonSuccess, setMoonSuccess] = useState("");
  const [cancelMoonRes, setCancelMoonRes] = useState(null);
  const [moonAttendance, setMoonAttendance] = useState([]);

  const didInit = useRef(false);
  const waiverCityLine = useMemo(
    () => `Bucaramanga, Santander — ${new Date().toLocaleDateString("es-CO")}`, []
  );

  const waiverSnapshotNewUser = useMemo(() => getWaiverSnapshot({
    cityLine: waiverCityLine,
    isMinor: !!newUserForm.esMinor,
    participantName: (newUserForm.name || "").trim(),
  }), [waiverCityLine, newUserForm.esMinor, newUserForm.name]);

  const waiverSnapshotExistingUser = useMemo(() => getWaiverSnapshot({
    cityLine: waiverCityLine,
    isMinor: !!waiverUser?.esMinor,
    participantName: (waiverUser?.name || "").trim(),
  }), [waiverCityLine, waiverUser?.esMinor, waiverUser?.name]);

  // Body scroll lock
  useEffect(() => {
    const open = showCreditsModal || showProfileModal || showNewUserModal || showRenovarModal ||
      showCheckinModal || showHistoryModal || showWaiverModal || showAccessModal ||
      showAttendanceModal || showMoonModal || showCancelMoonModal || showEditVisitModal || showCheckinsByDateModal;
    document.body.classList.toggle("modal-open", open);
    return () => document.body.classList.remove("modal-open");
  }, [showCreditsModal, showProfileModal, showNewUserModal, showRenovarModal,
    showCheckinModal, showHistoryModal, showWaiverModal, showAccessModal,
    showAttendanceModal, showMoonModal, showCancelMoonModal, showEditVisitModal, showCheckinsByDateModal]);

  // Data fetching
  const fetchUsers = useCallback(async () => {
    setUiError("");
    setLoading(true);
    try {
      const response = await axios.get("/api/admin/users");
      setUsers(Array.isArray(response.data?.users) ? response.data.users : []);
    } catch (error) {
      console.error("Error fetching users:", error);
      setUiError("No se pudieron cargar los usuarios.");
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchAudit = useCallback(async () => {
    setAuditLoading(true);
    try {
      const res = await axios.get("/api/admin/audit?limit=40");
      setAuditEvents(Array.isArray(res.data?.events) ? res.data.events : []);
    } catch (e) {
      console.warn("Audit fetch failed:", e?.message);
    } finally {
      setAuditLoading(false);
    }
  }, []);

  const fetchMoonSlots = useCallback(async () => {
    setMoonLoading(true);
    setMoonMsg("");
    try {
      const res = await axios.get("/api/moon/slots");
      setMoonDays(res.data?.days || []);
    } catch {
      setMoonMsg("No se pudieron cargar los slots.");
    } finally {
      setMoonLoading(false);
    }
  }, []);

  const fetchMoonAttendance = useCallback(async () => {
    try {
      const res = await axios.get("/api/admin/moon/reservations");
      setMoonAttendance(Array.isArray(res.data?.reservations) ? res.data.reservations : []);
    } catch {
      setMoonAttendance([]);
    }
  }, []);

  useEffect(() => {
    if (didInit.current) return;
    if (status === "loading") return;
    didInit.current = true;
    if (!session) { signIn(); return; }
    if (!session.isAdmin) { router.push("/"); return; }
    fetchUsers();
    fetchAudit();
  }, [session, status, router, fetchUsers, fetchAudit]);

  const appendAuditEvent = (evt) => {
    if (!evt) return;
    setAuditEvents((prev) => [evt, ...(prev || [])].slice(0, 80));
  };

  const fetchCheckinsByDate = async (date) => {
    if (!date) return;
    setBusy(true);
    try {
      const res = await axios.get(`/api/admin/checkins?date=${date}`);
      setCheckinsByDate(res.data?.checkins || []);
      setSelectedDate(date);
      setShowCheckinsByDateModal(true);
    } catch (error) {
      setUiError("No se pudieron cargar los check-ins de esa fecha.");
    } finally {
      setBusy(false);
    }
  };

  const getRegistrationDateFilter = useCallback(() => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    
    switch (registrationFilter) {
      case "today":
        return { start: today, end: new Date(today.getTime() + 86400000) };
      case "week":
        const weekStart = new Date(now);
        weekStart.setDate(now.getDate() - now.getDay());
        weekStart.setHours(0, 0, 0, 0);
        return { start: weekStart, end: now };
      case "month":
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
        return { start: monthStart, end: now };
      case "custom":
        return { 
          start: registrationStartDate ? new Date(registrationStartDate) : null,
          end: registrationEndDate ? new Date(registrationEndDate) : null
        };
      default:
        return null;
    }
  }, [registrationFilter, registrationStartDate, registrationEndDate]);

  const handleSort = (field) => {
    if (sortField === field) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDirection("asc");
    }
    setCurrentPage(1);
  };

  const getSortIcon = (field) => {
    if (sortField !== field) return <SortIcon $active={false}>↕️</SortIcon>;
    return <SortIcon $active={true}>{sortDirection === "asc" ? "↑" : "↓"}</SortIcon>;
  };

  const filteredAndSortedUsers = useMemo(() => {
    let result = [...users];
    
    const q = query.trim().toLowerCase();
    if (q) {
      result = result.filter((u) => 
        (u?.name || "").toLowerCase().includes(q) || 
        (u?.email || "").toLowerCase().includes(q)
      );
    }
    
    switch (quickFilter) {
      case "waiver":
        result = result.filter((u) => u?.waiverStatus !== "signed");
        break;
      case "mensualidadVencida":
        result = result.filter((u) => u?.accessType === "mensualidad" && !getMensualidadStatus(u?.mensualidad).active);
        break;
      case "sinCreditos":
        result = result.filter((u) => u?.accessType === "ticketera" && (u?.credits ?? 0) <= 0);
        break;
      case "menores":
        result = result.filter((u) => !!u?.esMinor);
        break;
      case "checkinHoy":
        result = result.filter((u) => hasCheckedInToday(u));
        break;
      default:
        break;
    }
    
    const dateFilter = getRegistrationDateFilter();
    if (dateFilter && dateFilter.start) {
      result = result.filter((u) => {
        const createdAt = u?.createdAt ? new Date(u.createdAt) : null;
        if (!createdAt) return false;
        if (dateFilter.end) {
          return createdAt >= dateFilter.start && createdAt <= dateFilter.end;
        }
        return createdAt >= dateFilter.start;
      });
    }
    
    result.sort((a, b) => {
      let aVal, bVal;
      switch (sortField) {
        case "name":
          aVal = (a.name || "").toLowerCase();
          bVal = (b.name || "").toLowerCase();
          break;
        case "email":
          aVal = (a.email || "").toLowerCase();
          bVal = (b.email || "").toLowerCase();
          break;
        case "credits":
          aVal = a.accessType === "mensualidad" ? 999999 : (a.credits ?? 0);
          bVal = b.accessType === "mensualidad" ? 999999 : (b.credits ?? 0);
          break;
        case "lastCheckin":
          aVal = a.lastCheckinAt ? new Date(a.lastCheckinAt).getTime() : 0;
          bVal = b.lastCheckinAt ? new Date(b.lastCheckinAt).getTime() : 0;
          break;
        case "createdAt":
          aVal = a.createdAt ? new Date(a.createdAt).getTime() : 0;
          bVal = b.createdAt ? new Date(b.createdAt).getTime() : 0;
          break;
        default:
          aVal = (a.name || "").toLowerCase();
          bVal = (b.name || "").toLowerCase();
      }
      if (sortDirection === "asc") return aVal > bVal ? 1 : -1;
      return aVal < bVal ? 1 : -1;
    });
    
    return result;
  }, [users, query, quickFilter, sortField, sortDirection, getRegistrationDateFilter]);

  const totalPages = Math.ceil(filteredAndSortedUsers.length / itemsPerPage);
  const paginatedUsers = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredAndSortedUsers.slice(start, start + itemsPerPage);
  }, [filteredAndSortedUsers, currentPage, itemsPerPage]);

  const goToPage = (page) => {
    setCurrentPage(Math.max(1, Math.min(page, totalPages)));
  };

  useEffect(() => {
    setCurrentPage(1);
  }, [query, quickFilter, sortField, sortDirection, registrationFilter, registrationStartDate, registrationEndDate]);

  const kpiData = useMemo(() => {
    const now = new Date();
    let periodStart;
    
    if (kpiPeriod === "today") {
      periodStart = new Date();
      periodStart.setHours(0, 0, 0, 0);
    } else if (kpiPeriod === "week") {
      periodStart = new Date();
      const day = periodStart.getDay();
      periodStart.setDate(periodStart.getDate() - day);
      periodStart.setHours(0, 0, 0, 0);
    } else {
      periodStart = new Date();
      periodStart.setDate(1);
      periodStart.setHours(0, 0, 0, 0);
    }
    
    const previousPeriodStart = new Date(periodStart);
    const periodEnd = new Date();
    
    let totalCheckins = 0;
    let totalMensualidadCheckins = 0;
    let totalTicketeraCheckins = 0;
    let uniqueUsers = new Set();
    let mensualidadUsers = new Set();
    let ticketeraUsers = new Set();
    
    const previousPeriodEnd = new Date(periodStart);
    previousPeriodEnd.setMilliseconds(-1);
    const previousPeriodStartDate = new Date(previousPeriodEnd);
    const duration = periodEnd - periodStart;
    previousPeriodStartDate.setTime(previousPeriodStartDate.getTime() - duration);
    
    let prevTotalCheckins = 0;
    let prevUniqueUsers = new Set();
    
    users.forEach(user => {
      const visits = user?.visits || [];
      visits.forEach(visit => {
        const visitDate = new Date(visit.date || visit.checkedInAt);
        const status = visit.status;
        if (status === "checked_in" || status === "registered") {
          if (visitDate >= periodStart && visitDate <= periodEnd) {
            totalCheckins++;
            uniqueUsers.add(user._id);
            if (user.accessType === "mensualidad") {
              totalMensualidadCheckins++;
              mensualidadUsers.add(user._id);
            } else {
              totalTicketeraCheckins++;
              ticketeraUsers.add(user._id);
            }
          }
          if (visitDate >= previousPeriodStartDate && visitDate <= previousPeriodEnd) {
            prevTotalCheckins++;
            prevUniqueUsers.add(user._id);
          }
        }
      });
    });
    
    const checkinChange = prevTotalCheckins === 0 ? 100 : ((totalCheckins - prevTotalCheckins) / prevTotalCheckins) * 100;
    const usersChange = prevUniqueUsers.size === 0 ? 100 : ((uniqueUsers.size - prevUniqueUsers.size) / prevUniqueUsers.size) * 100;
    const estimatedRevenue = totalTicketeraCheckins * 15000;
    
    return {
      totalCheckins,
      uniqueUsers: uniqueUsers.size,
      mensualidadCheckins: totalMensualidadCheckins,
      ticketeraCheckins: totalTicketeraCheckins,
      mensualidadUsers: mensualidadUsers.size,
      ticketeraUsers: ticketeraUsers.size,
      estimatedRevenue,
      checkinChange,
      usersChange
    };
  }, [users, kpiPeriod]);

  const handleEditVisit = (user, visit) => {
    setEditingVisitUser(user);
    setEditingVisit(visit);
    setShowEditVisitModal(true);
  };

  const submitEditVisit = async ({ visitId, userId, status, notes, date }) => {
    setBusy(true);
    setUiError("");
    try {
      const res = await axios.put(`/api/admin/visits/${visitId}`, {
        userId,
        status,
        notes,
        date
      });
      if (res.data?.auditEvent) appendAuditEvent(res.data.auditEvent);
      await fetchUsers();
      setShowEditVisitModal(false);
      setEditingVisit(null);
      setEditingVisitUser(null);
    } catch (error) {
      setUiError(error?.response?.data?.message || "No se pudo editar la visita.");
    } finally {
      setBusy(false);
    }
  };

  const exportToCSV = () => {
    const headers = ["Nombre", "Email", "Teléfono", "Documento", "Tipo Acceso", "Créditos/Mensualidad", "Waiver", "Último Check-in", "Fecha Registro"];
    const rows = filteredAndSortedUsers.map(user => [
      user.name || "",
      user.email || "",
      user.phone || "",
      `${user.documentType || ""} ${user.documentNumber || ""}`,
      user.accessType === "mensualidad" ? "Mensualidad" : "Tiquetera",
      user.accessType === "mensualidad" 
        ? getMensualidadStatus(user.mensualidad).label 
        : `${user.credits ?? 0} créditos`,
      user.waiverStatus === "signed" ? "Firmado" : "Pendiente",
      user.lastCheckinAt ? formatDateTime(user.lastCheckinAt) : "Nunca",
      user.createdAt ? formatDate(user.createdAt) : "—"
    ]);
    
    const csvContent = [headers, ...rows].map(row => row.map(cell => `"${cell}"`).join(",")).join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.href = url;
    link.setAttribute("download", `usuarios_${formatDate(new Date())}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleDeleteUser = async (user) => {
    if (!window.confirm(`¿Eliminar a ${maskName(user.name) || maskEmail(user.email)}? Esta acción no se puede deshacer.`)) {
      return;
    }
    
    setUiError("");
    setBusy(true);
    try {
      const res = await axios.delete(`/api/admin/users/${user._id}/delete`);
      if (res.data?.auditEvent) appendAuditEvent(res.data.auditEvent);
      
      if (viewingUser?._id === user._id) {
        setShowProfileModal(false);
        setViewingUser(null);
      }
      if (checkinUser?._id === user._id) setShowCheckinModal(false);
      if (historyUser?._id === user._id) setShowHistoryModal(false);
      if (moonUser?._id === user._id) setShowMoonModal(false);
      
      await fetchUsers();
      await fetchAudit();
    } catch (error) {
      setUiError(error?.response?.data?.message || "No se pudo eliminar el usuario.");
    } finally {
      setBusy(false);
    }
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
      const res = await axios.post("/api/admin/visits/checkin", { userId: checkinUser._id });
      const code = res.data?.code;
      if (code === "ALREADY_CHECKED_IN") {
        setCheckinSuccess("✅ Este usuario ya hizo check-in hoy.");
      } else {
        const creditsMsg = checkinUser.accessType === "ticketera"
          ? ` Créditos restantes: ${res.data?.credits ?? ""}` : "";
        setCheckinSuccess(`✅ Check-in registrado.${creditsMsg}`);
      }
      if (res.data?.auditEvent) appendAuditEvent(res.data.auditEvent);
      await fetchUsers();
    } catch (error) {
      setUiError(error?.response?.data?.message || "No se pudo registrar el check-in.");
    } finally {
      setBusy(false);
    }
  };

  const handleAddCredits = (userId) => {
    setUiError("");
    setCreditsSuccess("");
    setSelectedUser(userId);
    setCredits(0);
    setShowCreditsModal(true);
  };

  const submitCredits = async () => {
    setUiError("");
    setCreditsSuccess("");
    const amount = Number(credits);
    if (!selectedUser) { setUiError("Selecciona un usuario."); return; }
    if (!Number.isFinite(amount)) { setUiError("Créditos inválidos."); return; }
    setBusy(true);
    try {
      const res = await axios.post("/api/admin/adjust-credits", {
        userId: selectedUser, credits: parseInt(amount, 10),
      });
      if (res.data?.auditEvent) appendAuditEvent(res.data.auditEvent);
      setCreditsSuccess("✅ Créditos actualizados correctamente.");
      setCredits(0);
      await fetchUsers();
      setTimeout(() => { setShowCreditsModal(false); setCreditsSuccess(""); }, 1400);
    } catch (error) {
      setUiError("No se pudieron modificar los créditos.");
    } finally {
      setBusy(false);
    }
  };

  const handleRenovar = (userId) => {
    setUiError("");
    setSelectedUser(userId);
    setRenovarMonths(1);
    setShowRenovarModal(true);
  };

  const submitRenovar = async () => {
    setUiError("");
    if (!selectedUser) return;
    setBusy(true);
    try {
      const res = await axios.post("/api/admin/mensualidad/renovar", {
        userId: selectedUser, months: renovarMonths,
      });
      setShowRenovarModal(false);
      if (res.data?.auditEvent) appendAuditEvent(res.data.auditEvent);
      await fetchUsers();
    } catch (error) {
      setUiError(error?.response?.data?.message || "No se pudo renovar.");
    } finally {
      setBusy(false);
    }
  };

  const openAccessModal = (user) => {
    setUiError("");
    setAccessUser(user);
    setAccessTypeDraft(user?.accessType || "ticketera");
    setAccessMonthsDraft(1);
    setAccessCreditsDraft(0);
    setShowAccessModal(true);
  };

  const submitAccessType = async () => {
    setUiError("");
    if (!accessUser?._id) return;
    setBusy(true);
    try {
      const payload = {
        userId: accessUser._id,
        accessType: accessTypeDraft,
        months: accessTypeDraft === "mensualidad" ? accessMonthsDraft : undefined,
        credits: accessTypeDraft === "ticketera" ? Number(accessCreditsDraft || 0) : undefined,
      };
      const res = await axios.post("/api/admin/users/set-access-type", payload);
      if (res.data?.auditEvent) appendAuditEvent(res.data.auditEvent);
      setShowAccessModal(false);
      setAccessUser(null);
      if (viewingUser?._id && String(viewingUser._id) === String(payload.userId)) {
        const updated = res.data?.user;
        if (updated) setViewingUser(updated);
      }
      await fetchUsers();
    } catch (e) {
      setUiError(e?.response?.data?.message || "No se pudo cambiar la modalidad.");
    } finally {
      setBusy(false);
    }
  };

  const handleViewProfile = (user) => {
    setUiError("");
    setEditingProfile(false);
    setEditSuccess("");
    setEditForm({
      name: user.name || "",
      phone: user.phone || "",
      documentType: user.documentType || "CC",
      documentNumber: user.documentNumber || "",
      epsName: user.epsName || "",
      emergencyContactName: user.emergencyContactName || "",
      emergencyContactPhone: user.emergencyContactPhone || "",
    });
    setViewingUser(user);
    setShowProfileModal(true);
  };

  const submitEditProfile = async () => {
    setUiError("");
    setEditSuccess("");
    if (!viewingUser?._id) return;
    setBusy(true);
    try {
      const res = await axios.post("/api/admin/users/update-profile", {
        userId: viewingUser._id,
        ...editForm,
        documentType: normalizeDocType(editForm.documentType),
      });
      const updated = res.data?.user || { ...viewingUser, ...editForm };
      setViewingUser(updated);
      setUsers((prev) => prev.map((u) => String(u._id) === String(viewingUser._id) ? updated : u));
      setEditSuccess("✅ Datos actualizados correctamente.");
      setEditingProfile(false);
      if (res.data?.auditEvent) appendAuditEvent(res.data.auditEvent);
    } catch (e) {
      setUiError(e?.response?.data?.message || "No se pudo actualizar el perfil.");
    } finally {
      setBusy(false);
    }
  };

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
      setUiError(e?.response?.data?.message || "No se pudo cargar el historial.");
    } finally {
      setHistoryLoading(false);
    }
  };

  const openWaiverForUser = (user) => {
    setUiError("");
    setWaiverAccepted(false);
    hasInkRef.current = false;
    setWaiverUser(user);
    setShowWaiverModal(true);
    requestAnimationFrame(() => requestAnimationFrame(() => {
      resizeCanvasToDevicePixels();
      clearSignature();
    }));
  };

  const closeWaiverModal = () => {
    if (busy) return;
    setShowWaiverModal(false);
    setWaiverUser(null);
    setWaiverAccepted(false);
  };

  const submitExistingUserWaiver = async () => {
    setUiError("");
    if (!waiverUser?._id) return setUiError("No hay usuario seleccionado.");
    if (!waiverAccepted) return setUiError("Debes aceptar el waiver.");
    const canvas = canvasRef.current;
    if (!canvas) return setUiError("Canvas no disponible.");
    if (isCanvasBlank(canvas) || !hasInkRef.current) return setUiError("La firma es obligatoria.");
    const signatureImageUrl = exportSignatureDataUrl();
    const { text: waiverTextSnapshot, version } = waiverSnapshotExistingUser;
    setBusy(true);
    try {
      const res = await axios.post("/api/admin/waiver/sign", {
        userId: waiverUser._id, version, method: "signature", waiverTextSnapshot,
        signatureImageUrl,
        signatureText: waiverUser.esMinor
          ? `Representante legal de ${(waiverUser.name || "").trim()}`
          : (waiverUser.name || "").trim(),
        esMinor: !!waiverUser.esMinor,
      });
      if (res.data?.auditEvent) appendAuditEvent(res.data.auditEvent);
      await fetchUsers();
      if (viewingUser?._id && String(viewingUser._id) === String(waiverUser._id)) {
        const updated = res.data?.user;
        if (updated) setViewingUser(updated);
      }
      closeWaiverModal();
    } catch (error) {
      setUiError(error?.response?.data?.message || "No se pudo firmar el waiver.");
    } finally {
      setBusy(false);
    }
  };

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
    if (!payload.emergencyContactName || !payload.emergencyContactPhone)
      return setUiError("Completa el contacto de emergencia.");
    setBusy(true);
    try {
      const response = await axios.post("/api/admin/users/create", payload);
      const userId = response.data?.user?._id || response.data?.userId;
      if (!userId) { setUiError("No llegó el userId del backend."); return; }
      setSelectedUser(userId);
      setNewUserStep(2);
      requestAnimationFrame(() => requestAnimationFrame(() => {
        resizeCanvasToDevicePixels();
        clearSignature();
      }));
      if (response.data?.auditEvent) appendAuditEvent(response.data.auditEvent);
    } catch (error) {
      setUiError(error?.response?.data?.message || "No se pudo crear el usuario.");
    } finally {
      setBusy(false);
    }
  };

  const submitNewUserWaiver = async () => {
    setUiError("");
    if (!selectedUser) return setUiError("No hay userId seleccionado.");
    if (!waiverAccepted) return setUiError("Debes aceptar el waiver.");
    const canvas = canvasRef.current;
    if (!canvas) return setUiError("Canvas no disponible.");
    if (isCanvasBlank(canvas) || !hasInkRef.current) return setUiError("La firma es obligatoria.");
    const signatureImageUrl = exportSignatureDataUrl();
    const { text: waiverTextSnapshot, version } = waiverSnapshotNewUser;
    setBusy(true);
    try {
      const res = await axios.post("/api/admin/waiver/sign", {
        userId: selectedUser, version, method: "signature", waiverTextSnapshot,
        signatureImageUrl,
        signatureText: newUserForm.esMinor
          ? `Representante legal de ${(newUserForm.name || "").trim()}`
          : (newUserForm.name || "").trim(),
        esMinor: !!newUserForm.esMinor,
      });
      if (res.data?.auditEvent) appendAuditEvent(res.data.auditEvent);
      closeNewUser();
      await fetchUsers();
    } catch (error) {
      setUiError(error?.response?.data?.message || "No se pudo firmar el waiver.");
    } finally {
      setBusy(false);
    }
  };

  const openMoonModal = (user) => {
    setMoonUser(user);
    setMoonMsg("");
    setMoonSuccess("");
    setMoonSelectedDay(0);
    setShowMoonModal(true);
    fetchMoonSlots();
  };

  const closeMoonModal = () => {
    if (moonSubmitting) return;
    setShowMoonModal(false);
    setMoonUser(null);
    setMoonMsg("");
    setMoonSuccess("");
  };

  const handleAdminMoonReserve = async (dateStr, hour) => {
    if (!moonUser || moonSubmitting) return;
    setMoonSubmitting(true);
    setMoonMsg("");
    setMoonSuccess("");
    try {
      await axios.post("/api/admin/moon/reserve", {
        userId: moonUser._id,
        userEmail: moonUser.email,
        userName: moonUser.name,
        date: dateStr,
        startHour: hour,
      });
      setMoonSuccess(`✅ Reserva creada para ${maskName(moonUser.name)}`);
      await fetchMoonSlots();
      await fetchMoonAttendance();
    } catch (e) {
      const code = e?.response?.data?.code;
      if (code === "ALREADY_RESERVED") setMoonMsg(`${maskName(moonUser.name)} ya tiene una reserva activa.`);
      else if (code === "SLOT_TAKEN") setMoonMsg("Ese slot ya está ocupado.");
      else setMoonMsg(e?.response?.data?.message || "Error al reservar.");
    } finally {
      setMoonSubmitting(false);
    }
  };

  const openCancelMoon = (reservationId, userName) => {
    setCancelMoonRes({ reservationId, userName });
    setShowCancelMoonModal(true);
  };

  const handleAdminCancelMoon = async () => {
    if (!cancelMoonRes || moonSubmitting) return;
    setMoonSubmitting(true);
    try {
      await axios.post("/api/admin/moon/cancel", { reservationId: cancelMoonRes.reservationId });
      setShowCancelMoonModal(false);
      setCancelMoonRes(null);
      await fetchMoonSlots();
      await fetchMoonAttendance();
    } catch (e) {
      setMoonMsg(e?.response?.data?.message || "Error al cancelar.");
    } finally {
      setMoonSubmitting(false);
    }
  };

  const openAttendanceModal = async () => {
    setUiError("");
    setAttendancePeriod("week");
    setAttendanceSearch("");
    setShowAttendanceModal(true);
    fetchMoonAttendance();
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
    if (!ctx) return;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.scale(dpr, dpr);
    ctx.lineWidth = 2.5;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = "#1f1f1f";
  }

  function getLocalPos(e) {
    const c = canvasRef.current;
    if (!c) return { x: 0, y: 0 };
    const rect = c.getBoundingClientRect();
    if (e?.clientX != null) return { x: e.clientX - rect.left, y: e.clientY - rect.top };
    const t = e?.touches?.[0] || e?.changedTouches?.[0];
    if (t) return { x: t.clientX - rect.left, y: t.clientY - rect.top };
    return { x: 0, y: 0 };
  }

  function startDraw(e) {
    drawingRef.current = true;
    lastPointRef.current = getLocalPos(e);
    e?.preventDefault?.();
  }

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

  function endDraw(e) {
    drawingRef.current = false;
    e?.preventDefault?.();
  }

  function clearSignature() {
    resizeCanvasToDevicePixels();
    hasInkRef.current = false;
  }

  function exportSignatureDataUrl() {
    const c = canvasRef.current;
    if (!c) return "";
    return c.toDataURL("image/png");
  }

  const attendanceData = useMemo(() => {
    const start = startOfPeriod(attendancePeriod);
    const checkedIn = [];
    users.forEach((u) => {
      const visits = u?.visits || [];
      const periodVisits = visits.filter((v) => {
        const d = new Date(v?.date || v?.checkedInAt);
        return d >= start && (v?.status === "checked_in" || v?.status === "registered");
      });
      if (periodVisits.length > 0) {
        checkedIn.push({ user: u, visits: periodVisits, count: periodVisits.length });
      }
    });
    checkedIn.sort((a, b) => b.count - a.count);
    return checkedIn;
  }, [users, attendancePeriod]);

  const counts = useMemo(() => {
    const total = users.length;
    const waiverPend = users.filter((u) => u?.waiverStatus !== "signed").length;
    const mensualidadVencida = users.filter(
      (u) => u?.accessType === "mensualidad" && !getMensualidadStatus(u?.mensualidad).active
    ).length;
    const sinCreditos = users.filter((u) => u?.accessType === "ticketera" && (u?.credits ?? 0) <= 0).length;
    const menores = users.filter((u) => !!u?.esMinor).length;
    const checkinHoy = users.filter((u) => hasCheckedInToday(u)).length;
    return { total, waiverPend, mensualidadVencida, sinCreditos, menores, checkinHoy };
  }, [users]);

  const currentMoonDay = moonDays[moonSelectedDay];

  if (status === "loading" || (!session && status !== "authenticated")) {
    return (
      <PageShell>
        <GlobalStyle />
        <Container>
          <Header>
            <Title>Panel de Administración</Title>
          </Header>
          <div style={{ padding: spacing.xl, textAlign: "center", color: palette.textLight }}>
            Cargando sesión...
          </div>
        </Container>
      </PageShell>
    );
  }

  return (
    <PageShell>
      <GlobalStyle />
      <Container>
        <Header>
          <Title>Panel de Administración</Title>
          <Subtitle>Gestión de usuarios, créditos y reservas</Subtitle>
        </Header>

        <TopBar>
          <SearchInput
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar por nombre o email..."
          />
          <div style={{ display: "flex", gap: spacing.sm, flexWrap: "wrap" }}>
            <Button $variant="secondary" onClick={fetchUsers}>
              ↻ Recargar
            </Button>
            <Button $variant="secondary" onClick={togglePrivacyMode} title={privacyMode ? "Mostrar datos sensibles" : "Ocultar datos sensibles"}>
              {privacyMode
                ? <EyeOff size={14} style={{ verticalAlign: "-2px" }} />
                : <Eye size={14} style={{ verticalAlign: "-2px" }} />} Privacidad
            </Button>
            <Button onClick={exportToCSV} $variant="secondary">
              📥 Exportar CSV
            </Button>
            <Button onClick={() => fetchCheckinsByDate(new Date().toISOString().slice(0, 10))} $variant="secondary">
              📅 Ver check-ins de hoy
            </Button>
            <Button onClick={openAttendanceModal}>
              📊 Asistencia
            </Button>
            <Button onClick={openNewUser}>
              + Nuevo miembro
            </Button>
            <Button $variant="secondary" onClick={() => signOut()}>
              Cerrar sesión
            </Button>
          </div>
        </TopBar>

        {/* DASHBOARD COLLAPSIBLE */}
        <DashboardHeader onClick={() => setDashboardExpanded(!dashboardExpanded)}>
          <DashboardTitle>
            <span>📈 Dashboard de ingresos</span>
            <Chevron $expanded={dashboardExpanded}>▼</Chevron>
          </DashboardTitle>
          <div style={{ display: "flex", gap: spacing.sm }} onClick={(e) => e.stopPropagation()}>
            <PeriodTab $active={kpiPeriod === "today"} onClick={() => setKpiPeriod("today")}>Hoy</PeriodTab>
            <PeriodTab $active={kpiPeriod === "week"} onClick={() => setKpiPeriod("week")}>Semana</PeriodTab>
            <PeriodTab $active={kpiPeriod === "month"} onClick={() => setKpiPeriod("month")}>Mes</PeriodTab>
          </div>
        </DashboardHeader>
        
        {dashboardExpanded && (
          <KPIGrid>
            <KPICard>
              <KPIValue>{kpiData.ticketeraCheckins}</KPIValue>
              <KPILabel>Check-ins (tiquetera)</KPILabel>
              <KPISub>× $15,000 c/u</KPISub>
            </KPICard>
            <KPICard>
              <KPIValue $color={palette.success}>${kpiData.estimatedRevenue.toLocaleString()}</KPIValue>
              <KPILabel>Ingreso estimado</KPILabel>
              <KPISub>Solo tiquetera</KPISub>
            </KPICard>
            <KPICard>
              <KPIValue>{kpiData.mensualidadCheckins}</KPIValue>
              <KPILabel>Check-ins (mensualidad)</KPILabel>
              <KPISub>{kpiData.mensualidadUsers} usuarios activos</KPISub>
            </KPICard>
            <KPICard>
              <KPIValue>{kpiData.totalCheckins}</KPIValue>
              <KPILabel>Total check-ins</KPILabel>
              <KPISub style={{ color: kpiData.checkinChange >= 0 ? palette.success : palette.danger }}>
                {kpiData.checkinChange >= 0 ? "↑" : "↓"} {Math.abs(kpiData.checkinChange).toFixed(1)}%
              </KPISub>
            </KPICard>
            <KPICard>
              <KPIValue>{kpiData.uniqueUsers}</KPIValue>
              <KPILabel>Personas distintas</KPILabel>
              <KPISub style={{ color: kpiData.usersChange >= 0 ? palette.success : palette.danger }}>
                {kpiData.usersChange >= 0 ? "↑" : "↓"} {Math.abs(kpiData.usersChange).toFixed(1)}%
              </KPISub>
            </KPICard>
          </KPIGrid>
        )}

        <FilterRow>
          <FilterGroup>
            <FilterLabel>Filtro por fecha de registro</FilterLabel>
            <Select 
              value={registrationFilter} 
              onChange={(e) => {
                setRegistrationFilter(e.target.value);
                if (e.target.value !== "custom") {
                  setRegistrationStartDate("");
                  setRegistrationEndDate("");
                }
              }}
              style={{ marginBottom: 0 }}
            >
              <option value="all">Todos los períodos</option>
              <option value="today">Hoy</option>
              <option value="week">Esta semana</option>
              <option value="month">Este mes</option>
              <option value="custom">Personalizado</option>
            </Select>
          </FilterGroup>
          {registrationFilter === "custom" && (
            <>
              <FilterGroup>
                <FilterLabel>Desde</FilterLabel>
                <DateInput
                  type="date"
                  value={registrationStartDate}
                  onChange={(e) => setRegistrationStartDate(e.target.value)}
                />
              </FilterGroup>
              <FilterGroup>
                <FilterLabel>Hasta</FilterLabel>
                <DateInput
                  type="date"
                  value={registrationEndDate}
                  onChange={(e) => setRegistrationEndDate(e.target.value)}
                />
              </FilterGroup>
            </>
          )}
          <FilterGroup>
            <FilterLabel>Mostrar por página</FilterLabel>
            <Select 
              value={itemsPerPage} 
              onChange={(e) => setItemsPerPage(Number(e.target.value))}
              style={{ marginBottom: 0 }}
            >
              <option value={10}>10 usuarios</option>
              <option value={20}>20 usuarios</option>
              <option value={50}>50 usuarios</option>
              <option value={100}>100 usuarios</option>
            </Select>
          </FilterGroup>
        </FilterRow>

        <FiltersBar>
          <FilterChip $active={quickFilter === "all"} onClick={() => setQuickFilter("all")}>
            Todos · {counts.total}
          </FilterChip>
          <FilterChip $active={quickFilter === "waiver"} onClick={() => setQuickFilter("waiver")}>
            Waiver pendiente · {counts.waiverPend}
          </FilterChip>
          <FilterChip $active={quickFilter === "mensualidadVencida"} onClick={() => setQuickFilter("mensualidadVencida")}>
            Vencidas · {counts.mensualidadVencida}
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

        {uiError && <div style={{ padding: `0 ${spacing.xl}` }}><ErrorBox>{uiError}</ErrorBox></div>}

        <div style={{ display: "flex", flexWrap: "wrap" }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            {loading ? (
              <div style={{ padding: spacing.xl, textAlign: "center", color: palette.textLight }}>
                Cargando usuarios...
              </div>
            ) : paginatedUsers.length === 0 ? (
              <div style={{ padding: spacing.xl, textAlign: "center", color: palette.textLight }}>
                No hay usuarios que coincidan con los filtros.
              </div>
            ) : (
              <>
                {/* Mobile cards */}
                <CardsGrid>
                  {paginatedUsers.map((user) => (
                    <Card key={user._id}>
                      <CardHeader>
                        <div>
                          <CardTitle>
                            {maskName(user.name) || "Sin nombre"}
                            {hasCheckedInToday(user) && <span style={{ marginLeft: spacing.xs }}>✅</span>}
                          </CardTitle>
                          <CardEmail>{maskEmail(user.email)}</CardEmail>
                        </div>
                        <Badge $success={user.accessType === "mensualidad"}>
                          {user.accessType === "mensualidad" ? "Mensualidad" : "Tiquetera"}
                        </Badge>
                      </CardHeader>
                      <CardInfo>
                        <div>📞 {maskPhone(user.phone) || "—"}</div>
                        <div>📅 Registro: {user.createdAt ? formatDate(user.createdAt) : "—"}</div>
                        <div>📋 {user.documentType || ""} {maskDocument(user.documentNumber) || ""}</div>
                      </CardInfo>
                      <AccessInfo 
                        user={user} 
                        onRenovar={handleRenovar}
                        onChangeAccess={openAccessModal}
                        busy={busy}
                      />
                      <div style={{ marginTop: spacing.sm }}>
                        <MobileActionMenu
                          user={user}
                          onCheckin={handleCheckin}
                          onMoon={openMoonModal}
                          onViewProfile={handleViewProfile}
                          onCredits={handleAddCredits}
                          onHistory={openHistory}
                          onDelete={handleDeleteUser}
                          onEditVisit={handleEditVisit}
                          busy={busy}
                        />
                      </div>
                    </Card>
                  ))}
                </CardsGrid>

                {/* Desktop table */}
                <TableWrapper>
                  <Table>
                    <thead>
                      <tr>
                        <Th onClick={() => handleSort("name")}>
                          Usuario {getSortIcon("name")}
                        </Th>
                        <Th onClick={() => handleSort("email")}>
                          Email {getSortIcon("email")}
                        </Th>
                        <Th>Contacto</Th>
                        <Th onClick={() => handleSort("credits")}>
                          Acceso {getSortIcon("credits")}
                        </Th>
                        <Th onClick={() => handleSort("lastCheckin")}>
                          Último check-in {getSortIcon("lastCheckin")}
                        </Th>
                        <Th onClick={() => handleSort("createdAt")}>
                          Registro {getSortIcon("createdAt")}
                        </Th>
                        <Th>Waiver</Th>
                        <Th></Th>
                      </tr>
                    </thead>
                    <tbody>
                      {paginatedUsers.map((user) => (
                        <Tr key={user._id}>
                          <Td>
                            <div style={{ fontWeight: 500 }}>{maskName(user.name) || "Sin nombre"}</div>
                            {hasCheckedInToday(user) && <Badge $success style={{ marginTop: spacing.xs }}>✓ Check-in hoy</Badge>}
                          </Td>
                          <Td>
                            <div style={{ fontSize: fontSize.sm, color: palette.textLight }}>{maskEmail(user.email)}</div>
                          </Td>
                          <Td>
                            <div>{maskPhone(user.phone) || "—"}</div>
                            <div style={{ fontSize: fontSize.sm, color: palette.textLight }}>{user.documentType || ""} {maskDocument(user.documentNumber) || ""}</div>
                          </Td>
                          <Td>
                            <AccessInfo 
                              user={user} 
                              onRenovar={handleRenovar}
                              onChangeAccess={openAccessModal}
                              busy={busy}
                            />
                          </Td>
                          <Td>
                            {user.lastCheckinAt ? formatDateTime(user.lastCheckinAt) : "—"}
                          </Td>
                          <Td>
                            {user.createdAt ? formatDate(user.createdAt) : "—"}
                          </Td>
                          <Td>
                            {user?.waiverStatus === "signed" ? (
                              <Button $variant="secondary" $small as="a" href={`/api/admin/waiver/pdf?email=${encodeURIComponent(user.email)}`} target="_blank">
                                Ver PDF
                              </Button>
                            ) : (
                              <Badge $danger>No firmado</Badge>
                            )}
                          </Td>
                          <Td>
                            <ActionMenu
                              user={user}
                              onCheckin={handleCheckin}
                              onMoon={openMoonModal}
                              onViewProfile={handleViewProfile}
                              onCredits={handleAddCredits}
                              onHistory={openHistory}
                              onDelete={handleDeleteUser}
                              onEditVisit={handleEditVisit}
                              busy={busy}
                            />
                          </Td>
                        </Tr>
                      ))}
                    </tbody>
                  </Table>
                </TableWrapper>

                {/* Paginación */}
                {totalPages > 1 && (
                  <PaginationWrapper>
                    <div>
                      Mostrando {((currentPage - 1) * itemsPerPage) + 1} - {Math.min(currentPage * itemsPerPage, filteredAndSortedUsers.length)} de {filteredAndSortedUsers.length} usuarios
                    </div>
                    <PaginationControls>
                      <PageButton onClick={() => goToPage(1)} disabled={currentPage === 1}>
                        «
                      </PageButton>
                      <PageButton onClick={() => goToPage(currentPage - 1)} disabled={currentPage === 1}>
                        ‹
                      </PageButton>
                      {[...Array(Math.min(5, totalPages))].map((_, i) => {
                        let pageNum;
                        if (totalPages <= 5) {
                          pageNum = i + 1;
                        } else if (currentPage <= 3) {
                          pageNum = i + 1;
                        } else if (currentPage >= totalPages - 2) {
                          pageNum = totalPages - 4 + i;
                        } else {
                          pageNum = currentPage - 2 + i;
                        }
                        return (
                          <PageButton
                            key={pageNum}
                            $active={currentPage === pageNum}
                            onClick={() => goToPage(pageNum)}
                          >
                            {pageNum}
                          </PageButton>
                        );
                      })}
                      <PageButton onClick={() => goToPage(currentPage + 1)} disabled={currentPage === totalPages}>
                        ›
                      </PageButton>
                      <PageButton onClick={() => goToPage(totalPages)} disabled={currentPage === totalPages}>
                        »
                      </PageButton>
                    </PaginationControls>
                  </PaginationWrapper>
                )}
              </>
            )}
          </div>

          <AuditFeed events={auditEvents} loading={auditLoading} />
        </div>
      </Container>

      {/* MODALES - mantener igual que antes */}
      <ModalPortal>
        {/* Modal para ver check-ins por fecha específica */}
        <Overlay $show={showCheckinsByDateModal} onClick={() => setShowCheckinsByDateModal(false)} />
        <Modal $show={showCheckinsByDateModal} style={{ maxWidth: "600px" }}>
          <ModalContent>
            <ModalHeader>
              <ModalTitle>📅 Check-ins del {formatDate(selectedDate)}</ModalTitle>
            </ModalHeader>
            {checkinsByDate.length === 0 ? (
              <div style={{ textAlign: "center", padding: spacing.lg, color: palette.textLight }}>
                No hay check-ins registrados en esta fecha.
              </div>
            ) : (
              <div style={{ maxHeight: "400px", overflowY: "auto" }}>
                {checkinsByDate.map((checkin, idx) => (
                  <div key={idx} style={{ 
                    padding: spacing.md, 
                    borderBottom: `1px solid ${palette.border}`,
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    flexWrap: "wrap",
                    gap: spacing.sm
                  }}>
                    <div>
                      <div style={{ fontWeight: 500 }}>{maskName(checkin.userName)}</div>
                      <div style={{ fontSize: fontSize.sm, color: palette.textLight }}>{maskEmail(checkin.userEmail)}</div>
                    </div>
                    <div style={{ display: "flex", gap: spacing.sm, alignItems: "center" }}>
                      <Badge $success={checkin.accessType === "mensualidad"}>
                        {checkin.accessType === "mensualidad" ? "Mens" : "Tiq"}
                      </Badge>
                      <span style={{ fontSize: fontSize.sm, color: palette.textLight }}>
                        {formatCheckinTime(checkin.time)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
            <ActionButtons>
              <Button $variant="secondary" onClick={() => {
                setShowCheckinsByDateModal(false);
                const newDate = prompt("Ingresa una fecha (YYYY-MM-DD) para ver check-ins:", selectedDate);
                if (newDate) fetchCheckinsByDate(newDate);
              }}>
              📅 Otra fecha
              </Button>
              <Button $variant="secondary" onClick={() => setShowCheckinsByDateModal(false)}>
                Cerrar
              </Button>
            </ActionButtons>
          </ModalContent>
        </Modal>

        {/* Edit Visit Modal */}
        <Overlay $show={showEditVisitModal} onClick={() => !busy && setShowEditVisitModal(false)} />
        <Modal $show={showEditVisitModal}>
          {editingVisit && editingVisitUser && (
            <EditVisitModal
              visit={editingVisit}
              user={editingVisitUser}
              onClose={() => { setShowEditVisitModal(false); setEditingVisit(null); setEditingVisitUser(null); }}
              onSave={submitEditVisit}
              busy={busy}
            />
          )}
        </Modal>

        {/* Credits Modal */}
        <Overlay $show={showCreditsModal} onClick={() => !busy && setShowCreditsModal(false)} />
        <Modal $show={showCreditsModal}>
          <ModalContent>
            <ModalHeader>
              <ModalTitle>Modificar Créditos</ModalTitle>
            </ModalHeader>
            <Input
              type="number"
              value={credits}
              onChange={(e) => setCredits(e.target.value)}
              placeholder="Cantidad (+ para agregar, - para quitar)"
            />
            {uiError && <ErrorBox>{uiError}</ErrorBox>}
            {creditsSuccess && <SuccessBox>{creditsSuccess}</SuccessBox>}
            <ActionButtons>
              <Button onClick={submitCredits} disabled={busy}>
                {busy ? "Guardando..." : "Confirmar"}
              </Button>
              <Button $variant="secondary" onClick={() => setShowCreditsModal(false)} disabled={busy}>
                Cancelar
              </Button>
            </ActionButtons>
          </ModalContent>
        </Modal>

        {/* Checkin Modal */}
        <Overlay $show={showCheckinModal} onClick={() => !busy && setShowCheckinModal(false)} />
        <Modal $show={showCheckinModal}>
          <ModalContent>
            <ModalHeader>
              <ModalTitle>Registrar Check-in</ModalTitle>
            </ModalHeader>
            {checkinUser && (
              <>
                <div style={{ fontWeight: 600, marginBottom: spacing.xs }}>{maskName(checkinUser.name)}</div>
                <div style={{ fontSize: fontSize.sm, color: palette.textLight, marginBottom: spacing.md }}>{maskEmail(checkinUser.email)}</div>
                <div style={{ display: "flex", gap: spacing.sm, marginBottom: spacing.md, flexWrap: "wrap" }}>
                  <Badge $success={checkinUser.accessType === "mensualidad"}>
                    {checkinUser.accessType === "mensualidad" ? "Mensualidad" : "Tiquetera"}
                  </Badge>
                  {checkinUser.accessType === "ticketera" ? (
                    <Badge>{checkinUser.credits ?? 0} créditos</Badge>
                  ) : (
                    (() => {
                      const { active, label } = getMensualidadStatus(checkinUser.mensualidad);
                      return <Badge $success={active} $danger={!active}>{label}</Badge>;
                    })()
                  )}
                </div>
                {hasCheckedInToday(checkinUser) && (
                  <SuccessBox>✅ Ya aparece con check-in hoy.</SuccessBox>
                )}
                {checkinUser.accessType === "ticketera" && (checkinUser.credits ?? 0) <= 0 && (
                  <ErrorBox>⚠️ Sin créditos — no se puede registrar el check-in.</ErrorBox>
                )}
                {checkinUser.accessType === "mensualidad" && !getMensualidadStatus(checkinUser.mensualidad).active && (
                  <ErrorBox>⚠️ Mensualidad vencida — no se puede registrar el check-in.</ErrorBox>
                )}
              </>
            )}
            {uiError && <ErrorBox>{uiError}</ErrorBox>}
            {checkinSuccess && <SuccessBox>{checkinSuccess}</SuccessBox>}
            <ActionButtons>
              {!checkinSuccess && (
                <Button onClick={submitCheckin} disabled={busy || !checkinUser || !userCanCheckin(checkinUser)}>
                  {busy ? "Registrando..." : "✓ Confirmar Check-in"}
                </Button>
              )}
              <Button $variant="secondary" onClick={() => { setShowCheckinModal(false); setCheckinSuccess(""); setUiError(""); }} disabled={busy}>
                {checkinSuccess ? "Cerrar" : "Cancelar"}
              </Button>
            </ActionButtons>
          </ModalContent>
        </Modal>

        {/* Renovar Modal */}
        <Overlay $show={showRenovarModal} onClick={() => !busy && setShowRenovarModal(false)} />
        <Modal $show={showRenovarModal}>
          <ModalContent>
            <ModalHeader>
              <ModalTitle>Renovar Mensualidad</ModalTitle>
            </ModalHeader>
            <p style={{ marginBottom: spacing.md, fontSize: fontSize.sm, color: palette.textLight }}>
              Si tiene mensualidad activa, se extiende desde la fecha de vencimiento actual.
            </p>
            <Select value={renovarMonths} onChange={(e) => setRenovarMonths(Number(e.target.value))}>
              {[1, 2, 3, 6, 12].map((m) => (
                <option key={m} value={m}>{m} {m === 1 ? "mes" : "meses"}</option>
              ))}
            </Select>
            {uiError && <ErrorBox>{uiError}</ErrorBox>}
            <ActionButtons>
              <Button onClick={submitRenovar} disabled={busy}>{busy ? "Renovando..." : "Confirmar"}</Button>
              <Button $variant="secondary" onClick={() => setShowRenovarModal(false)} disabled={busy}>Cancelar</Button>
            </ActionButtons>
          </ModalContent>
        </Modal>

        {/* Access Type Modal */}
        <Overlay $show={showAccessModal} onClick={() => !busy && setShowAccessModal(false)} />
        <Modal $show={showAccessModal}>
          <ModalContent>
            <ModalHeader>
              <ModalTitle>Cambiar modalidad</ModalTitle>
            </ModalHeader>
            {accessUser && (
              <>
                <div style={{ fontWeight: 600 }}>{maskName(accessUser.name)}</div>
                <div style={{ fontSize: fontSize.sm, color: palette.textLight, marginBottom: spacing.md }}>{maskEmail(accessUser.email)}</div>
                <Select value={accessTypeDraft} onChange={(e) => setAccessTypeDraft(e.target.value)}>
                  <option value="ticketera">Tiquetera (créditos)</option>
                  <option value="mensualidad">Mensualidad</option>
                </Select>
                {accessTypeDraft === "mensualidad" ? (
                  <>
                    <div style={{ fontSize: fontSize.sm, color: palette.textLight, marginBottom: spacing.xs }}>¿Cuántos meses?</div>
                    <Select value={accessMonthsDraft} onChange={(e) => setAccessMonthsDraft(Number(e.target.value))}>
                      {[1, 2, 3, 6, 12].map((m) => (
                        <option key={m} value={m}>{m} {m === 1 ? "mes" : "meses"}</option>
                      ))}
                    </Select>
                  </>
                ) : (
                  <>
                    <div style={{ fontSize: fontSize.sm, color: palette.textLight, marginBottom: spacing.xs }}>Créditos iniciales (opcional)</div>
                    <Input
                      type="number"
                      value={accessCreditsDraft}
                      onChange={(e) => setAccessCreditsDraft(e.target.value)}
                      placeholder="0"
                    />
                  </>
                )}
                {uiError && <ErrorBox>{uiError}</ErrorBox>}
                <ActionButtons>
                  <Button onClick={submitAccessType} disabled={busy}>{busy ? "Guardando..." : "Confirmar"}</Button>
                  <Button $variant="secondary" onClick={() => setShowAccessModal(false)} disabled={busy}>Cancelar</Button>
                </ActionButtons>
              </>
            )}
          </ModalContent>
        </Modal>

        {/* Profile Modal */}
        <Overlay $show={showProfileModal} onClick={() => !busy && setShowProfileModal(false)} />
        <Modal $show={showProfileModal}>
          <ModalContent>
            <ModalHeader>
              <ModalTitle>Datos del usuario</ModalTitle>
              {!editingProfile ? (
                <Button $variant="secondary" $small onClick={() => { setEditingProfile(true); setUiError(""); setEditSuccess(""); }}>
                  ✏️ Editar
                </Button>
              ) : (
                <Button $variant="secondary" $small onClick={() => { setEditingProfile(false); setUiError(""); }}>
                  Cancelar
                </Button>
              )}
            </ModalHeader>
            {viewingUser && (
              <div>
                {editingProfile ? (
                  <>
                    <div style={{ marginBottom: spacing.md }}>
                      <div style={{ fontSize: fontSize.sm, fontWeight: 600, marginBottom: spacing.xs }}>Nombre</div>
                      <Input value={editForm.name} onChange={(e) => setEditForm(s => ({ ...s, name: e.target.value }))} />
                    </div>
                    <div style={{ marginBottom: spacing.md }}>
                      <div style={{ fontSize: fontSize.sm, fontWeight: 600, marginBottom: spacing.xs }}>Teléfono</div>
                      <Input value={editForm.phone} onChange={(e) => setEditForm(s => ({ ...s, phone: e.target.value }))} />
                    </div>
                    <div style={{ marginBottom: spacing.md }}>
                      <div style={{ fontSize: fontSize.sm, fontWeight: 600, marginBottom: spacing.xs }}>Documento</div>
                      <div style={{ display: "flex", gap: spacing.sm }}>
                        <Select value={editForm.documentType} onChange={(e) => setEditForm(s => ({ ...s, documentType: e.target.value }))} style={{ width: "80px" }}>
                          {["CC", "CE", "TI", "PP", "NIT", "OTRO"].map(t => <option key={t} value={t}>{t}</option>)}
                        </Select>
                        <Input value={editForm.documentNumber} onChange={(e) => setEditForm(s => ({ ...s, documentNumber: e.target.value }))} style={{ flex: 1 }} />
                      </div>
                    </div>
                    <div style={{ marginBottom: spacing.md }}>
                      <div style={{ fontSize: fontSize.sm, fontWeight: 600, marginBottom: spacing.xs }}>EPS</div>
                      <Input value={editForm.epsName} onChange={(e) => setEditForm(s => ({ ...s, epsName: e.target.value }))} />
                    </div>
                    <div style={{ marginBottom: spacing.md }}>
                      <div style={{ fontSize: fontSize.sm, fontWeight: 600, marginBottom: spacing.xs }}>Contacto Emergencia</div>
                      <Input value={editForm.emergencyContactName} onChange={(e) => setEditForm(s => ({ ...s, emergencyContactName: e.target.value }))} placeholder="Nombre" />
                      <Input value={editForm.emergencyContactPhone} onChange={(e) => setEditForm(s => ({ ...s, emergencyContactPhone: e.target.value }))} placeholder="Teléfono" style={{ marginTop: spacing.sm }} />
                    </div>
                    {uiError && <ErrorBox>{uiError}</ErrorBox>}
                    {editSuccess && <SuccessBox>{editSuccess}</SuccessBox>}
                    <ActionButtons>
                      <Button onClick={submitEditProfile} disabled={busy}>{busy ? "Guardando..." : "💾 Guardar"}</Button>
                      <Button $variant="secondary" onClick={() => { setEditingProfile(false); setUiError(""); }}>Cancelar</Button>
                    </ActionButtons>
                  </>
                ) : (
                  <>
                    <div><strong>Nombre:</strong> {maskName(viewingUser.name) || "—"}</div>
                    <div><strong>Email:</strong> {maskEmail(viewingUser.email) || "—"}</div>
                    <div><strong>Teléfono:</strong> {maskPhone(viewingUser.phone) || "—"}</div>
                    <div><strong>Documento:</strong> {viewingUser.documentType || "—"} {maskDocument(viewingUser.documentNumber) || ""}</div>
                    <div><strong>EPS:</strong> {viewingUser.epsName || "—"}</div>
                    <Divider />
                    <div><strong>Contacto Emergencia:</strong></div>
                    <div>Nombre: {maskName(viewingUser.emergencyContactName) || "—"}</div>
                    <div>Teléfono: {maskPhone(viewingUser.emergencyContactPhone) || "—"}</div>
                    <div><strong>Fecha registro:</strong> {viewingUser.createdAt ? formatDate(viewingUser.createdAt) : "—"}</div>
                    {viewingUser.esMinor && <Badge $warning style={{ marginTop: spacing.sm }}>⚠️ Menor de edad</Badge>}
                    <Divider />
                    <div><strong>Accesso:</strong> <Badge $success={viewingUser.accessType === "mensualidad"}>{viewingUser.accessType === "mensualidad" ? "Mensualidad" : "Tiquetera"}</Badge></div>
                    {viewingUser.accessType === "ticketera" ? (
                      <div><strong>Créditos:</strong> {viewingUser.credits ?? 0}</div>
                    ) : (
                      (() => {
                        const { active, label } = getMensualidadStatus(viewingUser.mensualidad);
                        return <div><strong>Estado:</strong> <Badge $success={active} $danger={!active}>{label}</Badge></div>;
                      })()
                    )}
                    <Divider />
                    <div><strong>Waiver:</strong> {viewingUser.waiverStatus === "signed" ? "Firmado" : "Pendiente"}</div>
                    {viewingUser.waiverStatus === "signed" && viewingUser.waiverSignatureUrl && (
                      <>
                        <Divider />
                        <div><strong>Firma:</strong></div>
                        <img src={viewingUser.waiverSignatureUrl} alt="Firma" style={{ maxWidth: "100%", border: `1px solid ${palette.border}`, borderRadius: borderRadius.sm, marginTop: spacing.sm }} />
                      </>
                    )}
                    {viewingUser.waiverStatus !== "signed" && (
                      <>
                        <ErrorBox style={{ marginTop: spacing.md }}>⚠️ Waiver pendiente — este usuario no puede entrenar sin firmar.</ErrorBox>
                        <Button onClick={() => openWaiverForUser(viewingUser)} disabled={busy} style={{ marginTop: spacing.md }}>✍️ Firmar Waiver</Button>
                      </>
                    )}
                    <ActionButtons style={{ marginTop: spacing.lg }}>
                      <Button $variant="danger" onClick={() => handleDeleteUser(viewingUser)} disabled={busy}>🗑️ Eliminar miembro</Button>
                      <Button $variant="secondary" onClick={() => setShowProfileModal(false)}>Cerrar</Button>
                    </ActionButtons>
                  </>
                )}
              </div>
            )}
          </ModalContent>
        </Modal>

        {/* History Modal */}
        <Overlay $show={showHistoryModal} onClick={() => !busy && setShowHistoryModal(false)} />
        <Modal $show={showHistoryModal}>
          <ModalContent>
            <ModalHeader>
              <ModalTitle>Historial de ingresos</ModalTitle>
            </ModalHeader>
            {historyUser && (
              <>
                <div style={{ fontWeight: 600 }}>{maskName(historyUser.name) || "Sin nombre"}</div>
                <div style={{ fontSize: fontSize.sm, color: palette.textLight, marginBottom: spacing.md }}>{maskEmail(historyUser.email)}</div>
              </>
            )}
            {historyLoading ? (
              <div style={{ textAlign: "center", color: palette.textLight, padding: spacing.lg }}>Cargando...</div>
            ) : historyVisits.length === 0 ? (
              <div style={{ textAlign: "center", color: palette.textLight, padding: spacing.lg }}>Sin historial de visitas</div>
            ) : (
              <div style={{ maxHeight: "400px", overflowY: "auto" }}>
                {historyVisits.map((v) => {
                  const ts = v.checkedInAt || v.date;
                  return (
                    <div key={v._id || v.id} style={{ 
                      padding: spacing.md, 
                      borderBottom: `1px solid ${palette.border}`,
                      background: v.status === "checked_in" ? palette.success + "05" : "transparent"
                    }}>
                      <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: spacing.sm }}>
                        <span><strong>{v.status === "checked_in" ? "✓ Check-in" : v.status || "Registro"}</strong></span>
                        <span style={{ fontSize: fontSize.sm, color: palette.textLight }}>{formatDateTime(ts)}</span>
                      </div>
                      <div style={{ fontSize: fontSize.sm, color: palette.textLight, marginTop: spacing.xs }}>
                        {v.createdBy === "admin" ? "Registrado por admin" : "Auto-registro"}
                      </div>
                      <div style={{ marginTop: spacing.xs }}>
                        <Button $variant="secondary" $small onClick={() => handleEditVisit(historyUser, v)}>✏️ Editar</Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
            <ActionButtons>
              <Button $variant="secondary" onClick={() => setShowHistoryModal(false)}>Cerrar</Button>
            </ActionButtons>
          </ModalContent>
        </Modal>

        {/* New User Modal */}
        {showNewUserModal && (
          <>
            <Overlay $show onClick={() => !busy && closeNewUser()} />
            <Modal $show>
              <ModalContent>
                <ModalHeader>
                  <ModalTitle>
                    {newUserStep === 1 ? "Nuevo Miembro" : newUserForm.esMinor ? "Waiver — Menor de Edad" : "Firma de Waiver"}
                  </ModalTitle>
                </ModalHeader>
                {newUserStep === 1 ? (
                  <>
                    <Select value={newUserForm.accessType} onChange={(e) => setNewUserForm(s => ({ ...s, accessType: e.target.value }))}>
                      <option value="ticketera">Tiquetera (créditos)</option>
                      <option value="mensualidad">Mensualidad</option>
                    </Select>
                    {newUserForm.accessType === "mensualidad" && (
                      <Select value={newUserForm.mensualidadMeses} onChange={(e) => setNewUserForm(s => ({ ...s, mensualidadMeses: Number(e.target.value) }))}>
                        {[1, 2, 3, 6, 12].map(m => <option key={m} value={m}>{m} {m === 1 ? "mes" : "meses"}</option>)}
                      </Select>
                    )}
                    <Input placeholder="Nombre completo" value={newUserForm.name} onChange={(e) => setNewUserForm(s => ({ ...s, name: e.target.value }))} />
                    <Input placeholder="Email" value={newUserForm.email} onChange={(e) => setNewUserForm(s => ({ ...s, email: e.target.value }))} />
                    <div style={{ display: "flex", gap: spacing.sm }}>
                      <Select value={newUserForm.documentType} onChange={(e) => setNewUserForm(s => ({ ...s, documentType: e.target.value }))} style={{ width: "80px" }}>
                        {["CC", "CE", "TI", "PP", "NIT", "OTRO"].map(t => <option key={t} value={t}>{t}</option>)}
                      </Select>
                      <Input placeholder="Número Documento" value={newUserForm.documentNumber} onChange={(e) => setNewUserForm(s => ({ ...s, documentNumber: e.target.value }))} style={{ flex: 1 }} />
                    </div>
                    <Input placeholder="Teléfono" value={newUserForm.phone} onChange={(e) => setNewUserForm(s => ({ ...s, phone: e.target.value }))} />
                    <Input placeholder="EPS" value={newUserForm.epsName} onChange={(e) => setNewUserForm(s => ({ ...s, epsName: e.target.value }))} />
                    <Input placeholder="Contacto Emergencia (Nombre)" value={newUserForm.emergencyContactName} onChange={(e) => setNewUserForm(s => ({ ...s, emergencyContactName: e.target.value }))} />
                    <Input placeholder="Contacto Emergencia (Teléfono)" value={newUserForm.emergencyContactPhone} onChange={(e) => setNewUserForm(s => ({ ...s, emergencyContactPhone: e.target.value }))} />
                    <RadioRow>
                      <label><input type="radio" checked={!newUserForm.esMinor} onChange={() => setNewUserForm(s => ({ ...s, esMinor: false }))} /> Mayor de edad</label>
                      <label><input type="radio" checked={newUserForm.esMinor} onChange={() => setNewUserForm(s => ({ ...s, esMinor: true }))} /> Menor de edad</label>
                    </RadioRow>
                    {uiError && <ErrorBox>{uiError}</ErrorBox>}
                    <ActionButtons>
                      <Button onClick={createNewUser} disabled={busy}>{busy ? "Creando..." : "Continuar"}</Button>
                      <Button $variant="secondary" onClick={closeNewUser} disabled={busy}>Cancelar</Button>
                    </ActionButtons>
                  </>
                ) : (
                  <>
                    <WaiverBox>
                      {waiverToParagraphs(waiverSnapshotNewUser.text).map((p, idx) => (
                        <p key={idx} style={{ marginBottom: spacing.md }}>{p}</p>
                      ))}
                    </WaiverBox>
                    <CheckboxRow>
                      <input type="checkbox" checked={waiverAccepted} onChange={(e) => setWaiverAccepted(e.target.checked)} />
                      <span>{newUserForm.esMinor ? "Acepto el consentimiento como representante legal del menor" : "Acepto el consentimiento"}</span>
                    </CheckboxRow>
                    <SigCanvas ref={canvasRef} onMouseDown={startDraw} onMouseMove={moveDraw} onMouseUp={endDraw} onMouseLeave={endDraw} onTouchStart={startDraw} onTouchMove={moveDraw} onTouchEnd={endDraw} />
                    <SigRow>
                      <span style={{ fontSize: fontSize.sm, color: palette.textLight }}>
                        Firmando como: <strong>{newUserForm.esMinor ? `Representante legal de ${newUserForm.name || "—"}` : newUserForm.name || "—"}</strong>
                      </span>
                      <Button $variant="secondary" $small type="button" onClick={() => { setUiError(""); clearSignature(); }}>Limpiar</Button>
                    </SigRow>
                    {uiError && <ErrorBox>{uiError}</ErrorBox>}
                    <ActionButtons>
                      <Button onClick={submitNewUserWaiver} disabled={busy}>{busy ? "Guardando..." : "Crear miembro"}</Button>
                      <Button $variant="secondary" onClick={() => setNewUserStep(1)} disabled={busy}>Atrás</Button>
                    </ActionButtons>
                  </>
                )}
              </ModalContent>
            </Modal>
          </>
        )}

        {/* Waiver Existing User Modal */}
        {showWaiverModal && (
          <>
            <Overlay $show onClick={() => !busy && closeWaiverModal()} />
            <Modal $show>
              <ModalContent>
                <ModalHeader>
                  <ModalTitle>Firmar Waiver — {maskName(waiverUser?.name) || "Usuario"}</ModalTitle>
                </ModalHeader>
                <WaiverBox>
                  {waiverToParagraphs(waiverSnapshotExistingUser.text).map((p, idx) => (
                    <p key={idx} style={{ marginBottom: spacing.md }}>{p}</p>
                  ))}
                </WaiverBox>
                <CheckboxRow>
                  <input type="checkbox" checked={waiverAccepted} onChange={(e) => setWaiverAccepted(e.target.checked)} />
                  <span>{waiverUser?.esMinor ? "Acepto el consentimiento como representante legal del menor" : "Acepto el consentimiento"}</span>
                </CheckboxRow>
                <SigCanvas ref={canvasRef} onMouseDown={startDraw} onMouseMove={moveDraw} onMouseUp={endDraw} onMouseLeave={endDraw} onTouchStart={startDraw} onTouchMove={moveDraw} onTouchEnd={endDraw} />
                <SigRow>
                  <span style={{ fontSize: fontSize.sm, color: palette.textLight }}>
                    Firmando como: <strong>{waiverUser?.esMinor ? `Representante legal de ${waiverUser?.name || "—"}` : waiverUser?.name || "—"}</strong>
                  </span>
                  <Button $variant="secondary" $small type="button" onClick={() => { setUiError(""); clearSignature(); }}>Limpiar</Button>
                </SigRow>
                {uiError && <ErrorBox>{uiError}</ErrorBox>}
                <ActionButtons>
                  <Button onClick={submitExistingUserWaiver} disabled={busy}>{busy ? "Guardando..." : "Guardar waiver"}</Button>
                  <Button $variant="secondary" onClick={closeWaiverModal} disabled={busy}>Cancelar</Button>
                </ActionButtons>
              </ModalContent>
            </Modal>
          </>
        )}

        {/* Moon Modal */}
        <Overlay $show={showMoonModal} onClick={() => !moonSubmitting && closeMoonModal()} />
        <Modal $show={showMoonModal}>
          <ModalContent>
            <ModalHeader>
              <ModalTitle>🌑 MoonBoard - {maskName(moonUser?.name)}</ModalTitle>
            </ModalHeader>
            {moonLoading ? (
              <div style={{ textAlign: "center", padding: spacing.lg, color: palette.textLight }}>Cargando slots...</div>
            ) : (
              <>
                <div style={{ display: "flex", gap: spacing.sm, overflowX: "auto", marginBottom: spacing.md }}>
                  {moonDays.map((day, i) => (
                    <Button
                      key={day.date}
                      $variant={moonSelectedDay === i ? undefined : "secondary"}
                      $small
                      onClick={() => { setMoonSelectedDay(i); setMoonMsg(""); setMoonSuccess(""); }}
                    >
                      {day.isToday ? "Hoy" : formatTabDate(day.date)}
                    </Button>
                  ))}
                </div>
                {currentMoonDay && (
                  <div style={{ display: "grid", gap: spacing.sm }}>
                    {currentMoonDay.slots.map((slot) => (
                      <div key={slot.hour} style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        padding: spacing.sm,
                        border: `1px solid ${palette.border}`,
                        borderRadius: borderRadius.sm,
                        background: slot.isMySlot ? palette.success + "10" : slot.taken ? palette.bg : "white",
                        opacity: slot.isPast ? 0.6 : 1
                      }}>
                        <span style={{ fontWeight: 500 }}>{slot.label}</span>
                        <div>
                          {slot.isMySlot ? (
                            <Badge $success>Reservado por ti</Badge>
                          ) : slot.isPast ? (
                            <Badge $danger>Pasado</Badge>
                          ) : slot.taken ? (
                            <div style={{ display: "flex", gap: spacing.sm, alignItems: "center" }}>
                              <Badge>{maskName(slot.takenBy?.name) || "Ocupado"}</Badge>
                              <Button $variant="danger" $small onClick={() => openCancelMoon(slot.reservationId, maskName(slot.takenBy?.name))} disabled={moonSubmitting}>
                                Cancelar
                              </Button>
                            </div>
                          ) : (
                            <Button $small onClick={() => handleAdminMoonReserve(currentMoonDay.date, slot.hour)} disabled={moonSubmitting}>
                              Reservar
                            </Button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
            {moonMsg && <ErrorBox>{moonMsg}</ErrorBox>}
            {moonSuccess && <SuccessBox>{moonSuccess}</SuccessBox>}
            <ActionButtons>
              <Button $variant="secondary" onClick={closeMoonModal} disabled={moonSubmitting}>Cerrar</Button>
            </ActionButtons>
          </ModalContent>
        </Modal>

        {/* Cancel Moon Confirmation Modal */}
        <Overlay $show={showCancelMoonModal} onClick={() => !moonSubmitting && setShowCancelMoonModal(false)} />
        <Modal $show={showCancelMoonModal}>
          <ModalContent>
            <ModalHeader>
              <ModalTitle>Confirmar cancelación</ModalTitle>
            </ModalHeader>
            <p>¿Estás seguro de que deseas cancelar la reserva de <strong>{cancelMoonRes?.userName}</strong>?</p>
            <ActionButtons>
              <Button $variant="danger" onClick={handleAdminCancelMoon} disabled={moonSubmitting}>
                {moonSubmitting ? "Cancelando..." : "Sí, cancelar"}
              </Button>
              <Button $variant="secondary" onClick={() => { setShowCancelMoonModal(false); setCancelMoonRes(null); }} disabled={moonSubmitting}>
                Volver
              </Button>
            </ActionButtons>
          </ModalContent>
        </Modal>

        {/* Attendance Modal */}
        <Overlay $show={showAttendanceModal} onClick={() => setShowAttendanceModal(false)} />
        <Modal $show={showAttendanceModal} style={{ maxWidth: "700px" }}>
          <ModalContent>
            <ModalHeader>
              <ModalTitle>📊 Asistencia</ModalTitle>
            </ModalHeader>
            <PeriodTabs>
              <PeriodTab $active={attendancePeriod === "today"} onClick={() => setAttendancePeriod("today")}>Hoy</PeriodTab>
              <PeriodTab $active={attendancePeriod === "week"} onClick={() => setAttendancePeriod("week")}>Esta semana</PeriodTab>
              <PeriodTab $active={attendancePeriod === "month"} onClick={() => setAttendancePeriod("month")}>Este mes</PeriodTab>
            </PeriodTabs>
            <StatsRow>
              <StatPill><StatPillNum>{attendanceData.length}</StatPillNum><StatPillLabel>Personas distintas</StatPillLabel></StatPill>
              <StatPill><StatPillNum>{attendanceData.reduce((a, d) => a + d.count, 0)}</StatPillNum><StatPillLabel>Visitas totales</StatPillLabel></StatPill>
            </StatsRow>
            <Input
              placeholder="🔍 Buscar por nombre o email..."
              value={attendanceSearch}
              onChange={(e) => setAttendanceSearch(e.target.value)}
              style={{ marginBottom: spacing.md }}
            />
            <Divider />
            {(() => {
              const q = attendanceSearch.trim().toLowerCase();
              const allVisits = [];
              attendanceData.forEach(({ user, visits }) => {
                visits.forEach((v) => {
                  const ts = v.checkedInAt || v.date;
                  allVisits.push({ user, visit: v, ts });
                });
              });
              const filtered = q ? allVisits.filter(({ user }) =>
                (user.name || "").toLowerCase().includes(q) ||
                (user.email || "").toLowerCase().includes(q)
              ) : allVisits;
              if (filtered.length === 0) {
                return <div style={{ textAlign: "center", padding: spacing.lg, color: palette.textLight }}>Sin registros en este período.</div>;
              }
              const byDay = {};
              filtered.forEach((item) => {
                const d = new Date(item.ts);
                const key = isNaN(d.getTime()) ? "unknown" : `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
                if (!byDay[key]) byDay[key] = [];
                byDay[key].push(item);
              });
              const sortedDays = Object.keys(byDay).sort((a, b) => b.localeCompare(a));
              return (
                <div style={{ maxHeight: "400px", overflowY: "auto" }}>
                  {sortedDays.map((dayKey) => {
                    const items = byDay[dayKey];
                    items.sort((a, b) => new Date(b.ts) - new Date(a.ts));
                    return (
                      <DayGroup key={dayKey}>
                        <DayGroupHeader>
                          <span>{formatDayLabel(items[0].ts)}</span>
                          <Badge>{items.length} ingreso{items.length !== 1 ? "s" : ""}</Badge>
                        </DayGroupHeader>
                        {items.map(({ user, visit, ts }, idx) => (
                          <AttendanceRow key={`${user._id}-${visit?._id || idx}`}>
                            <div>
                              <div style={{ fontWeight: 500 }}>{maskName(user.name) || "Sin nombre"}</div>
                              <div style={{ fontSize: fontSize.sm, color: palette.textLight }}>{maskEmail(user.email)}</div>
                            </div>
                            <div style={{ display: "flex", gap: spacing.sm, alignItems: "center" }}>
                              {formatCheckinTime(ts) && <Badge>🕐 {formatCheckinTime(ts)}</Badge>}
                              <Badge $success={user.accessType === "mensualidad"}>
                                {user.accessType === "mensualidad" ? "Mens" : "Tiq"}
                              </Badge>
                              <Button $variant="secondary" $small onClick={() => handleEditVisit(user, visit)}>✏️</Button>
                            </div>
                          </AttendanceRow>
                        ))}
                      </DayGroup>
                    );
                  })}
                </div>
              );
            })()}
            <Divider />
            <div style={{ border: `1px solid ${palette.border}`, borderRadius: borderRadius.sm, overflow: "hidden", marginBottom: spacing.md }}>
              <div style={{ padding: spacing.md, background: palette.bg, fontWeight: 600, borderBottom: `1px solid ${palette.border}` }}>
                🌑 Reservas Moonboard — próximos 7 días
              </div>
              {moonAttendance.length === 0 ? (
                <div style={{ padding: spacing.md, textAlign: "center", color: palette.textLight }}>Sin reservas activas.</div>
              ) : (
                moonAttendance.map((r) => (
                  <div key={r._id} style={{ padding: spacing.md, borderBottom: `1px solid ${palette.border}`, display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: spacing.sm }}>
                    <div>
                      <div style={{ fontWeight: 500 }}>{maskName(r.userName) || maskEmail(r.userEmail)}</div>
                      <div style={{ fontSize: fontSize.sm, color: palette.textLight }}>{formatTabDate(r.date)} · {String(r.startHour).padStart(2, "0")}:00</div>
                    </div>
                    <Button $variant="danger" $small onClick={() => openCancelMoon(r._id, maskName(r.userName))} disabled={moonSubmitting}>Cancelar</Button>
                  </div>
                ))
              )}
            </div>
            <ActionButtons>
              <Button $variant="secondary" onClick={() => setShowAttendanceModal(false)}>Cerrar</Button>
            </ActionButtons>
          </ModalContent>
        </Modal>
      </ModalPortal>
    </PageShell>
  );
}