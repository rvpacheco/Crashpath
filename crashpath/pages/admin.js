
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useSession, signIn, signOut } from "next-auth/react";
import { useRouter } from "next/router";
import axios from "axios";
import styled, { createGlobalStyle } from "styled-components";
import { Eye, EyeOff } from "lucide-react";
import { getWaiverSnapshot, waiverToParagraphs } from "@/lib/waiver";
import { addMonthsToDay, mensualidadDayHint, todayBogotaDay } from "@/lib/dates";
import { clasificarCheckin, estadoCortesia } from "@/lib/cortesia";
import { PERMISOS } from "@/lib/permisos";
import { etiquetaTurno } from "@/lib/staff";
import { estadoGate, ACCION_LOGIN, ACCION_REINTENTAR, ACCION_INICIO } from "@/lib/gateAdmin";
import { PrivacyProvider, usePrivacy } from "@/components/PrivacyContext";
import { InventarioModal, VentaRapida } from "@/components/Inventario";
import { buscarProductos } from "@/lib/inventario";
import { PRECIOS, precioDia, precioTiquetera, precioMensualidad, pesos } from "@/lib/precios";

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

const TurnoBanner = styled.div`
  display: flex;
  flex-direction: column;
  gap: 2px;
  margin: 0 ${spacing.xl};
  padding: ${spacing.sm} ${spacing.md};
  border-radius: ${borderRadius.md};
  background: #FFF7E6;
  border: 1px solid #F0C36D;
  color: #7A5200;
  font-size: ${fontSize.sm};
  font-weight: 500;

  @media (max-width: 768px) {
    margin: 0 ${spacing.md};
  }
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
  accessType: "ticketera", mensualidadMeses: 1, zapatos: false, esMinor: false,
};

// Invitado que entra con la cortesía de un socio. Pide lo mínimo legal
// (identificación + contacto de emergencia); la EPS es opcional para no
// trancar el mostrador.
const INITIAL_GUEST = {
  name: "", documentType: "CC", documentNumber: "", phone: "",
  epsName: "", emergencyContactName: "", emergencyContactPhone: "",
  esMinor: false,
};

// ============================================
// SUBCOMPONENTES
// ============================================
/** Badge de la cortesía (pase de invitado). Aplica a las dos modalidades. */
// Tope de acompañantes por check-in/descuento. Espejo de MAX_ACOMPANANTES en
// lib/operaciones.js (no se importa de allá: arrastraría Mongoose al cliente).
const MAX_ACOMPANANTES = 10;

/** − N + para elegir una cantidad de créditos sin teclear. */
function CreditStepper({ value, min = 0, max = MAX_ACOMPANANTES, onChange, disabled }) {
  const clamp = (n) => Math.min(Math.max(n, min), Math.max(min, max));
  return (
    <div style={{ display: "flex", alignItems: "center", gap: spacing.sm }}>
      <Button type="button" $variant="secondary" disabled={disabled || value <= min} onClick={() => onChange(clamp(value - 1))}
        aria-label="Quitar uno" style={{ minWidth: 44 }}>−</Button>
      <strong style={{ minWidth: 28, textAlign: "center", fontSize: fontSize.lg }}>{value}</strong>
      <Button type="button" $variant="secondary" disabled={disabled || value >= max} onClick={() => onChange(clamp(value + 1))}
        aria-label="Sumar uno" style={{ minWidth: 44 }}>+</Button>
    </div>
  );
}

function CortesiaBadge({ user }) {
  const st = estadoCortesia(user);
  if (st.disponible) {
    return (
      <Badge $success title={st.vence ? `Vence ${formatDate(st.vence)}` : "Sin vencimiento cargado"}>
        🎟️ Cortesía
      </Badge>
    );
  }
  if (st.vencida) return <Badge $danger>🎟️ Cortesía vencida</Badge>;
  if (st.ultimoUso) {
    return (
      <Badge title={`Último invitado: ${st.ultimoUso.guestName || "—"}`}>
        🎟️ Cortesía usada
      </Badge>
    );
  }
  return null;
}

function AccessInfo({ user, onRenovar, onChangeAccess, onEditTiquetera, onEditMensualidad, busy, can = () => false }) {
  // Invitado que entró con la cortesía de un socio: no tiene modalidad propia.
  // Sin este caso se mostraría como "Tiquetera · 0 créditos", que no es cierto.
  if ((user.userType === "walkin" || user.userType === "daypass") && !user.accessType) {
    return (
      <div style={{ display: "flex", gap: spacing.sm, alignItems: "center", flexWrap: "wrap" }}>
        <Badge>{user.userType === "daypass" ? "🎫 Pase de día" : "👤 Invitado"}</Badge>
        {can(PERMISOS.COBRAR) && (
          <Button $variant="secondary" $small onClick={() => onChangeAccess(user)} disabled={busy}>
            Volver socio
          </Button>
        )}
      </div>
    );
  }

  if (user.accessType === "mensualidad") {
    const { active, label } = getMensualidadStatus(user.mensualidad);
    return (
      <div style={{ display: "flex", gap: spacing.sm, alignItems: "center", flexWrap: "wrap" }}>
        <Badge $success={active} $danger={!active}>
          {active ? "✓" : "✗"} {label}
        </Badge>
        <CortesiaBadge user={user} />
        {can(PERMISOS.COBRAR) && (
          <Button $variant="secondary" $small onClick={() => onRenovar(user._id)} disabled={busy}>
            Renovar
          </Button>
        )}
        {can(PERMISOS.EDITAR_FECHAS) && (
          <Button $variant="secondary" $small onClick={() => onEditMensualidad(user)} disabled={busy}>
            📅 Fechas
          </Button>
        )}
        {can(PERMISOS.COBRAR) && (
          <Button $variant="secondary" $small onClick={() => onChangeAccess(user)} disabled={busy}>
            Cambiar
          </Button>
        )}
      </div>
    );
  }
  // Tiquetera: el vencimiento se muestra pero NO bloquea (el admin decide).
  const tiqEnd = user.tiquetera?.endDate ? new Date(user.tiquetera.endDate) : null;
  const tiqVencida = tiqEnd ? tiqEnd < new Date() : false;
  return (
    <div style={{ display: "flex", gap: spacing.sm, alignItems: "center", flexWrap: "wrap" }}>
      <Badge>{user.credits ?? 0} créditos</Badge>
      {tiqEnd && (
        <Badge $success={!tiqVencida} $danger={tiqVencida}>
          {tiqVencida ? "✗ Tiquetera vencida" : `✓ Vence ${formatDate(tiqEnd)}`}
        </Badge>
      )}
      <CortesiaBadge user={user} />
      {can(PERMISOS.EDITAR_FECHAS) && (
        <Button $variant="secondary" $small onClick={() => onEditTiquetera(user)} disabled={busy}>
          📅 Fechas
        </Button>
      )}
      {can(PERMISOS.COBRAR) && (
        <Button $variant="secondary" $small onClick={() => onChangeAccess(user)} disabled={busy}>
          Cambiar
        </Button>
      )}
    </div>
  );
}

function ActionMenu({ user, onCheckin, onCortesia, onMoon, onViewProfile, onCredits, onHistory, onDelete, onEditVisit, busy, can = () => false }) {
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
          {can(PERMISOS.CORTESIA_USAR) && (
            <DropdownItem onClick={() => { onCortesia(user); setOpen(false); }}>
              🎟️ Usar cortesía
            </DropdownItem>
          )}
          {can(PERMISOS.MOON) && (
            <DropdownItem onClick={() => { onMoon(user); setOpen(false); }}>
              🌑 MoonBoard
            </DropdownItem>
          )}
          {can(PERMISOS.VER_SENSIBLE) && (
            <DropdownItem onClick={() => { onViewProfile(user); setOpen(false); }}>
              👤 Ver datos
            </DropdownItem>
          )}
          {can(PERMISOS.COBRAR) && (
            <DropdownItem onClick={() => { onCredits(user._id); setOpen(false); }}>
              💰 Créditos
            </DropdownItem>
          )}
          <DropdownItem onClick={() => { onHistory(user); setOpen(false); }}>
            📜 Historial
          </DropdownItem>
          {lastVisit && can(PERMISOS.CHECKIN) && (
            <DropdownItem onClick={() => { onEditVisit(user, lastVisit); setOpen(false); }}>
              ✏️ Editar última visita
            </DropdownItem>
          )}
          {can(PERMISOS.BORRAR_USUARIO) && (
            <DropdownItem $danger onClick={() => { onDelete(user); setOpen(false); }}>
              🗑️ Eliminar
            </DropdownItem>
          )}
        </DropdownMenu>
      )}
    </Dropdown>
  );
}

// Componente de acciones móvil
function MobileActionMenu({ user, onCheckin, onCortesia, onMoon, onViewProfile, onCredits, onHistory, onDelete, onEditVisit, busy, can = () => false }) {
  const { maskName } = usePrivacy();
  const [open, setOpen] = useState(false);
  
  const lastVisit = user?.visits?.[0];
  // Mismos permisos que el menú de escritorio, en el mismo orden.
  const actions = [
    can(PERMISOS.CHECKIN) && { icon: "✓", label: "Check-in", action: () => onCheckin(user) },
    can(PERMISOS.CORTESIA_USAR) && { icon: "🎟️", label: "Usar cortesía", action: () => onCortesia(user) },
    can(PERMISOS.MOON) && { icon: "🌑", label: "MoonBoard", action: () => onMoon(user) },
    can(PERMISOS.VER_SENSIBLE) && { icon: "👤", label: "Ver datos", action: () => onViewProfile(user) },
    can(PERMISOS.COBRAR) && { icon: "💰", label: "Créditos", action: () => onCredits(user._id) },
    { icon: "📜", label: "Historial", action: () => onHistory(user) },
    lastVisit && can(PERMISOS.CHECKIN) && { icon: "✏️", label: "Editar visita", action: () => onEditVisit(user, lastVisit) },
    can(PERMISOS.BORRAR_USUARIO) && { icon: "🗑️", label: "Eliminar", action: () => onDelete(user), danger: true },
  ].filter(Boolean);
  
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

// Sidebar del feed de auditoría. OJO: los media queries NO funcionan en
// style inline de React (así estuvo invisible desde siempre); tiene que ser
// un styled-component.
const AuditAside = styled.aside`
  padding: ${spacing.lg};
  border-left: 1px solid ${palette.border};
  background: ${palette.bg};
  min-width: 280px;
  max-width: 340px;
  display: none;

  @media (min-width: 1024px) {
    display: block;
  }
`;

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
    <AuditAside>
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
    </AuditAside>
  );
}

// ============================================
// INGRESOS (solo admin): caja real por tipo de cobro y por día
// ============================================
const TIPOS_INGRESO = [
  { clave: "dia", etiqueta: "Pases de día", color: "#0066CC" },
  { clave: "tiquetera", etiqueta: "Tiqueteras", color: "#7C3AED" },
  { clave: "mensualidad", etiqueta: "Mensualidades", color: "#16A34A" },
  { clave: "inventario", etiqueta: "Inventario", color: "#D97706" },
];

function IngresosPanel({ data, loading, error, periodo }) {
  if (error) return <ErrorBox style={{ margin: spacing.md }}>{error}</ErrorBox>;
  if (!data) {
    return (
      <div style={{ padding: spacing.lg, color: palette.textLight, fontSize: fontSize.sm }}>
        {loading ? "Calculando ingresos..." : ""}
      </div>
    );
  }

  const cambio = data.cambio;
  const maxDia = Math.max(1, ...data.dias.map((d) => d.total));
  const nombreDia = (ymd) => formatTabDate(ymd);

  return (
    <div style={{ padding: `${spacing.lg} ${spacing.xl}`, background: palette.bg, borderBottom: `1px solid ${palette.border}` }}>
      <KPIGrid style={{ padding: 0, background: "transparent", border: "none" }}>
        <KPICard style={{ gridColumn: "span 2" }}>
          <KPIValue $color={palette.success}>{pesos(data.total)}</KPIValue>
          <KPILabel>Caja del período</KPILabel>
          <KPISub style={{ color: cambio == null ? palette.textLight : cambio >= 0 ? palette.success : palette.danger }}>
            {cambio == null
              ? "Sin período anterior para comparar"
              : `${cambio >= 0 ? "↑" : "↓"} ${Math.abs(cambio).toFixed(1)}% vs. período anterior (${pesos(data.previo)})`}
          </KPISub>
          {data.estimado > 0 && (
            <KPISub title="Cobros de antes de que el panel guardara el monto: se calculan con las tarifas actuales">
              Incluye ~{pesos(data.estimado)} estimado de cobros antiguos
            </KPISub>
          )}
        </KPICard>
        {TIPOS_INGRESO.map((t) => (
          <KPICard key={t.clave}>
            <KPIValue $color={t.color}>{pesos(data.porTipo[t.clave])}</KPIValue>
            <KPILabel>{t.etiqueta}</KPILabel>
            {t.clave === "dia" && (
              <KPISub>
                {data.pases.sinZapatos} sin zapatos · {data.pases.conZapatos} con zapatos
              </KPISub>
            )}
          </KPICard>
        ))}
      </KPIGrid>

      {periodo !== "today" && (
        <div style={{ marginTop: spacing.lg }}>
          <div style={{ fontSize: fontSize.sm, fontWeight: 600, marginBottom: spacing.sm }}>Por día</div>
          {data.dias.map((d) => (
            <div key={d.dia} style={{ display: "flex", alignItems: "center", gap: spacing.sm, marginBottom: 4 }}>
              <div style={{ width: 92, fontSize: fontSize.xs, color: palette.textLight, flexShrink: 0 }}>{nombreDia(d.dia)}</div>
              <div style={{ flex: 1, display: "flex", height: 14, background: palette.border, borderRadius: 4, overflow: "hidden" }}>
                {TIPOS_INGRESO.map((t) =>
                  d.porTipo[t.clave] > 0 ? (
                    <div
                      key={t.clave}
                      title={`${t.etiqueta}: ${pesos(d.porTipo[t.clave])}`}
                      style={{ width: `${(d.porTipo[t.clave] / maxDia) * 100}%`, background: t.color }}
                    />
                  ) : null
                )}
              </div>
              <div style={{ width: 84, textAlign: "right", fontSize: fontSize.xs, fontVariantNumeric: "tabular-nums" }}>
                {d.total > 0 ? pesos(d.total) : "—"}
              </div>
            </div>
          ))}
          <div style={{ display: "flex", gap: spacing.md, flexWrap: "wrap", marginTop: spacing.sm }}>
            {TIPOS_INGRESO.map((t) => (
              <span key={t.clave} style={{ fontSize: fontSize.xs, color: palette.textLight }}>
                <span style={{ display: "inline-block", width: 10, height: 10, background: t.color, borderRadius: 2, marginRight: 4 }} />
                {t.etiqueta}
              </span>
            ))}
          </div>
        </div>
      )}
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

  // Rol y permisos. NO salen de la sesión: session.isAdmin queda congelado en
  // el JWT desde el login, así que un turno de voluntario otorgado hace un
  // minuto no aparecería y uno revocado seguiría abriendo el panel.
  const [rolInfo, setRolInfo] = useState(null);
  const [rolError, setRolError] = useState(false);

  // Panel de voluntarios (solo admin)
  const [showStaffModal, setShowStaffModal] = useState(false);
  const [staffTurnos, setStaffTurnos] = useState([]);
  const [staffLoading, setStaffLoading] = useState(false);
  const [staffEmail, setStaffEmail] = useState("");
  const [staffName, setStaffName] = useState("");
  const [staffMsg, setStaffMsg] = useState("");
  const [staffOk, setStaffOk] = useState(true);
  const [staffPermanentes, setStaffPermanentes] = useState([]);
  const [staffPermanente, setStaffPermanente] = useState(false);

  // Caja del gimnasio (solo admin): lo calcula /api/admin/ingresos.
  const [ingresos, setIngresos] = useState(null);
  const [ingresosLoading, setIngresosLoading] = useState(false);
  const [ingresosError, setIngresosError] = useState("");

  // Inventario del mostrador (magnesio, cepillos). El estado vive en
  // components/Inventario.jsx; acá solo se abre.
  const [showInventario, setShowInventario] = useState(false);

  // Esconder un botón es comodidad, no seguridad: el endpoint vuelve a
  // preguntar por su cuenta (lib/authz.js).
  const can = useCallback(
    (permiso) => (rolInfo?.permisos || []).includes(permiso),
    [rolInfo]
  );
  const esVoluntario = rolInfo?.rol === "staff";
  const verSensible = can(PERMISOS.VER_SENSIBLE);

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
  // Aviso tras firmar el waiver de un miembro nuevo: devolver el teléfono al staff.
  const [showEntregaTelefono, setShowEntregaTelefono] = useState(false);
  const [showAccessModal, setShowAccessModal] = useState(false);
  const [showAttendanceModal, setShowAttendanceModal] = useState(false);

  // Editor de fechas (mismo modal para tiquetera y mensualidad; `datesMode`
  // decide labels, atajos y endpoint)
  const [showTiqueteraModal, setShowTiqueteraModal] = useState(false);
  const [datesMode, setDatesMode] = useState("tiquetera");
  const [tiqueteraUser, setTiqueteraUser] = useState(null);
  const [tiqueteraStart, setTiqueteraStart] = useState("");
  const [tiqueteraEnd, setTiqueteraEnd] = useState("");

  // Import/Export Excel operativo
  const [showImportModal, setShowImportModal] = useState(false);
  const [importPreview, setImportPreview] = useState(null);
  const [importSelected, setImportSelected] = useState(() => new Set());
  const [importBusy, setImportBusy] = useState(false);
  const [importResult, setImportResult] = useState(null);
  const importFileRef = useRef(null);
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
  // Cómo entra: "normal" (su tiquetera o mensualidad), "dia" (paga el día) o
  // "voluntario" (gratis). Ver hacerCheckin en lib/operaciones.js.
  const [pase, setPase] = useState("normal");
  const [paseZapatos, setPaseZapatos] = useState(false);
  // Acompañantes que entran con el socio y se descuentan de su tiquetera: al
  // hacer el check-in, o después (descuento). `checkinCredits` es el saldo vivo
  // del modal: checkinUser es una foto y no se refresca al descontar.
  const [acompanantes, setAcompanantes] = useState(0);
  const [descuentoN, setDescuentoN] = useState(1);
  const [checkinCredits, setCheckinCredits] = useState(null);
  const [creditsVenta, setCreditsVenta] = useState(true);
  const [renovarZapatos, setRenovarZapatos] = useState(false);
  const [accessZapatos, setAccessZapatos] = useState(false);

  // Cortesía (pase de invitado): paso 1 datos del invitado, paso 2 su waiver
  const [showCortesiaModal, setShowCortesiaModal] = useState(false);
  const [cortesiaHost, setCortesiaHost] = useState(null);
  const [cortesiaStep, setCortesiaStep] = useState(1);
  const [cortesiaForm, setCortesiaForm] = useState(INITIAL_GUEST);
  const [cortesiaSuccess, setCortesiaSuccess] = useState("");
  
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

  const waiverSnapshotGuest = useMemo(() => getWaiverSnapshot({
    cityLine: waiverCityLine,
    isMinor: !!cortesiaForm.esMinor,
    participantName: (cortesiaForm.name || "").trim(),
  }), [waiverCityLine, cortesiaForm.esMinor, cortesiaForm.name]);

  // Body scroll lock
  useEffect(() => {
    const open = showCreditsModal || showProfileModal || showNewUserModal || showRenovarModal ||
      showCheckinModal || showHistoryModal || showWaiverModal || showAccessModal ||
      showAttendanceModal || showMoonModal || showCancelMoonModal || showEditVisitModal ||
      showCheckinsByDateModal || showCortesiaModal;
    document.body.classList.toggle("modal-open", open);
    return () => document.body.classList.remove("modal-open");
  }, [showCreditsModal, showProfileModal, showNewUserModal, showRenovarModal,
    showCheckinModal, showHistoryModal, showWaiverModal, showAccessModal,
    showAttendanceModal, showMoonModal, showCancelMoonModal, showEditVisitModal,
    showCheckinsByDateModal, showCortesiaModal]);

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

    // Sin sesión ya no se dispara signIn() a ciegas: antes, quien caía en
    // /admin sin haber entrado se quedaba en "Cargando sesión..." para
    // siempre y sin botón. Ahora la pantalla de abajo ofrece el login.
    if (!session) return;

    (async () => {
      let info = null;
      try {
        const res = await axios.get("/api/me/rol");
        info = res.data || null;
      } catch {
        // No se pudo averiguar el rol (Mongo caído, red). No se echa a nadie:
        // se muestra el error y se ofrece reintentar, porque mandar a un admin
        // al inicio por un problema de red es peor que dejarlo insistir.
        setRolError(true);
        return;
      }

      setRolInfo(info);
      if (!info?.rol) return;

      fetchUsers();
      // La auditoría es solo de admin; pedirla como voluntario daría 403.
      if ((info.permisos || []).includes(PERMISOS.VER_AUDITORIA)) fetchAudit();
    })();
  }, [session, status, fetchUsers, fetchAudit]);

  // El turno se cae a medianoche o cuando un admin lo corta, y eso puede pasar
  // con el panel abierto. Sin esto, el voluntario vería "no se pudo guardar" en
  // cada click sin entender por qué.
  useEffect(() => {
    const id = axios.interceptors.response.use(
      (res) => res,
      (error) => {
        if (error?.response?.data?.code === "TURNO_VENCIDO") {
          setRolInfo({ rol: null, permisos: [], motivo: "TURNO_VENCIDO" });
        }
        return Promise.reject(error);
      }
    );
    return () => axios.interceptors.response.eject(id);
  }, []);

  const productosBuscados = useMemo(() => buscarProductos(query), [query]);

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
      case "conCortesia":
        result = result.filter((u) => estadoCortesia(u).disponible);
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
    let totalCortesiaCheckins = 0;
    let totalDiaCheckins = 0;
    let totalVoluntarioCheckins = 0;
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
            // La regla vive en lib/cortesia.js (y está testeada): el invitado
            // de cortesía NO puede caer en el cubo de tiquetera, que es el que
            // multiplica por $15.000.
            switch (clasificarCheckin(user, visit)) {
              case "cortesia":
                totalCortesiaCheckins++;
                break;
              case "dia":
                totalDiaCheckins++;
                break;
              case "voluntario":
                totalVoluntarioCheckins++;
                break;
              case "mensualidad":
                totalMensualidadCheckins++;
                mensualidadUsers.add(user._id);
                break;
              case "ticketera":
                totalTicketeraCheckins++;
                ticketeraUsers.add(user._id);
                break;
              default:
                break; // sin modalidad: cuenta como asistencia, no como plata
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
    
    return {
      totalCheckins,
      uniqueUsers: uniqueUsers.size,
      mensualidadCheckins: totalMensualidadCheckins,
      ticketeraCheckins: totalTicketeraCheckins,
      cortesiaCheckins: totalCortesiaCheckins,
      diaCheckins: totalDiaCheckins,
      voluntarioCheckins: totalVoluntarioCheckins,
      mensualidadUsers: mensualidadUsers.size,
      ticketeraUsers: ticketeraUsers.size,
      checkinChange,
      usersChange
    };
  }, [users, kpiPeriod]);

  // La caja se recalcula al cambiar el período y cada vez que la lista de
  // usuarios se refresca (después de cada cobro o check-in).
  const puedeVerIngresos = can(PERMISOS.VER_INGRESOS);
  useEffect(() => {
    if (!puedeVerIngresos) return undefined;
    let vigente = true;
    setIngresosLoading(true);
    axios
      .get("/api/admin/ingresos", { params: { periodo: kpiPeriod } })
      .then((res) => {
        if (!vigente) return;
        setIngresos(res.data);
        setIngresosError("");
      })
      .catch(() => {
        if (vigente) setIngresosError("No se pudieron cargar los ingresos.");
      })
      .finally(() => {
        if (vigente) setIngresosLoading(false);
      });
    return () => {
      vigente = false;
    };
  }, [puedeVerIngresos, kpiPeriod, users]);

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

  const exportExcel = () => {
    // Export en formato Excel operativo (hojas MENSUALIDADES + TIQUETERAS).
    window.location.href = "/api/admin/export-xlsx";
  };

  // ── Import Excel (antibobos: preview → confirmar → aplicar) ──────────
  const handleImportFile = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = ""; // permite re-seleccionar el mismo archivo
    if (!file) return;
    setUiError("");
    setImportResult(null);
    setImportBusy(true);
    try {
      const b64 = await new Promise((resolve, reject) => {
        const fr = new FileReader();
        fr.onload = () => resolve(String(fr.result).split(",")[1]);
        fr.onerror = () => reject(new Error("No se pudo leer el archivo"));
        fr.readAsDataURL(file);
      });
      const res = await axios.post("/api/admin/import-xlsx", { mode: "preview", file: b64 });
      const rows = res.data?.rows || [];
      setImportPreview(res.data);
      // Antibobos: exactos y nuevos (a crear) vienen marcados; los fuzzy
      // desmarcados para que el admin los revise uno a uno.
      setImportSelected(
        new Set(
          rows
            .filter((r) => r.matchType === "exact" || r.matchType === "none")
            .map((r) => r.id)
        )
      );
      setShowImportModal(true);
    } catch (err) {
      setUiError(err?.response?.data?.message || "No se pudo leer el Excel.");
    } finally {
      setImportBusy(false);
    }
  };

  const toggleImportRow = (id) => {
    setImportSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const applyImport = async () => {
    if (!importPreview) return;
    const rows = importPreview.rows
      .filter((r) => importSelected.has(r.id) && (r.user || r.matchType === "none"))
      .map((r) => ({
        userId: r.user?._id || null, // null => se crea el usuario
        sheet: r.sheet,
        excelName: r.excelName,
        proposed: r.proposed,
      }));
    if (rows.length === 0) return;
    setUiError("");
    setImportBusy(true);
    try {
      const res = await axios.post("/api/admin/import-xlsx", { mode: "apply", rows });
      if (res.data?.auditEvent) appendAuditEvent(res.data.auditEvent);
      setImportResult(res.data);
      await fetchUsers();
    } catch (err) {
      setUiError(err?.response?.data?.message || "No se pudo aplicar el import.");
    } finally {
      setImportBusy(false);
    }
  };

  // ── Editor de fechas de tiquetera ──────────────────────────────────
  const toBogotaDay = (d) =>
    d ? new Date(d).toLocaleDateString("en-CA", { timeZone: "America/Bogota" }) : "";

  const openTiqueteraDates = (user) => {
    setUiError("");
    setDatesMode("tiquetera");
    setTiqueteraUser(user);
    setTiqueteraStart(toBogotaDay(user.tiquetera?.startDate));
    setTiqueteraEnd(toBogotaDay(user.tiquetera?.endDate));
    setShowTiqueteraModal(true);
  };

  const openMensualidadDates = (user) => {
    setUiError("");
    setDatesMode("mensualidad");
    setTiqueteraUser(user);
    setTiqueteraStart(toBogotaDay(user.mensualidad?.startDate));
    setTiqueteraEnd(toBogotaDay(user.mensualidad?.endDate));
    setShowTiqueteraModal(true);
  };

  const submitTiqueteraDates = async () => {
    if (!tiqueteraUser) return;
    if (!tiqueteraStart && !tiqueteraEnd) {
      setUiError("Pon al menos una fecha.");
      return;
    }
    setBusy(true);
    setUiError("");
    try {
      const endpoint =
        datesMode === "mensualidad"
          ? "/api/admin/users/mensualidad-dates"
          : "/api/admin/users/tiquetera-dates";
      const res = await axios.post(endpoint, {
        userId: tiqueteraUser._id,
        startDate: tiqueteraStart || undefined,
        endDate: tiqueteraEnd || undefined,
      });
      if (res.data?.auditEvent) appendAuditEvent(res.data.auditEvent);
      await fetchUsers();
      setShowTiqueteraModal(false);
      setTiqueteraUser(null);
    } catch (error) {
      setUiError(error?.response?.data?.message || "No se pudieron actualizar las fechas.");
    } finally {
      setBusy(false);
    }
  };

  const closeImportModal = () => {
    if (importBusy) return;
    setShowImportModal(false);
    setImportPreview(null);
    setImportResult(null);
    setImportSelected(new Set());
  };

  const describeImportCurrent = (r) => {
    if (!r.current) return "—";
    if (r.sheet === "mensualidades") {
      const acc = r.current.accessType || "sin modalidad";
      return `${acc}${r.current.endDate ? ` · vence ${formatDate(r.current.endDate)}` : ""}`;
    }
    return `${r.current.credits ?? 0} créditos${r.current.endDate ? ` · vence ${formatDate(r.current.endDate)}` : ""}`;
  };

  const describeImportProposed = (r) => {
    if (r.sheet === "mensualidades") {
      return `Mensualidad ${r.proposed.active ? "ACTIVA" : "vencida"}${r.proposed.endDate ? ` · vence ${formatDate(r.proposed.endDate)}` : ""}`;
    }
    return `Tiquetera · ${r.proposed.credits ?? 0} créditos${r.proposed.endDate ? ` · vence ${formatDate(r.proposed.endDate)}` : ""}`;
  };

  const importChip = (t) => {
    if (t === "exact") return <Badge $success>✓ exacto</Badge>;
    if (t === "fuzzy") return <Badge>≈ revisar</Badge>;
    if (t === "ambiguous") return <Badge $danger>ambiguo</Badge>;
    return <Badge>🆕 se creará</Badge>;
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
    // Quien no puede entrar con su modalidad (sin créditos, mes vencido o sin
    // modalidad) arranca en pase de día: es lo que casi siempre viene a hacer.
    setPase(userCanCheckin(user) ? "normal" : "dia");
    setPaseZapatos(false);
    setAcompanantes(0);
    setDescuentoN(1);
    setCheckinCredits(user?.credits ?? 0);
    setShowCheckinModal(true);
  };

  // Descontar créditos de acompañantes DESPUÉS del check-in (ya entró el socio
  // y se acuerdan de que venía con sus hijos).
  const submitDescuento = async () => {
    setUiError("");
    if (!checkinUser) return;
    setBusy(true);
    try {
      const res = await axios.post("/api/admin/descontar-creditos", {
        userId: checkinUser._id,
        cantidad: descuentoN,
        motivo: "acompañantes",
      });
      setCheckinCredits(res.data?.credits ?? null);
      setCheckinSuccess(`✅ Descontados ${descuentoN} crédito${descuentoN === 1 ? "" : "s"}. Créditos restantes: ${res.data?.credits ?? ""}`);
      setDescuentoN(1);
      if (res.data?.auditEvent) appendAuditEvent(res.data.auditEvent);
      await fetchUsers();
    } catch (error) {
      setUiError(error?.response?.data?.message || "No se pudieron descontar los créditos.");
    } finally {
      setBusy(false);
    }
  };

  const submitCheckin = async () => {
    setUiError("");
    setCheckinSuccess("");
    if (!checkinUser) return;
    setBusy(true);
    try {
      const res = await axios.post("/api/admin/visits/checkin", {
        userId: checkinUser._id,
        pase: pase === "normal" ? undefined : pase,
        zapatos: pase === "dia" ? paseZapatos : undefined,
        acompanantes:
          pase === "normal" && checkinUser.accessType === "ticketera" && acompanantes > 0 ? acompanantes : undefined,
      });
      if (typeof res.data?.credits === "number") setCheckinCredits(res.data.credits);
      const code = res.data?.code;
      if (code === "ALREADY_CHECKED_IN") {
        setCheckinSuccess("✅ Este usuario ya hizo check-in hoy.");
      } else if (pase === "dia") {
        setCheckinSuccess(`✅ Pase de día registrado. Cobrar ${pesos(precioDia(paseZapatos))}.`);
      } else if (pase === "voluntario") {
        setCheckinSuccess("✅ Entrada de voluntario registrada (gratis).");
      } else {
        const creditsMsg = checkinUser.accessType === "ticketera"
          ? ` Créditos restantes: ${res.data?.credits ?? ""}` : "";
        const conAcomp = acompanantes > 0 ? ` (tú + ${acompanantes} acompañante${acompanantes === 1 ? "" : "s"})` : "";
        setCheckinSuccess(`✅ Check-in registrado${conAcomp}.${creditsMsg}`);
      }
      if (res.data?.auditEvent) appendAuditEvent(res.data.auditEvent);
      await fetchUsers();
    } catch (error) {
      setUiError(error?.response?.data?.message || "No se pudo registrar el check-in.");
    } finally {
      setBusy(false);
    }
  };

  // ── Cortesía (pase de invitado) ────────────────────────────────────
  const openCortesia = (user) => {
    setUiError("");
    setCortesiaSuccess("");
    setCortesiaHost(user);
    setCortesiaForm(INITIAL_GUEST);
    setCortesiaStep(1);
    hasInkRef.current = false;
    setWaiverAccepted(false);
    setShowCortesiaModal(true);
  };

  const closeCortesia = () => {
    if (busy) return;
    setShowCortesiaModal(false);
    setCortesiaHost(null);
    setCortesiaStep(1);
    setCortesiaSuccess("");
    setUiError("");
  };

  // Paso 1 → 2: solo valida en el cliente y monta el canvas. El invitado no se
  // crea hasta el submit final, así el waiver y el check-in van juntos.
  const cortesiaNextStep = () => {
    setUiError("");
    const f = cortesiaForm;
    if (!f.name.trim()) return setUiError("El nombre del invitado es obligatorio.");
    if (!f.documentNumber.trim()) return setUiError("El documento del invitado es obligatorio.");
    if (!f.phone.trim()) return setUiError("El teléfono del invitado es obligatorio.");
    if (!f.emergencyContactName.trim() || !f.emergencyContactPhone.trim())
      return setUiError("Completa el contacto de emergencia del invitado.");
    setCortesiaStep(2);
    requestAnimationFrame(() => requestAnimationFrame(() => {
      resizeCanvasToDevicePixels();
      clearSignature();
    }));
  };

  const submitCortesia = async () => {
    setUiError("");
    if (!cortesiaHost?._id) return;
    if (!waiverAccepted) return setUiError("El invitado debe aceptar el waiver.");
    const canvas = canvasRef.current;
    if (!canvas) return setUiError("Canvas no disponible.");
    if (isCanvasBlank(canvas) || !hasInkRef.current) return setUiError("La firma es obligatoria.");

    const { text: waiverTextSnapshot, version } = waiverSnapshotGuest;
    const nombre = cortesiaForm.name.trim();

    setBusy(true);
    try {
      const res = await axios.post("/api/admin/cortesia/usar", {
        hostId: cortesiaHost._id,
        guest: {
          ...cortesiaForm,
          name: nombre,
          documentType: normalizeDocType(cortesiaForm.documentType),
        },
        waiver: {
          version,
          waiverTextSnapshot,
          signatureImageUrl: exportSignatureDataUrl(),
          signatureText: cortesiaForm.esMinor ? `Representante legal de ${nombre}` : nombre,
        },
      });
      if (res.data?.auditEvent) appendAuditEvent(res.data.auditEvent);
      setCortesiaSuccess(`✅ ${nombre} quedó con check-in como invitado de ${cortesiaHost.name}.`);
      await fetchUsers();
    } catch (error) {
      setUiError(error?.response?.data?.message || "No se pudo registrar la cortesía.");
    } finally {
      setBusy(false);
    }
  };

  // Otorgar/quitar a mano: para los socios que ya venían con tiquetera vigente
  // (el automático solo dispara en la próxima compra) y para corregir errores.
  const setCortesiaManual = async (accion) => {
    setUiError("");
    if (!cortesiaHost?._id) return;
    setBusy(true);
    try {
      const res = await axios.post("/api/admin/cortesia/set", {
        userId: cortesiaHost._id,
        accion,
      });
      if (res.data?.auditEvent) appendAuditEvent(res.data.auditEvent);
      setCortesiaHost((h) => (h ? { ...h, cortesia: res.data?.cortesia } : h));
      await fetchUsers();
    } catch (error) {
      setUiError(error?.response?.data?.message || "No se pudo actualizar la cortesía.");
    } finally {
      setBusy(false);
    }
  };

  const handleAddCredits = (userId) => {
    setUiError("");
    setCreditsSuccess("");
    setSelectedUser(userId);
    setCredits(0);
    setCreditsVenta(true);
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
        venta: creditsVenta && amount > 0,
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
    setRenovarZapatos(false);
    setShowRenovarModal(true);
  };

  const submitRenovar = async () => {
    setUiError("");
    if (!selectedUser) return;
    setBusy(true);
    try {
      const res = await axios.post("/api/admin/mensualidad/renovar", {
        userId: selectedUser, months: renovarMonths, zapatos: renovarZapatos,
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
    setAccessZapatos(false);
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
        zapatos: accessTypeDraft === "mensualidad" ? accessZapatos : undefined,
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
      email: user.email || "",
      phone: user.phone || "",
      documentType: user.documentType || "CC",
      documentNumber: user.documentNumber || "",
      epsName: user.epsName || "",
      emergencyContactName: user.emergencyContactName || "",
      emergencyContactPhone: user.emergencyContactPhone || "",
    });
    setViewingUser(user);
    setShowProfileModal(true);

    // La lista viene sin los campos pesados (firma del waiver, snapshot);
    // se hidrata el detalle completo en segundo plano.
    axios
      .get(`/api/admin/users/${user._id}`)
      .then((res) => {
        if (res.data?.user) {
          setViewingUser((prev) =>
            prev && String(prev._id) === String(user._id) ? res.data.user : prev
          );
        }
      })
      .catch(() => {});
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

  // ── Voluntarios (turnos de staff) ──────────────────────────────────
  const fetchStaff = useCallback(async () => {
    setStaffLoading(true);
    try {
      const res = await axios.get("/api/admin/staff");
      setStaffTurnos(Array.isArray(res.data?.turnos) ? res.data.turnos : []);
      setStaffPermanentes(Array.isArray(res.data?.permanentes) ? res.data.permanentes : []);
    } catch {
      setStaffOk(false);
      setStaffMsg("No se pudo cargar la lista de voluntarios.");
    } finally {
      setStaffLoading(false);
    }
  }, []);

  const openStaffModal = () => {
    setStaffMsg("");
    setStaffOk(true);
    setStaffTurnos([]);
    setStaffPermanentes([]);
    setStaffPermanente(false);
    setStaffEmail("");
    setStaffName("");
    setShowStaffModal(true);
    fetchStaff();
  };

  const otorgarTurno = async () => {
    const email = staffEmail.trim().toLowerCase();
    if (!email) {
      setStaffOk(false);
      setStaffMsg("Escribí el email del voluntario.");
      return;
    }

    setBusy(true);
    setStaffMsg("");
    setStaffOk(true);
    try {
      const res = await axios.post("/api/admin/staff", { email, name: staffName.trim(), permanente: staffPermanente });
      setStaffOk(true);
      setStaffMsg(res.data?.message || (staffPermanente ? "Voluntario permanente agregado." : "Turno otorgado."));
      setStaffEmail("");
      setStaffName("");
      appendAuditEvent(res.data?.auditEvent);
      await fetchStaff();
    } catch (e) {
      setStaffOk(false);
      setStaffMsg(e?.response?.data?.message || "No se pudo otorgar el turno.");
    } finally {
      setBusy(false);
    }
  };

  const quitarPermanente = async (v) => {
    if (!window.confirm(`¿Quitar a ${v.name || v.email} de los voluntarios permanentes? Pierde el acceso de inmediato.`)) return;

    setBusy(true);
    setStaffMsg("");
    setStaffOk(true);
    try {
      const res = await axios.post("/api/admin/staff/revocar", { id: v._id, permanente: true });
      setStaffMsg(res.data?.message || "Voluntario quitado.");
      appendAuditEvent(res.data?.auditEvent);
      await fetchStaff();
    } catch (e) {
      setStaffOk(false);
      setStaffMsg(e?.response?.data?.message || "No se pudo quitar al voluntario.");
    } finally {
      setBusy(false);
    }
  };

  const revocarTurno = async (turno) => {
    if (!window.confirm(`¿Cortarle el turno a ${turno.email}? Pierde el acceso de inmediato.`)) return;

    setBusy(true);
    setStaffMsg("");
    setStaffOk(true);
    try {
      const res = await axios.post("/api/admin/staff/revocar", { id: turno._id });
      setStaffMsg(res.data?.message || "Turno revocado.");
      appendAuditEvent(res.data?.auditEvent);
      await fetchStaff();
    } catch (e) {
      setStaffOk(false);
      setStaffMsg(e?.response?.data?.message || "No se pudo revocar el turno.");
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
      zapatos: newUserForm.accessType === "mensualidad" ? !!newUserForm.zapatos : undefined,
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

      // Pase de día: con el waiver firmado, entra y queda cobrado.
      let falloPase = "";
      if (newUserForm.accessType === "dia") {
        try {
          const ci = await axios.post("/api/admin/visits/checkin", {
            userId: selectedUser,
            pase: "dia",
            zapatos: !!newUserForm.zapatos,
          });
          if (ci.data?.auditEvent) appendAuditEvent(ci.data.auditEvent);
        } catch (e) {
          falloPase = e?.response?.data?.message || "no se pudo registrar el pase";
        }
      }

      closeNewUser();
      setShowEntregaTelefono(true);
      await fetchUsers();
      setUiError(
        falloPase
          ? `El miembro quedó creado y con waiver firmado, pero ${falloPase}. Regístrale el pase desde Acciones → Check-in.`
          : ""
      );
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
    const conCortesia = users.filter((u) => estadoCortesia(u).disponible).length;
    return { total, waiverPend, mensualidadVencida, sinCreditos, menores, checkinHoy, conCortesia };
  }, [users]);

  const currentMoonDay = moonDays[moonSelectedDay];

  // El texto y la acción se deciden en lib/gateAdmin.js (puro y testeado):
  // esta pantalla es la única que no se puede probar logueado en local.
  const gate = estadoGate({ status, session, rolInfo, rolError });
  const accionGate = {
    [ACCION_LOGIN]: { label: "Iniciar sesión", onClick: () => signIn("google") },
    [ACCION_REINTENTAR]: { label: "Reintentar", onClick: () => router.reload() },
    [ACCION_INICIO]: { label: "Ir al inicio", onClick: () => router.push("/") },
  }[gate?.accion];

  if (gate) {
    return (
      <PageShell>
        <GlobalStyle />
        <Container>
          <Header>
            <Title>Panel de Administración</Title>
          </Header>
          <div style={{ padding: spacing.xl, textAlign: "center", color: palette.textLight }}>
            <div style={{ marginBottom: spacing.lg }}>{gate.texto}</div>
            {accionGate && (
              <Button onClick={accionGate.onClick}>{accionGate.label}</Button>
            )}
            {session && (
              <div style={{ marginTop: spacing.md }}>
                <Button $variant="secondary" $small onClick={() => signOut({ callbackUrl: "/" })}>
                  Cerrar sesión
                </Button>
              </div>
            )}
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

        {/* El voluntario tiene que ver la hora a la que se le cae el turno.
            Si no, lo descubre con un error en mitad de un cobro. */}
        {esVoluntario && (
          <TurnoBanner>
            <span>🕐 {rolInfo?.permanente ? "Voluntario permanente" : etiquetaTurno(rolInfo?.vence)}</span>
            <span style={{ opacity: 0.8 }}>
              Podés cobrar y hacer check-in. Los datos personales y la gestión quedan para un admin.
            </span>
          </TurnoBanner>
        )}

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
            {/* El modo privacidad enmascara en pantalla. Al voluntario no le
                sirve: el dato sensible ya no viene en la respuesta. */}
            {verSensible && (
              <Button $variant="secondary" onClick={togglePrivacyMode} title={privacyMode ? "Mostrar datos sensibles" : "Ocultar datos sensibles"}>
                {privacyMode
                  ? <EyeOff size={14} style={{ verticalAlign: "-2px" }} />
                  : <Eye size={14} style={{ verticalAlign: "-2px" }} />} Privacidad
              </Button>
            )}
            {can(PERMISOS.EXPORTAR) && (
              <Button onClick={exportExcel} $variant="secondary">
                📥 Exportar Excel
              </Button>
            )}
            {can(PERMISOS.IMPORTAR) && (
              <>
                <Button onClick={() => importFileRef.current?.click()} $variant="secondary" disabled={importBusy}>
                  📤 {importBusy ? "Leyendo..." : "Importar Excel"}
                </Button>
                <input
                  ref={importFileRef}
                  type="file"
                  accept=".xlsx"
                  style={{ display: "none" }}
                  onChange={handleImportFile}
                />
              </>
            )}
            <Button onClick={() => fetchCheckinsByDate(new Date().toISOString().slice(0, 10))} $variant="secondary">
              📅 Ver check-ins de hoy
            </Button>
            <Button onClick={openAttendanceModal}>
              📊 Asistencia
            </Button>
            {can(PERMISOS.COBRAR) && (
              <Button $variant="secondary" onClick={() => setShowInventario(true)}>
                📦 Inventario
              </Button>
            )}
            {can(PERMISOS.CREAR_USUARIO) && (
              <Button onClick={openNewUser}>
                + Nuevo miembro
              </Button>
            )}
            {can(PERMISOS.GESTIONAR_STAFF) && (
              <Button $variant="secondary" onClick={openStaffModal}>
                🧑‍🤝‍🧑 Voluntarios
              </Button>
            )}
            <Button $variant="secondary" onClick={() => signOut()}>
              Cerrar sesión
            </Button>
          </div>
        </TopBar>

        {/* DASHBOARD COLLAPSIBLE */}
        <DashboardHeader onClick={() => setDashboardExpanded(!dashboardExpanded)}>
          <DashboardTitle>
            <span>{can(PERMISOS.VER_INGRESOS) ? "📈 Dashboard de ingresos" : "📈 Dashboard de asistencia"}</span>
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
            </KPICard>
            <KPICard>
              <KPIValue>{kpiData.mensualidadCheckins}</KPIValue>
              <KPILabel>Check-ins (mensualidad)</KPILabel>
              <KPISub>{kpiData.mensualidadUsers} usuarios activos</KPISub>
            </KPICard>
            <KPICard>
              <KPIValue>{kpiData.cortesiaCheckins}</KPIValue>
              <KPILabel>Invitados (cortesía)</KPILabel>
              <KPISub>Entradas gratis, no suman ingreso</KPISub>
            </KPICard>
            <KPICard>
              <KPIValue>{kpiData.diaCheckins}</KPIValue>
              <KPILabel>Pases de día</KPILabel>
            </KPICard>
            <KPICard>
              <KPIValue>{kpiData.voluntarioCheckins}</KPIValue>
              <KPILabel>Voluntarios</KPILabel>
              <KPISub>Gratis, no suman ingreso</KPISub>
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

        {dashboardExpanded && can(PERMISOS.VER_INGRESOS) && (
          <IngresosPanel data={ingresos} loading={ingresosLoading} error={ingresosError} periodo={kpiPeriod} />
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
          <FilterChip $active={quickFilter === "conCortesia"} onClick={() => setQuickFilter("conCortesia")}>
            Con cortesía · {counts.conCortesia}
          </FilterChip>
        </FiltersBar>

        {uiError && <div style={{ padding: `0 ${spacing.xl}` }}><ErrorBox>{uiError}</ErrorBox></div>}

        {/* Buscar "magnesio" o "cepillo" ofrece registrar la venta ahí mismo */}
        {can(PERMISOS.COBRAR) && productosBuscados.length > 0 && (
          <VentaRapida
            key={productosBuscados.map((p) => p.clave).join(",")}
            productos={productosBuscados}
            onAuditEvent={appendAuditEvent}
            onVerInventario={() => setShowInventario(true)}
          />
        )}

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
                          {user.accessType === "mensualidad" ? "Mensualidad" : user.accessType === "ticketera" ? "Tiquetera" : "Sin modalidad"}
                        </Badge>
                      </CardHeader>
                      <CardInfo>
                        {verSensible && <div>📞 {maskPhone(user.phone) || "—"}</div>}
                        <div>📅 Registro: {user.createdAt ? formatDate(user.createdAt) : "—"}</div>
                        {verSensible && (
                          <div>📋 {user.documentType || ""} {maskDocument(user.documentNumber) || ""}</div>
                        )}
                      </CardInfo>
                      <AccessInfo
                        user={user}
                        onRenovar={handleRenovar}
                        onChangeAccess={openAccessModal}
                        onEditTiquetera={openTiqueteraDates}
                        onEditMensualidad={openMensualidadDates}
                        busy={busy}
                        can={can}
                      />
                      <div style={{ marginTop: spacing.sm }}>
                        <MobileActionMenu
                          user={user}
                          onCheckin={handleCheckin}
                          onCortesia={openCortesia}
                          onMoon={openMoonModal}
                          onViewProfile={handleViewProfile}
                          onCredits={handleAddCredits}
                          onHistory={openHistory}
                          onDelete={handleDeleteUser}
                          onEditVisit={handleEditVisit}
                          busy={busy}
                          can={can}
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
                        {verSensible && <Th>Contacto</Th>}
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
                          {/* La columna entera se va: para el voluntario
                              estos campos ni siquiera vienen en la respuesta,
                              así que quedaría una columna de guiones. */}
                          {verSensible && (
                            <Td>
                              <div>{maskPhone(user.phone) || "—"}</div>
                              <div style={{ fontSize: fontSize.sm, color: palette.textLight }}>{user.documentType || ""} {maskDocument(user.documentNumber) || ""}</div>
                            </Td>
                          )}
                          <Td>
                            <AccessInfo
                              user={user}
                              onRenovar={handleRenovar}
                              onChangeAccess={openAccessModal}
                              onEditTiquetera={openTiqueteraDates}
                              onEditMensualidad={openMensualidadDates}
                              busy={busy}
                              can={can}
                            />
                          </Td>
                          <Td>
                            {user.lastCheckinAt ? formatDateTime(user.lastCheckinAt) : "—"}
                          </Td>
                          <Td>
                            {user.createdAt ? formatDate(user.createdAt) : "—"}
                          </Td>
                          <Td>
                            {user?.waiverStatus !== "signed" ? (
                              <Badge $danger>No firmado</Badge>
                            ) : verSensible ? (
                              <Button $variant="secondary" $small as="a" href={`/api/admin/waiver/pdf?email=${encodeURIComponent(user.email)}`} target="_blank">
                                Ver PDF
                              </Button>
                            ) : (
                              // El PDF trae documento, contacto de emergencia y
                              // la firma. Al voluntario le basta saber que está.
                              <Badge $success>Firmado</Badge>
                            )}
                          </Td>
                          <Td>
                            <ActionMenu
                              user={user}
                              onCheckin={handleCheckin}
                              onCortesia={openCortesia}
                              onMoon={openMoonModal}
                              onViewProfile={handleViewProfile}
                              onCredits={handleAddCredits}
                              onHistory={openHistory}
                              onDelete={handleDeleteUser}
                              onEditVisit={handleEditVisit}
                              busy={busy}
                              can={can}
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

          {can(PERMISOS.VER_AUDITORIA) && <AuditFeed events={auditEvents} loading={auditLoading} />}
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
                      <div style={{ fontSize: fontSize.sm, color: palette.textLight }}>
                        {checkin.esCortesia
                          ? `🎟️ Invitado de ${maskName(checkin.cortesiaHostName) || "un socio"}`
                          : checkin.esPaseDia
                            ? `Pase de día ${checkin.conZapatos ? "con" : "sin"} zapatos`
                            : checkin.esVoluntario
                              ? "Voluntario"
                              : maskEmail(checkin.userEmail)}
                      </div>
                    </div>
                    <div style={{ display: "flex", gap: spacing.sm, alignItems: "center" }}>
                      <Badge $success={checkin.accessType === "mensualidad"}>
                        {checkin.esCortesia ? "Cortesía" : checkin.esPaseDia ? "Día" : checkin.esVoluntario ? "Vol" : checkin.accessType === "mensualidad" ? "Mens" : "Tiq"}
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
            {(() => {
              const u = users.find((x) => x._id === selectedUser);
              const saldo = u?.credits ?? 0;
              const delta = Number.isFinite(Number(credits)) ? Math.trunc(Number(credits)) : 0;
              const nuevo = saldo + delta;
              return (
                <div style={{ marginBottom: spacing.sm }}>
                  {u && (
                    <div style={{ fontSize: fontSize.sm, color: palette.textLight, marginBottom: spacing.xs }}>
                      {u.name} · saldo actual: <strong>{saldo}</strong> crédito{saldo === 1 ? "" : "s"}
                    </div>
                  )}
                  <div style={{ display: "flex", gap: spacing.xs, flexWrap: "wrap", marginBottom: spacing.sm }}>
                    {[-1, -2, -3, -4].map((n) => (
                      <Button key={n} type="button" $variant="secondary" disabled={busy || saldo + n < 0}
                        onClick={() => { setCredits(n); setCreditsVenta(false); }}>{n}</Button>
                    ))}
                    <Button type="button" $variant="secondary" disabled={busy}
                      onClick={() => { setCredits(PRECIOS.TIQUETERA_USOS); setCreditsVenta(true); }}>
                      +{PRECIOS.TIQUETERA_USOS} tiquetera
                    </Button>
                  </div>
                  <Input
                    type="number"
                    value={credits}
                    onChange={(e) => setCredits(e.target.value)}
                    placeholder="Cantidad (+ para agregar, - para quitar)"
                  />
                  {delta !== 0 && u && (
                    <div style={{ fontSize: fontSize.sm, color: nuevo < 0 ? palette.danger : palette.textLight }}>
                      {saldo} → {Math.max(0, nuevo)} créditos
                      {nuevo < 0 && " · el saldo no puede quedar negativo (quedaría en 0)"}
                    </div>
                  )}
                </div>
              );
            })()}
            {Number(credits) > 0 && (
              <div style={{ display: "flex", flexDirection: "column", gap: spacing.xs, marginBottom: spacing.md }}>
                <label style={{ display: "flex", gap: spacing.sm, alignItems: "center" }}>
                  <input type="radio" name="venta" checked={creditsVenta} onChange={() => setCreditsVenta(true)} />
                  Venta de tiquetera · {pesos(precioTiquetera(Number(credits)))}
                </label>
                <label style={{ display: "flex", gap: spacing.sm, alignItems: "center" }}>
                  <input type="radio" name="venta" checked={!creditsVenta} onChange={() => setCreditsVenta(false)} />
                  Corrección de saldo (no suma a la caja)
                </label>
              </div>
            )}
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
                    {checkinUser.accessType === "mensualidad" ? "Mensualidad" : checkinUser.accessType === "ticketera" ? "Tiquetera" : "Sin modalidad"}
                  </Badge>
                  {checkinUser.accessType === "ticketera" ? (
                    <Badge>{checkinCredits ?? checkinUser.credits ?? 0} créditos</Badge>
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
                {!hasCheckedInToday(checkinUser) && !checkinSuccess && (
                  <div style={{ display: "flex", flexDirection: "column", gap: spacing.xs, marginBottom: spacing.md }}>
                    <div style={{ fontSize: fontSize.sm, fontWeight: 600 }}>¿Cómo entra hoy?</div>
                    <label style={{ display: "flex", gap: spacing.sm, alignItems: "center", opacity: userCanCheckin(checkinUser) ? 1 : 0.5 }}>
                      <input type="radio" name="pase" checked={pase === "normal"} disabled={!userCanCheckin(checkinUser)}
                        onChange={() => setPase("normal")} />
                      {checkinUser.accessType === "mensualidad"
                        ? "Con su mensualidad"
                        : checkinUser.accessType === "ticketera"
                          ? "Con su tiquetera (−1 crédito)"
                          : "Con su modalidad"}
                      {!userCanCheckin(checkinUser) && (
                        <span style={{ color: palette.danger, fontSize: fontSize.xs }}>
                          {checkinUser.accessType === "ticketera" ? "sin créditos" : checkinUser.accessType === "mensualidad" ? "vencida" : "no tiene"}
                        </span>
                      )}
                    </label>
                    <label style={{ display: "flex", gap: spacing.sm, alignItems: "center" }}>
                      <input type="radio" name="pase" checked={pase === "dia"} onChange={() => setPase("dia")} />
                      Pase de día (no gasta créditos)
                    </label>
                    {pase === "dia" && (
                      <div style={{ marginLeft: spacing.lg, display: "flex", gap: spacing.md, flexWrap: "wrap" }}>
                        <label style={{ display: "flex", gap: spacing.xs, alignItems: "center" }}>
                          <input type="radio" name="zapatos" checked={!paseZapatos} onChange={() => setPaseZapatos(false)} />
                          Sin zapatos · {pesos(PRECIOS.DIA)}
                        </label>
                        <label style={{ display: "flex", gap: spacing.xs, alignItems: "center" }}>
                          <input type="radio" name="zapatos" checked={paseZapatos} onChange={() => setPaseZapatos(true)} />
                          Con zapatos · {pesos(PRECIOS.DIA_ZAPATOS)}
                        </label>
                      </div>
                    )}
                    {can(PERMISOS.CHECKIN) && (
                      <label style={{ display: "flex", gap: spacing.sm, alignItems: "center" }}>
                        <input type="radio" name="pase" checked={pase === "voluntario"} onChange={() => setPase("voluntario")} />
                        Voluntario (gratis)
                      </label>
                    )}
                  </div>
                )}
                {pase === "normal" && checkinUser.accessType === "ticketera" && (checkinUser.credits ?? 0) <= 0 && (
                  <ErrorBox>⚠️ Sin créditos — elige pase de día o recarga la tiquetera.</ErrorBox>
                )}
                {/* Entra con acompañantes (un padre con sus hijos): se descuentan de una vez. */}
                {!hasCheckedInToday(checkinUser) && !checkinSuccess && pase === "normal" &&
                  checkinUser.accessType === "ticketera" && (checkinUser.credits ?? 0) > 1 && (
                  <div style={{ marginBottom: spacing.md }}>
                    <div style={{ fontSize: fontSize.sm, fontWeight: 600, marginBottom: spacing.xs }}>
                      ¿Entra con acompañantes? (cada uno gasta un crédito)
                    </div>
                    <CreditStepper
                      value={acompanantes}
                      min={0}
                      max={Math.min(MAX_ACOMPANANTES, (checkinUser.credits ?? 0) - 1)}
                      onChange={setAcompanantes}
                      disabled={busy}
                    />
                    {acompanantes > 0 && (
                      <div style={{ fontSize: fontSize.sm, color: palette.textLight, marginTop: spacing.xs }}>
                        Se descuentan {1 + acompanantes} créditos: {checkinUser.credits ?? 0} → {(checkinUser.credits ?? 0) - 1 - acompanantes}
                      </div>
                    )}
                  </div>
                )}
                {/* Ya entró: descontar más créditos después (se acordaron de los acompañantes). */}
                {checkinUser.accessType === "ticketera" && (hasCheckedInToday(checkinUser) || (checkinSuccess && pase === "normal")) &&
                  (checkinCredits ?? 0) > 0 && (
                  <div style={{ marginBottom: spacing.md, paddingTop: spacing.sm, borderTop: `1px solid ${palette.border || "#e5e5e5"}` }}>
                    <div style={{ fontSize: fontSize.sm, fontWeight: 600, marginBottom: spacing.xs }}>
                      Descontar créditos de acompañantes
                    </div>
                    <CreditStepper
                      value={descuentoN}
                      min={1}
                      max={Math.min(MAX_ACOMPANANTES, checkinCredits ?? 0)}
                      onChange={setDescuentoN}
                      disabled={busy}
                    />
                    <div style={{ fontSize: fontSize.sm, color: palette.textLight, margin: `${spacing.xs} 0` }}>
                      {checkinCredits} → {(checkinCredits ?? 0) - descuentoN} créditos
                    </div>
                    <Button onClick={submitDescuento} disabled={busy || descuentoN > (checkinCredits ?? 0)}>
                      {busy ? "Descontando..." : `− Descontar ${descuentoN} crédito${descuentoN === 1 ? "" : "s"}`}
                    </Button>
                  </div>
                )}
                {pase === "normal" && checkinUser.accessType === "mensualidad" && !getMensualidadStatus(checkinUser.mensualidad).active && (
                  <ErrorBox>⚠️ Mensualidad vencida — elige pase de día o renueva el mes.</ErrorBox>
                )}
              </>
            )}
            {uiError && <ErrorBox>{uiError}</ErrorBox>}
            {checkinSuccess && <SuccessBox>{checkinSuccess}</SuccessBox>}
            <ActionButtons>
              {!checkinSuccess && (
                <Button onClick={submitCheckin} disabled={busy || !checkinUser || (pase === "normal" && !userCanCheckin(checkinUser))}>
                  {busy
                    ? "Registrando..."
                    : pase === "dia"
                      ? `✓ Registrar pase · ${pesos(precioDia(paseZapatos))}`
                      : pase === "voluntario"
                        ? "✓ Entrada de voluntario"
                        : "✓ Confirmar Check-in"}
                </Button>
              )}
              <Button $variant="secondary" onClick={() => { setShowCheckinModal(false); setCheckinSuccess(""); setUiError(""); }} disabled={busy}>
                {checkinSuccess ? "Cerrar" : "Cancelar"}
              </Button>
            </ActionButtons>
          </ModalContent>
        </Modal>

        {/* Cortesía Modal — el invitado entra con el pase del socio.
            Paso 1: sus datos. Paso 2: su waiver firmado + check-in. */}
        {showCortesiaModal && cortesiaHost && (() => {
          const st = estadoCortesia(cortesiaHost);
          return (
            <>
              <Overlay $show onClick={() => !busy && closeCortesia()} />
              <Modal $show>
                <ModalContent>
                  <ModalHeader>
                    <ModalTitle>
                      🎟️ {cortesiaStep === 1 ? "Usar cortesía" : "Waiver del invitado"}
                    </ModalTitle>
                  </ModalHeader>

                  <div style={{ fontWeight: 600 }}>{maskName(cortesiaHost.name)}</div>
                  <div style={{ fontSize: fontSize.sm, color: palette.textLight, marginBottom: spacing.md }}>
                    {st.disponible
                      ? `Cortesía disponible${st.vence ? ` · vence ${formatDate(st.vence)}` : ""}`
                      : st.vencida
                        ? "Cortesía vencida"
                        : st.ultimoUso
                          ? `Ya la usó el ${formatDate(st.ultimoUso.ts)} con ${st.ultimoUso.guestName || "un invitado"}`
                          : "Sin cortesía"}
                  </div>

                  {cortesiaSuccess ? (
                    <>
                      <SuccessBox>{cortesiaSuccess}</SuccessBox>
                      <ActionButtons>
                        <Button $variant="secondary" onClick={closeCortesia}>Cerrar</Button>
                      </ActionButtons>
                    </>
                  ) : !st.disponible ? (
                    <>
                      <ErrorBox>
                        {st.vencida
                          ? "⚠️ La cortesía venció con su tiquetera/mensualidad."
                          : "⚠️ Este socio no tiene cortesía disponible."}
                      </ErrorBox>
                      <p style={{ fontSize: fontSize.sm, color: palette.textLight, marginBottom: spacing.md }}>
                        Se renueva sola al renovar la mensualidad o cargar créditos.
                        {can(PERMISOS.CORTESIA_CORREGIR)
                          ? " Si ya compró y no aparece, se la puedes dar a mano."
                          : " Si ya compró y no aparece, pedile a un admin que se la dé a mano."}
                      </p>
                      {uiError && <ErrorBox>{uiError}</ErrorBox>}
                      <ActionButtons>
                        {can(PERMISOS.CORTESIA_CORREGIR) && (
                          <Button onClick={() => setCortesiaManual("otorgar")} disabled={busy}>
                            {busy ? "Guardando..." : "Otorgar cortesía"}
                          </Button>
                        )}
                        <Button $variant="secondary" onClick={closeCortesia} disabled={busy}>Cancelar</Button>
                      </ActionButtons>
                    </>
                  ) : cortesiaStep === 1 ? (
                    <>
                      <p style={{ fontSize: fontSize.sm, color: palette.textLight, marginBottom: spacing.md }}>
                        El invitado queda con su propia ficha, su waiver firmado y su check-in
                        del día. Al confirmar se gasta la cortesía del socio.
                      </p>
                      <Input placeholder="Nombre completo del invitado" value={cortesiaForm.name}
                        onChange={(e) => setCortesiaForm(s => ({ ...s, name: e.target.value }))} />
                      <div style={{ display: "flex", gap: spacing.sm }}>
                        <Select value={cortesiaForm.documentType} style={{ width: "80px" }}
                          onChange={(e) => setCortesiaForm(s => ({ ...s, documentType: e.target.value }))}>
                          {["CC", "CE", "TI", "PP", "NIT", "OTRO"].map(t => <option key={t} value={t}>{t}</option>)}
                        </Select>
                        <Input placeholder="Número Documento" value={cortesiaForm.documentNumber} style={{ flex: 1 }}
                          onChange={(e) => setCortesiaForm(s => ({ ...s, documentNumber: e.target.value }))} />
                      </div>
                      <Input placeholder="Teléfono" value={cortesiaForm.phone}
                        onChange={(e) => setCortesiaForm(s => ({ ...s, phone: e.target.value }))} />
                      <Input placeholder="EPS (opcional)" value={cortesiaForm.epsName}
                        onChange={(e) => setCortesiaForm(s => ({ ...s, epsName: e.target.value }))} />
                      <Input placeholder="Contacto Emergencia (Nombre)" value={cortesiaForm.emergencyContactName}
                        onChange={(e) => setCortesiaForm(s => ({ ...s, emergencyContactName: e.target.value }))} />
                      <Input placeholder="Contacto Emergencia (Teléfono)" value={cortesiaForm.emergencyContactPhone}
                        onChange={(e) => setCortesiaForm(s => ({ ...s, emergencyContactPhone: e.target.value }))} />
                      <RadioRow>
                        <label><input type="radio" checked={!cortesiaForm.esMinor}
                          onChange={() => setCortesiaForm(s => ({ ...s, esMinor: false }))} /> Mayor de edad</label>
                        <label><input type="radio" checked={cortesiaForm.esMinor}
                          onChange={() => setCortesiaForm(s => ({ ...s, esMinor: true }))} /> Menor de edad</label>
                      </RadioRow>
                      {uiError && <ErrorBox>{uiError}</ErrorBox>}
                      <ActionButtons>
                        <Button onClick={cortesiaNextStep} disabled={busy}>Continuar</Button>
                        <Button $variant="secondary" onClick={closeCortesia} disabled={busy}>Cancelar</Button>
                      </ActionButtons>
                      {/* Escape hatch: cortesía otorgada por error (ajuste de
                          créditos que era corrección, socio equivocado, etc.) */}
                      {can(PERMISOS.CORTESIA_CORREGIR) && (
                        <div style={{ marginTop: spacing.md, textAlign: "center" }}>
                          <Button $variant="secondary" $small onClick={() => setCortesiaManual("quitar")} disabled={busy}>
                            {busy ? "Quitando..." : "Quitar esta cortesía"}
                          </Button>
                        </div>
                      )}
                    </>
                  ) : (
                    <>
                      <WaiverBox>
                        {waiverToParagraphs(waiverSnapshotGuest.text).map((p, idx) => (
                          <p key={idx} style={{ marginBottom: spacing.md }}>{p}</p>
                        ))}
                      </WaiverBox>
                      <CheckboxRow>
                        <input type="checkbox" checked={waiverAccepted}
                          onChange={(e) => setWaiverAccepted(e.target.checked)} />
                        <span>
                          {cortesiaForm.esMinor
                            ? "Acepto el consentimiento como representante legal del menor"
                            : "Acepto el consentimiento"}
                        </span>
                      </CheckboxRow>
                      <SigCanvas ref={canvasRef} onMouseDown={startDraw} onMouseMove={moveDraw} onMouseUp={endDraw}
                        onMouseLeave={endDraw} onTouchStart={startDraw} onTouchMove={moveDraw} onTouchEnd={endDraw} />
                      <SigRow>
                        <span style={{ fontSize: fontSize.sm, color: palette.textLight }}>
                          Firmando como: <strong>
                            {cortesiaForm.esMinor
                              ? `Representante legal de ${cortesiaForm.name || "—"}`
                              : cortesiaForm.name || "—"}
                          </strong>
                        </span>
                        <Button $variant="secondary" $small type="button"
                          onClick={() => { setUiError(""); clearSignature(); }}>Limpiar</Button>
                      </SigRow>
                      {uiError && <ErrorBox>{uiError}</ErrorBox>}
                      <ActionButtons>
                        <Button onClick={submitCortesia} disabled={busy}>
                          {busy ? "Registrando..." : "✓ Firmar y hacer check-in"}
                        </Button>
                        <Button $variant="secondary" onClick={() => setCortesiaStep(1)} disabled={busy}>Atrás</Button>
                      </ActionButtons>
                    </>
                  )}
                </ModalContent>
              </Modal>
            </>
          );
        })()}

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
            <CheckboxRow>
              <input type="checkbox" checked={renovarZapatos} onChange={(e) => setRenovarZapatos(e.target.checked)} />
              <span>Con pies de gato incluidos</span>
            </CheckboxRow>
            <div style={{ fontWeight: 600, marginBottom: spacing.md }}>
              Total a cobrar: {pesos(precioMensualidad(renovarMonths, renovarZapatos))}
            </div>
            {uiError && <ErrorBox>{uiError}</ErrorBox>}
            <ActionButtons>
              <Button onClick={submitRenovar} disabled={busy}>{busy ? "Renovando..." : "Confirmar"}</Button>
              <Button $variant="secondary" onClick={() => setShowRenovarModal(false)} disabled={busy}>Cancelar</Button>
            </ActionButtons>
          </ModalContent>
        </Modal>

        <InventarioModal
          open={showInventario}
          onClose={() => setShowInventario(false)}
          puedeGestionar={can(PERMISOS.INVENTARIO_GESTIONAR)}
          onAuditEvent={appendAuditEvent}
        />

        {/* Voluntarios: otorgar y cortar turnos de mostrador (solo admin) */}
        <Overlay $show={showStaffModal} onClick={() => !busy && setShowStaffModal(false)} />
        <Modal $show={showStaffModal}>
          <ModalContent>
            <ModalHeader>
              <ModalTitle>🧑‍🤝‍🧑 Voluntarios</ModalTitle>
            </ModalHeader>

            <p style={{ fontSize: fontSize.sm, color: palette.textLight, marginBottom: spacing.md }}>
              El turno vence solo al final del día (11:59 pm). No hay que acordarse de
              quitarlo. Un voluntario <strong>permanente</strong> entra todos los días hasta que
              lo quites de la lista. Puede hacer check-in, vender tiqueteras y renovar
              mensualidades; no ve datos personales, ni la auditoría, ni puede borrar o exportar.
            </p>

            <Input
              type="email"
              placeholder="Email de Google del voluntario"
              value={staffEmail}
              onChange={(e) => setStaffEmail(e.target.value)}
            />
            <Input
              placeholder="Nombre (opcional, para reconocerlo en la lista)"
              value={staffName}
              onChange={(e) => setStaffName(e.target.value)}
            />
            <CheckboxRow>
              <input type="checkbox" checked={staffPermanente} onChange={(e) => setStaffPermanente(e.target.checked)} />
              <span>Permanente (sin vencimiento)</span>
            </CheckboxRow>
            {staffMsg && (staffOk ? <SuccessBox>{staffMsg}</SuccessBox> : <ErrorBox>{staffMsg}</ErrorBox>)}
            <ActionButtons>
              <Button onClick={otorgarTurno} disabled={busy}>
                {busy ? "Guardando..." : staffPermanente ? "Agregar permanente" : "Dar turno de hoy"}
              </Button>
              <Button $variant="secondary" onClick={() => setShowStaffModal(false)} disabled={busy}>
                Cerrar
              </Button>
            </ActionButtons>

            <div style={{ marginTop: spacing.lg }}>
              <div style={{ fontWeight: 600, marginBottom: spacing.sm }}>
                Voluntarios permanentes ({staffPermanentes.length})
              </div>
              {staffLoading ? (
                <div style={{ color: palette.textLight, fontSize: fontSize.sm }}>Cargando...</div>
              ) : staffPermanentes.length === 0 ? (
                <div style={{ color: palette.textLight, fontSize: fontSize.sm }}>
                  Todavía no hay voluntarios permanentes.
                </div>
              ) : (
                staffPermanentes.map((v) => (
                  <div
                    key={v._id}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      gap: spacing.sm,
                      padding: `${spacing.sm} 0`,
                      borderBottom: `1px solid ${palette.border}`,
                    }}
                  >
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontWeight: 500, overflowWrap: "anywhere" }}>{v.name || v.email}</div>
                      <div style={{ fontSize: fontSize.sm, color: palette.textLight }}>
                        {v.name ? `${v.email} · ` : ""}
                        desde {formatDate(v.agregadoEn)}
                        {v.agregadoPor ? ` · lo agregó ${v.agregadoPor}` : ""}
                      </div>
                    </div>
                    <Button $variant="danger" $small onClick={() => quitarPermanente(v)} disabled={busy}>
                      Quitar
                    </Button>
                  </div>
                ))
              )}
            </div>

            <div style={{ marginTop: spacing.lg }}>
              <div style={{ fontWeight: 600, marginBottom: spacing.sm }}>Turnos recientes</div>
              {staffLoading ? (
                <div style={{ color: palette.textLight, fontSize: fontSize.sm }}>Cargando...</div>
              ) : staffTurnos.length === 0 ? (
                <div style={{ color: palette.textLight, fontSize: fontSize.sm }}>
                  Todavía no le has dado turno a nadie.
                </div>
              ) : (
                staffTurnos.map((t) => (
                  <div
                    key={t._id}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      gap: spacing.sm,
                      padding: `${spacing.sm} 0`,
                      borderBottom: `1px solid ${palette.border}`,
                    }}
                  >
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontWeight: 500, overflowWrap: "anywhere" }}>
                        {t.name || t.email}
                      </div>
                      <div style={{ fontSize: fontSize.sm, color: palette.textLight }}>
                        {t.name ? `${t.email} · ` : ""}
                        {formatDateTime(t.vence)}
                        {t.otorgadoPor ? ` · lo dio ${t.otorgadoPor}` : ""}
                      </div>
                    </div>
                    <div style={{ display: "flex", gap: spacing.xs, alignItems: "center" }}>
                      <Badge
                        $success={t.estado === "vigente"}
                        $danger={t.estado === "revocado"}
                      >
                        {t.estado}
                      </Badge>
                      {t.estado === "vigente" && (
                        <Button $variant="danger" $small onClick={() => revocarTurno(t)} disabled={busy}>
                          Cortar
                        </Button>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
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
                    <CheckboxRow>
                      <input type="checkbox" checked={accessZapatos} onChange={(e) => setAccessZapatos(e.target.checked)} />
                      <span>Con pies de gato incluidos</span>
                    </CheckboxRow>
                    <div style={{ fontWeight: 600, marginBottom: spacing.md }}>
                      Total a cobrar: {pesos(precioMensualidad(accessMonthsDraft, accessZapatos))}
                    </div>
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
                    {/* El campo FIJA el saldo; se cobra solo lo que queda por encima de lo que ya tenía. */}
                    {Number(accessCreditsDraft) > (accessUser.credits ?? 0) && (
                      <div style={{ fontWeight: 600, marginBottom: spacing.md }}>
                        Total a cobrar: {pesos(precioTiquetera(Number(accessCreditsDraft) - (accessUser.credits ?? 0)))}
                      </div>
                    )}
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
                      <div style={{ fontSize: fontSize.sm, fontWeight: 600, marginBottom: spacing.xs }}>Email</div>
                      <Input
                        type="email"
                        value={editForm.email}
                        onChange={(e) => setEditForm(s => ({ ...s, email: e.target.value }))}
                        placeholder="email real de Google"
                      />
                      {String(editForm.email || "").endsWith("@crashpath.local") && (
                        <div style={{ fontSize: fontSize.sm, color: palette.textLight, marginTop: spacing.xs }}>
                          ⚠️ Email temporal — pon el email real de Google para que esta persona
                          pueda iniciar sesión y conectar con esta cuenta.
                        </div>
                      )}
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
                        {v.createdBy === "user" ? "Auto-registro" : v.createdBy === "staff" ? "Registrado por voluntario" : "Registrado por admin"}
                        {v.esCortesia && ` · 🎟️ cortesía de ${v.cortesiaHostName || "un socio"}`}
                        {v.esPaseDia && ` · pase de día ${v.conZapatos ? "con" : "sin"} zapatos${v.monto ? ` (${pesos(v.monto)})` : ""}`}
                        {v.esVoluntario && " · voluntario (gratis)"}
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

        {/* Editor de fechas — tiquetera o mensualidad según datesMode */}
        <Overlay $show={showTiqueteraModal} onClick={() => !busy && setShowTiqueteraModal(false)} />
        <Modal $show={showTiqueteraModal}>
          <ModalContent>
            <ModalHeader>
              <ModalTitle>
                {datesMode === "mensualidad" ? "Fechas de mensualidad" : "Fechas de tiquetera"}
              </ModalTitle>
            </ModalHeader>
            {tiqueteraUser && (
              <>
                <div style={{ fontWeight: 600 }}>{maskName(tiqueteraUser.name) || "Sin nombre"}</div>
                <div style={{ fontSize: fontSize.sm, color: palette.textLight, marginBottom: spacing.md }}>
                  {maskEmail(tiqueteraUser.email)}
                  {datesMode === "mensualidad"
                    ? ` · ${getMensualidadStatus(tiqueteraUser.mensualidad).label}`
                    : ` · ${tiqueteraUser.credits ?? 0} créditos`}
                </div>
                {datesMode === "mensualidad" && (
                  <div
                    style={{
                      fontSize: fontSize.sm,
                      color: palette.textLight,
                      marginBottom: spacing.md,
                    }}
                  >
                    Corrección manual. Para registrar una venta o renovación usa{" "}
                    <strong>Renovar</strong>.
                  </div>
                )}
                <div style={{ marginBottom: spacing.md }}>
                  <div style={{ fontWeight: 600, marginBottom: spacing.xs }}>
                    {datesMode === "mensualidad" ? "Inicio de vigencia" : "Fecha de compra"}
                  </div>
                  <Input
                    type="date"
                    value={tiqueteraStart}
                    onChange={(e) => setTiqueteraStart(e.target.value)}
                  />
                </div>
                <div style={{ marginBottom: spacing.md }}>
                  <div style={{ fontWeight: 600, marginBottom: spacing.xs }}>Vence</div>
                  <Input
                    type="date"
                    value={tiqueteraEnd}
                    onChange={(e) => setTiqueteraEnd(e.target.value)}
                  />
                  <div style={{ display: "flex", gap: spacing.sm, marginTop: spacing.sm, flexWrap: "wrap" }}>
                    {datesMode === "mensualidad" ? (
                      <>
                        <Button
                          $variant="secondary"
                          $small
                          onClick={() =>
                            setTiqueteraEnd(addMonthsToDay(tiqueteraStart || todayBogotaDay(), 1))
                          }
                        >
                          +1 mes
                        </Button>
                        <Button
                          $variant="secondary"
                          $small
                          onClick={() =>
                            setTiqueteraEnd(addMonthsToDay(tiqueteraStart || todayBogotaDay(), 3))
                          }
                        >
                          +3 meses
                        </Button>
                      </>
                    ) : (
                      <>
                        <Button
                          $variant="secondary"
                          $small
                          onClick={() => {
                            const base = tiqueteraStart ? new Date(`${tiqueteraStart}T12:00:00`) : new Date();
                            setTiqueteraEnd(new Date(base.getTime() + 60 * 86400000).toISOString().slice(0, 10));
                          }}
                        >
                          +60 días
                        </Button>
                        <Button
                          $variant="secondary"
                          $small
                          onClick={() => {
                            const base = tiqueteraStart ? new Date(`${tiqueteraStart}T12:00:00`) : new Date();
                            setTiqueteraEnd(new Date(base.getTime() + 90 * 86400000).toISOString().slice(0, 10));
                          }}
                        >
                          +90 días
                        </Button>
                      </>
                    )}
                  </div>
                  {datesMode === "mensualidad" && (() => {
                    const hint = mensualidadDayHint(tiqueteraEnd);
                    if (!hint) return null;
                    return (
                      <div
                        style={{
                          marginTop: spacing.sm,
                          fontSize: fontSize.sm,
                          fontWeight: 600,
                          color: hint.ok ? palette.success : palette.danger,
                        }}
                      >
                        {hint.text}
                      </div>
                    );
                  })()}
                </div>
                {uiError && <ErrorBox>{uiError}</ErrorBox>}
                <ActionButtons>
                  <Button onClick={submitTiqueteraDates} disabled={busy}>
                    {busy ? "Guardando..." : "Guardar"}
                  </Button>
                  <Button $variant="secondary" onClick={() => setShowTiqueteraModal(false)} disabled={busy}>
                    Cancelar
                  </Button>
                </ActionButtons>
              </>
            )}
          </ModalContent>
        </Modal>

        {/* Import Excel Modal (preview antibobos) */}
        <Overlay $show={showImportModal} onClick={closeImportModal} />
        <Modal $show={showImportModal}>
          <ModalContent>
            <ModalHeader>
              <ModalTitle>Importar Excel — vista previa</ModalTitle>
            </ModalHeader>

            {importResult ? (
              <>
                <div style={{ fontWeight: 600, marginBottom: spacing.md }}>
                  ✅ {importResult.updated?.length || 0} actualizados
                  {importResult.created?.length > 0 && ` · 🆕 ${importResult.created.length} creados`}
                </div>
                {importResult.created?.length > 0 && (
                  <div style={{ fontSize: fontSize.sm, color: palette.textLight, marginBottom: spacing.md }}>
                    Los creados quedaron con email temporal, waiver pendiente y perfil
                    incompleto. Cuando cada persona vuelva: Perfil → ✏️ editar (email real
                    de Google + datos) y firmar el waiver.
                  </div>
                )}
                {importResult.failed?.length > 0 && (
                  <ErrorBox style={{ marginBottom: spacing.md }}>
                    ⚠️ {importResult.failed.length} fila(s) fallaron:
                    <ul style={{ margin: `${spacing.xs} 0 0`, paddingLeft: 18 }}>
                      {importResult.failed.map((f, i) => (
                        <li key={i}>{f.excelName || f.userId}: {f.error}</li>
                      ))}
                    </ul>
                  </ErrorBox>
                )}
                <ActionButtons>
                  <Button onClick={closeImportModal}>Cerrar</Button>
                </ActionButtons>
              </>
            ) : importPreview ? (
              <>
                <div style={{ display: "flex", gap: spacing.sm, flexWrap: "wrap", marginBottom: spacing.md }}>
                  <Badge $success>{importPreview.summary.exact} exactos</Badge>
                  <Badge>{importPreview.summary.fuzzy} por revisar</Badge>
                  <Badge $danger>{importPreview.summary.ambiguous} ambiguos</Badge>
                  <Badge>{importPreview.summary.none} nuevos por crear</Badge>
                </div>
                <div style={{ fontSize: fontSize.sm, color: palette.textLight, marginBottom: spacing.md }}>
                  Nada se guarda hasta que confirmes. Los "≈ revisar" vienen desmarcados:
                  márcalos solo si el emparejamiento es correcto. Los "🆕 se creará" entran
                  como usuarios nuevos con email temporal, waiver pendiente y perfil
                  incompleto — se completan cuando la persona vuelva.
                </div>

                <div style={{ maxHeight: "380px", overflowY: "auto", border: `1px solid ${palette.border}`, borderRadius: borderRadius.sm }}>
                  {importPreview.rows.map((r) => (
                    <div
                      key={r.id}
                      style={{
                        display: "flex",
                        gap: spacing.sm,
                        alignItems: "flex-start",
                        padding: spacing.sm,
                        borderBottom: `1px solid ${palette.border}`,
                        opacity: r.matchType === "ambiguous" ? 0.65 : 1,
                      }}
                    >
                      <input
                        type="checkbox"
                        style={{ marginTop: 3 }}
                        disabled={r.matchType === "ambiguous" || importBusy}
                        checked={importSelected.has(r.id)}
                        onChange={() => toggleImportRow(r.id)}
                      />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: "flex", gap: spacing.sm, flexWrap: "wrap", alignItems: "center" }}>
                          <span style={{ fontWeight: 600 }}>{maskName(r.excelName)}</span>
                          {importChip(r.matchType)}
                          <Badge>{r.sheet === "mensualidades" ? "Mensualidad" : "Tiquetera"}</Badge>
                        </div>
                        {r.user && (
                          <div style={{ fontSize: fontSize.sm, color: palette.textLight, marginTop: 2 }}>
                            → {maskName(r.user.name)} ({maskEmail(r.user.email)})
                          </div>
                        )}
                        {r.matchType === "ambiguous" && r.candidates?.length > 0 && (
                          <div style={{ fontSize: fontSize.sm, color: palette.textLight, marginTop: 2 }}>
                            Candidatos: {r.candidates.map((c) => maskName(c.name)).join(", ")} — resuélvelo a mano.
                          </div>
                        )}
                        {r.matchType === "none" && (
                          <div style={{ fontSize: fontSize.sm, color: palette.textLight, marginTop: 2 }}>
                            🆕 Se creará: {describeImportProposed(r)} · email temporal,
                            waiver y datos pendientes (completar cuando vuelva).
                          </div>
                        )}
                        {r.user && (
                          <div style={{ fontSize: fontSize.sm, marginTop: 2 }}>
                            {describeImportCurrent(r)} <strong>→</strong> {describeImportProposed(r)}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                {importPreview.omitted?.length > 0 && (
                  <div style={{ fontSize: fontSize.sm, color: palette.textLight, marginTop: spacing.md }}>
                    Filas omitidas (dato más viejo en la otra hoja):{" "}
                    {importPreview.omitted.map((o) => maskName(o.nombre)).join(", ")}
                  </div>
                )}

                <ActionButtons>
                  <Button
                    onClick={applyImport}
                    disabled={
                      importBusy ||
                      [...importSelected].filter((id) =>
                        importPreview.rows.find((r) => r.id === id && (r.user || r.matchType === "none"))
                      ).length === 0
                    }
                  >
                    {importBusy
                      ? "Aplicando..."
                      : `Aplicar ${[...importSelected].length} cambio(s)`}
                  </Button>
                  <Button $variant="secondary" onClick={closeImportModal} disabled={importBusy}>
                    Cancelar
                  </Button>
                </ActionButtons>
              </>
            ) : null}
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
                      <option value="dia">Pase de día</option>
                    </Select>
                    {newUserForm.accessType === "dia" && (
                      <div style={{ display: "flex", gap: spacing.md, flexWrap: "wrap", marginBottom: spacing.md }}>
                        <label style={{ display: "flex", gap: spacing.xs, alignItems: "center" }}>
                          <input type="radio" name="nuevoZapatos" checked={!newUserForm.zapatos} onChange={() => setNewUserForm(s => ({ ...s, zapatos: false }))} />
                          Sin zapatos · {pesos(PRECIOS.DIA)}
                        </label>
                        <label style={{ display: "flex", gap: spacing.xs, alignItems: "center" }}>
                          <input type="radio" name="nuevoZapatos" checked={!!newUserForm.zapatos} onChange={() => setNewUserForm(s => ({ ...s, zapatos: true }))} />
                          Con zapatos · {pesos(PRECIOS.DIA_ZAPATOS)}
                        </label>
                      </div>
                    )}
                    {newUserForm.accessType === "mensualidad" && (
                      <Select value={newUserForm.mensualidadMeses} onChange={(e) => setNewUserForm(s => ({ ...s, mensualidadMeses: Number(e.target.value) }))}>
                        {[1, 2, 3, 6, 12].map(m => <option key={m} value={m}>{m} {m === 1 ? "mes" : "meses"}</option>)}
                      </Select>
                    )}
                    {newUserForm.accessType === "mensualidad" && (
                      <CheckboxRow>
                        <input type="checkbox" checked={!!newUserForm.zapatos} onChange={(e) => setNewUserForm(s => ({ ...s, zapatos: e.target.checked }))} />
                        <span>Con pies de gato · total {pesos(precioMensualidad(newUserForm.mensualidadMeses, !!newUserForm.zapatos))}</span>
                      </CheckboxRow>
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
                      <Button onClick={submitNewUserWaiver} disabled={busy}>
                        {busy
                          ? "Guardando..."
                          : newUserForm.accessType === "dia"
                            ? `Crear y registrar pase · ${pesos(precioDia(!!newUserForm.zapatos))}`
                            : "Crear miembro"}
                      </Button>
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

        {/* Aviso: devolver el teléfono al staff tras firmar el waiver */}
        <Overlay $show={showEntregaTelefono} />
        <Modal $show={showEntregaTelefono} style={{ maxWidth: "420px" }}>
          <ModalContent style={{ textAlign: "center" }}>
            <ModalHeader>
              <ModalTitle>📱 Entrega el teléfono al staff</ModalTitle>
            </ModalHeader>
            <p style={{ margin: `${spacing.md} 0` }}>
              ¡Listo, waiver firmado! Por favor devuélvele el teléfono al staff.
            </p>
            <ActionButtons>
              <Button onClick={() => setShowEntregaTelefono(false)}>Entendido</Button>
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
                              <Badge $success={!visit?.esPaseDia && !visit?.esVoluntario && !visit?.esCortesia && user.accessType === "mensualidad"}>
                                {visit?.esCortesia
                                  ? "Cortesía"
                                  : visit?.esPaseDia
                                    ? `Día${visit?.conZapatos ? " + zapatos" : ""}`
                                    : visit?.esVoluntario
                                      ? "Vol"
                                      : user.accessType === "mensualidad" ? "Mens" : "Tiq"}
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