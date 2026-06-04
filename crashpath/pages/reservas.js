"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { signIn, signOut, useSession } from "next-auth/react";
import styled from "styled-components";
import axios from "axios";
import { useRouter } from "next/router";
import Link from "next/link";
import { getWaiverSnapshot } from "@/lib/waiver";
import MoonSection from "@/components/MoonSection";

// ============================================
// PALETA SIMPLIFICADA - Solo naranja + azul rey
// ============================================
const colors = {
  // Color principal - Naranja (tu identidad)
  orange: "#9A4A23",
  orangeDark: "#7A3A1C",
  orangeLight: "#FDF1E7",
  
  // Azul rey único (reemplaza todos los azules)
  royalBlue: "#1E3A5F",
  royalBlueLight: "#E8EEF5",
  royalBlueDark: "#142A45",
  
  // Neutros
  white: "#FFFFFF",
  grayLight: "#F5F5F5",
  gray: "#E0E0E0",
  grayDark: "#757575",
  text: "#1A1A1A",
  textLight: "#6B6B6B",
  success: "#2E7D32",
  danger: "#C62828",
};

// ============================================
// COMPONENTES ESTILIZADOS
// ============================================
const Container = styled.main`
  min-height: 100vh;
  display: grid;
  place-items: center;
  padding: 24px 16px;
  
`;

const Card = styled.section`
  width: 100%;
  max-width: 420px;
  text-align: center;
  display: grid;
  gap: 16px;
  background: ${colors.white};
  border-radius: 16px;
  padding: 24px 20px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
`;

const WelcomeRow = styled.h1`
  margin: 0;
  font-size: 16px;
  font-weight: 600;
  letter-spacing: 0.02em;
  color: ${colors.text};
`;

const BrushName = styled.span`
  font-family: var(--font-brush);
  color: ${colors.orange};
  text-transform: none;
`;

const BrushTitle = styled.h2`
  font-family: var(--font-brush);
  font-size: 28px;
  line-height: 1.1;
  margin: 0;
  color: ${colors.orange};
  text-transform: uppercase;
  letter-spacing: 0.02em;
`;

const Body = styled.div`
  color: ${colors.text};
  font-size: 14px;
  line-height: 1.55;
  margin-top: 4px;
  p {
    margin: 0 0 10px;
  }
  strong {
    font-weight: 700;
  }
`;

const SmallNote = styled.p`
  margin: 0;
  font-size: 13px;
  color: ${colors.textLight};
`;

const SectionTitle = styled.p`
  margin: 8px 0 0;
  font-size: 13px;
  color: ${colors.text};
  font-weight: 600;
`;

// Botón principal - Naranja
const PrimaryBtn = styled.button`
  width: 100%;
  border: none;
  border-radius: 8px;
  height: 48px;
  background: ${colors.orange};
  color: ${colors.white};
  font-weight: 700;
  letter-spacing: 0.02em;
  cursor: pointer;
  transition: all 0.2s ease;

  &:hover {
    background: ${colors.orangeDark};
  }
  &:active {
    transform: translateY(1px);
  }
  &:disabled {
    background: ${colors.gray};
    cursor: not-allowed;
  }
`;

// Botón secundario - Azul rey
const SecondaryBtn = styled(PrimaryBtn)`
  background: ${colors.royalBlue};
  
  &:hover {
    background: ${colors.royalBlueDark};
  }
`;

// Botón terciario - Outline
const TertiaryBtn = styled(PrimaryBtn)`
  background: transparent;
  color: ${colors.royalBlue};
  border: 1px solid ${colors.royalBlue};
  
  &:hover {
    background: ${colors.royalBlueLight};
  }
`;

const Logout = styled.button`
  width: 100%;
  max-width: 220px;
  margin: 8px auto 0;
  border: none;
  border-radius: 8px;
  height: 40px;
  background: transparent;
  color: ${colors.textLight};
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;

  &:hover {
    color: ${colors.danger};
  }
`;

const FooterLink = styled(Link)`
  display: inline-block;
  margin-top: 8px;
  font-size: 12px;
  color: ${colors.royalBlue};
  text-decoration: underline;
`;

const ChipRow = styled.div`
  display: flex;
  gap: 8px;
  justify-content: center;
  flex-wrap: wrap;
`;

const Chip = styled.span`
  display: inline-flex;
  align-items: center;
  gap: 6px;
  border-radius: 8px;
  padding: 6px 12px;
  font-size: 12px;
  font-weight: 500;
  border: 1px solid ${colors.gray};
  background: ${colors.white};
  color: ${colors.text};
`;

const Badge = styled.span`
  font-size: 11px;
  padding: 4px 10px;
  border-radius: 6px;
  background: ${(p) => p.$bg || colors.orange};
  color: ${colors.white};
  font-weight: 600;
`;

const PlanBox = styled.div`
  border-radius: 12px;
  padding: 14px;
  text-align: left;
  display: grid;
  gap: 4px;
  border: 1px solid ${(p) => (p.$warn ? colors.orange : colors.royalBlue)};
  background: ${(p) => (p.$warn ? colors.orangeLight : colors.royalBlueLight)};
`;

const PlanTitle = styled.div`
  font-size: 14px;
  font-weight: 700;
  color: ${(p) => (p.$warn ? colors.orange : colors.royalBlue)};
`;

const PlanDetail = styled.div`
  font-size: 12.5px;
  color: ${colors.text};
`;

const PlanLink = styled.a`
  margin-top: 4px;
  font-size: 12.5px;
  font-weight: 600;
  color: ${colors.orange};
  text-decoration: underline;
  cursor: pointer;
`;

const ResList = styled.ul`
  list-style: none;
  padding: 0;
  margin: 8px 0 0;
  display: grid;
  gap: 8px;
`;

const ResItem = styled.li`
  background: ${colors.white};
  border: 1px solid ${colors.gray};
  border-radius: 8px;
  padding: 10px 12px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 10px;
`;

const ResTitle = styled.span`
  font-size: 13.5px;
  color: ${colors.text};
  font-weight: 600;
`;

const ResMeta = styled.span`
  display: block;
  font-size: 12px;
  color: ${colors.textLight};
  margin-top: 2px;
`;

// Modal styles - Manteniendo el gecko!
const ModalOverlay = styled.div`
  position: fixed;
  inset: 0;
  background-color: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 16px;
  z-index: 50;
`;

const FrogCard = styled.div`
  position: relative;
  background: ${colors.white};
  width: 100%;
  max-width: 440px;
  border-radius: 20px;
  padding: 64px 20px 24px;
  box-shadow: 0 12px 28px rgba(0, 0, 0, 0.18);
  text-align: center;
`;

const FrogImg = styled.img`
  position: absolute;
  left: 50%;
  transform: translateX(-50%);
  top: -55px;
  width: 100px;
  height: auto;
`;

const FrogClose = styled.button`
  position: absolute;
  right: 14px;
  top: 12px;
  border: none;
  background: transparent;
  font-size: 24px;
  color: ${colors.textLight};
  cursor: pointer;
  
  &:hover {
    color: ${colors.orange};
  }
`;

const FrogSub = styled.p`
  margin: 0 0 4px;
  font-size: 13px;
  color: ${colors.textLight};
`;

const FrogBrush = styled.h3`
  font-family: var(--font-brush);
  margin: 2px 0 16px;
  font-size: 28px;
  letter-spacing: 0.02em;
  color: ${colors.orange};
  text-transform: uppercase;
`;

const FrogBody = styled.div`
  margin: 0 0 16px;
  font-size: 13.5px;
  line-height: 1.5;
  color: ${colors.text};
  text-align: left;
`;

const FrogRow = styled.div`
  display: flex;
  gap: 12px;
  justify-content: center;
  flex-wrap: wrap;
`;

const ModalBtn = styled.button`
  border: none;
  border-radius: 8px;
  padding: 12px 20px;
  font-weight: 600;
  letter-spacing: 0.02em;
  cursor: pointer;
  transition: all 0.2s ease;
  min-width: 120px;
  
  ${(props) => props.$primary && `
    background: ${colors.orange};
    color: ${colors.white};
    &:hover { background: ${colors.orangeDark}; }
  `}
  
  ${(props) => props.$secondary && `
    background: transparent;
    color: ${colors.text};
    border: 1px solid ${colors.gray};
    &:hover { background: ${colors.grayLight}; }
  `}
`;

const Form = styled.div`
  display: grid;
  gap: 12px;
  margin-top: 12px;
`;

const Field = styled.div`
  display: grid;
  gap: 6px;
  text-align: left;
`;

const Label = styled.label`
  font-size: 12px;
  font-weight: 600;
  color: ${colors.text};
`;

const Input = styled.input`
  height: 44px;
  border-radius: 8px;
  border: 1px solid ${colors.gray};
  padding: 0 12px;
  font-size: 14px;
  outline: none;
  
  &:focus {
    border-color: ${colors.orange};
  }
`;

const Select = styled.select`
  height: 44px;
  border-radius: 8px;
  border: 1px solid ${colors.gray};
  padding: 0 12px;
  font-size: 14px;
  outline: none;
  background: ${colors.white};
  
  &:focus {
    border-color: ${colors.orange};
  }
`;

const Helper = styled.p`
  margin: 0;
  font-size: 12px;
  color: ${colors.textLight};
`;

const WaiverBox = styled.div`
  border: 1px solid ${colors.gray};
  border-radius: 8px;
  padding: 12px;
  background: ${colors.grayLight};
  max-height: 240px;
  overflow: auto;
  font-size: 12px;
  line-height: 1.5;
`;

const CheckboxRow = styled.label`
  display: flex;
  gap: 10px;
  align-items: flex-start;
  text-align: left;
  font-size: 12.5px;
  color: ${colors.text};
  line-height: 1.35;
  margin: 12px 0;
  cursor: pointer;
`;

const SigWrap = styled.div`
  margin-top: 12px;
  text-align: left;
`;

const SigCanvas = styled.canvas`
  width: 100%;
  height: 140px;
  border-radius: 8px;
  border: 1px dashed ${colors.gray};
  background: ${colors.white};
  touch-action: none;
  margin-top: 8px;
`;

const SigRow = styled.div`
  display: flex;
  gap: 10px;
  margin-top: 8px;
  justify-content: space-between;
  align-items: center;
`;

const TinyBtn = styled.button`
  border: none;
  background: ${colors.grayLight};
  border-radius: 6px;
  padding: 8px 12px;
  cursor: pointer;
  font-weight: 600;
  font-size: 12px;
  color: ${colors.text};
  
  &:hover {
    background: ${colors.gray};
  }
`;

const Divider = styled.hr`
  border: none;
  border-top: 1px solid ${colors.gray};
  margin: 8px 0;
`;

// ============================================
// HELPERS (mantener igual)
// ============================================
const WHATSAPP_URL = "https://wa.me/573208608016";

function safeArray(v) {
  return Array.isArray(v) ? v : [];
}

function startOfTodayLocal() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

function endOfTodayLocal() {
  const d = new Date();
  d.setHours(23, 59, 59, 999);
  return d;
}

function formatDateShort(d) {
  try {
    return new Date(d).toLocaleDateString("es-CO");
  } catch {
    return String(d);
  }
}

function visitLabel(v) {
  const status = (v?.status || "").toLowerCase();
  if (status === "checked_in" || status === "checked-in") return "Check-in ✅";
  if (status === "registered") return "Registrada";
  if (status === "no_show" || status === "noshow") return "No-show";
  if (status === "cancelled") return "Cancelada";
  return v?.status || "—";
}

function visitBadgeColor(v) {
  const status = (v?.status || "").toLowerCase();
  if (status === "checked_in" || status === "checked-in") return colors.success;
  if (status === "registered") return colors.orange;
  if (status === "no_show" || status === "noshow") return colors.textLight;
  if (status === "cancelled") return colors.danger;
  return colors.orange;
}

function isProfileComplete(u) {
  const dt = (u?.documentType || "").trim();
  const dn = (u?.documentNumber || "").trim();
  const phone = (u?.phone || "").trim();
  const epsName = (u?.epsName || "").trim();
  const ecn = (u?.emergencyContactName || "").trim();
  const ecp = (u?.emergencyContactPhone || "").trim();
  return !!(dt && dn && phone && epsName && ecn && ecp);
}

function getMensualidadStatus(mensualidad) {
  if (!mensualidad?.endDate)
    return { active: false, label: "Sin mensualidad", days: null };
  const now = new Date();
  const end = new Date(mensualidad.endDate);
  const active = end > now;
  const days = Math.ceil((end - now) / (1000 * 60 * 60 * 24));
  const label = active
    ? `Vence el ${end.toLocaleDateString("es-CO")}`
    : `Venció el ${end.toLocaleDateString("es-CO")}`;
  return { active, label, days };
}

// ============================================
// COMPONENTE PRINCIPAL
// ============================================
export default function Reservas() {
  const { data: session } = useSession();
  const router = useRouter();

  const [userData, setUserData] = useState({
    accessType: "ticketera",
    credits: 0,
    mensualidad: null,
    waiverStatus: "unknown",
    waiverSignedAt: null,
    waiverVersion: null,
    waiverMethod: null,
    visits: [],
    profileStatus: "incomplete",
    documentType: "CC",
    documentNumber: "",
    phone: "",
    epsName: "",
    emergencyContactName: "",
    emergencyContactPhone: "",
    esMinor: false,
    missingFields: [],
  });
  const [showPublicInfoModal, setShowPublicInfoModal] = useState(false);
  const [message, setMessage] = useState("");
  const [isLoadingUser, setIsLoadingUser] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [loaded, setLoaded] = useState(false);

  const [showLoginModal, setShowLoginModal] = useState(false);
  const [showWaiverModal, setShowWaiverModal] = useState(false);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [showConfirmCheckIn, setShowConfirmCheckIn] = useState(false);

  const [waiverAccepted, setWaiverAccepted] = useState(false);
  const canvasRef = useRef(null);
  const drawingRef = useRef(false);
  const hasInkRef = useRef(false);
  const lastPointRef = useRef({ x: 0, y: 0 });
  const infoModalShownRef = useRef(false);

  const [documentType, setDocumentType] = useState("CC");
  const [documentNumber, setDocumentNumber] = useState("");
  const [phone, setPhone] = useState("");
  const [epsName, setEpsName] = useState("");
  const [emergencyContactName, setEmergencyContactName] = useState("");
  const [emergencyContactPhone, setEmergencyContactPhone] = useState("");

  const waiverSigned = userData?.waiverStatus === "signed";
  const profileComplete =
    userData?.profileStatus === "complete" || isProfileComplete(userData);

  const visits = useMemo(() => safeArray(userData?.visits), [userData?.visits]);

  const todaysVisit = useMemo(() => {
    const start = startOfTodayLocal();
    const end = endOfTodayLocal();
    return visits.find((v) => {
      const d = v?.date ? new Date(v.date) : null;
      if (!d || Number.isNaN(d.getTime())) return false;
      if (d < start || d > end) return false;
      const status = (v?.status || "").toLowerCase();
      return status !== "cancelled";
    });
  }, [visits]);

  const accessType = (userData?.accessType || "ticketera").toLowerCase();
  const credits = userData?.credits ?? 0;
  const mensualidadInfo = useMemo(
    () => getMensualidadStatus(userData?.mensualidad),
    [userData?.mensualidad]
  );

  const plan = useMemo(() => {
    if (accessType === "mensualidad") {
      if (!mensualidadInfo.active) {
        return {
          warn: true,
          title: "Mensualidad vencida",
          detail: mensualidadInfo.label,
        };
      }
      if (mensualidadInfo.days != null && mensualidadInfo.days <= 5) {
        return {
          warn: true,
          title: "Mensualidad por vencer",
          detail: `${mensualidadInfo.label} · quedan ${mensualidadInfo.days} día(s)`,
        };
      }
      return {
        warn: false,
        title: "Mensualidad activa",
        detail: mensualidadInfo.label,
      };
    }
    if (credits < 1) {
      return {
        warn: true,
        title: "No tienes créditos",
        detail: "Escríbenos para recargar tu tiquetera.",
      };
    }
    return {
      warn: false,
      title: `Tienes ${credits} crédito(s)`,
      detail: "Disponibles para entrenar.",
    };
  }, [accessType, credits, mensualidadInfo]);

  const canCheckIn = useMemo(() => {
    if (!session) return false;
    if (!waiverSigned) return false;
    if (!profileComplete) return false;
    if (todaysVisit) return false;
    return true;
  }, [session, waiverSigned, profileComplete, todaysVisit]);

  async function refreshUser({ autoOpenGates = false } = {}) {
    if (!session) return;
    setIsLoadingUser(true);
    setMessage("");
    try {
      const res = await axios.get("/api/user");
      const u = res.data || {};

      setUserData((prev) => ({
        ...prev,
        ...u,
        accessType: u?.accessType || prev.accessType || "ticketera",
        credits: typeof u?.credits === "number" ? u.credits : prev.credits,
        mensualidad: u?.mensualidad ?? prev.mensualidad,
        visits: safeArray(u?.visits),
        waiverStatus: u?.waiverStatus || prev.waiverStatus,
        profileStatus: u?.profileStatus || prev.profileStatus,
      }));
      setLoaded(true);

      setDocumentType(u?.documentType || "CC");
      setDocumentNumber(u?.documentNumber || "");
      setPhone(u?.phone || "");
      setEpsName(u?.epsName || "");
      setEmergencyContactName(u?.emergencyContactName || "");
      setEmergencyContactPhone(u?.emergencyContactPhone || "");

      if (autoOpenGates) {
        if (u?.waiverStatus !== "signed") {
          setShowWaiverModal(true);
        } else if (!(u?.profileStatus === "complete" || isProfileComplete(u))) {
          setShowProfileModal(true);
        }
      }
    } catch (e) {
      setMessage(e?.response?.data?.message || "No pude cargar tu usuario.");
    } finally {
      setIsLoadingUser(false);
    }
  }

  useEffect(() => {
    if (!session) return;

    if (session.isAdmin) {
      router.push("/admin");
      return;
    }

    refreshUser({ autoOpenGates: true });
  }, [session, router]);

  useEffect(() => {
    if (infoModalShownRef.current) return;
    if (session?.isAdmin) return;
    if (showWaiverModal || showProfileModal) return;
    if (session && (!waiverSigned || !profileComplete)) return;

    infoModalShownRef.current = true;
    setShowPublicInfoModal(true);
  }, [session, showWaiverModal, showProfileModal, waiverSigned, profileComplete]);

  // Canvas signature functions
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
    ctx.strokeStyle = colors.text;
  }

  useEffect(() => {
    if (showWaiverModal) {
      setTimeout(() => {
        resizeCanvasToDevicePixels();
        clearSignature();
      }, 0);
    }
  }, [showWaiverModal]);

  function getLocalPos(e) {
    const c = canvasRef.current;
    if (!c) return { x: 0, y: 0 };
    const rect = c.getBoundingClientRect();

    if (e?.clientX != null)
      return { x: e.clientX - rect.left, y: e.clientY - rect.top };
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

  const handleOpenWaiver = () => setShowWaiverModal(true);

  const waiverCityLine = useMemo(() => {
    return `Bucaramanga, Santander — ${new Date().toLocaleDateString("es-CO")}`;
  }, []);

  const waiverSnapshot = useMemo(() => {
    return getWaiverSnapshot({
      cityLine: waiverCityLine,
      isMinor: !!userData?.esMinor,
      participantName: session?.user?.name || "",
    });
  }, [waiverCityLine, userData?.esMinor, session?.user?.name]);

  const handleSignWaiver = async () => {
    if (isSubmitting) return;

    if (!waiverAccepted) {
      setMessage("Debes marcar el checkbox de aceptación.");
      return;
    }
    if (!hasInkRef.current) {
      setMessage("Debes firmar en el recuadro.");
      return;
    }

    setIsSubmitting(true);
    setMessage("");

    try {
      const signatureImageUrl = exportSignatureDataUrl();
      const { text: waiverTextSnapshot, version } = waiverSnapshot;

      await axios.post("/api/waiver/sign", {
        version,
        method: "signature",
        waiverTextSnapshot,
        signatureImageUrl,
        signatureText: session?.user?.name || "",
        esMinor: !!userData?.esMinor,
      });

      setShowWaiverModal(false);
      setWaiverAccepted(false);
      clearSignature();

      await refreshUser({ autoOpenGates: true });
      setMessage("✅ Waiver firmado. Ahora completa tus datos y listo.");
    } catch (e) {
      setMessage(e?.response?.data?.message || "Error firmando el waiver.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const openProfile = () => setShowProfileModal(true);

  const handleSaveProfile = async () => {
    if (isSubmitting) return;

    const dt = (documentType || "").trim().toUpperCase();
    const dn = (documentNumber || "").trim();
    const p = (phone || "").trim();
    const eps = (epsName || "").trim();
    const ecn = (emergencyContactName || "").trim();
    const ecp = (emergencyContactPhone || "").trim();

    if (!dt || !dn || !p || !eps || !ecn || !ecp) {
      setMessage(
        "Completa: tipo y número de documento, teléfono, EPS y datos de emergencia."
      );
      return;
    }

    setIsSubmitting(true);
    setMessage("");
    try {
      await axios.post("/api/profile/update", {
        documentType: dt,
        documentNumber: dn,
        phone: p,
        epsName: eps,
        emergencyContactName: ecn,
        emergencyContactPhone: ecp,
      });
      setShowProfileModal(false);
      await refreshUser();
      setMessage("✅ Datos guardados. Ya puedes registrar tu check-in.");
    } catch (e) {
      setMessage(e?.response?.data?.message || "Error guardando tu perfil.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCheckIn = async () => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    setMessage("");
    try {
      const res = await axios.post("/api/visits/register", {});
      await refreshUser();
      setMessage(res?.data?.message || "✅ Check-in registrado");
      setShowConfirmCheckIn(false);
    } catch (e) {
      const code = e?.response?.data?.code;
      const msg = e?.response?.data?.message || "Error registrando check-in.";

      if (code === "WAIVER_REQUIRED") {
        setMessage("⚠️ Debes firmar el waiver antes de hacer check-in.");
        setShowConfirmCheckIn(false);
        setShowWaiverModal(true);
      } else if (code === "PROFILE_INCOMPLETE") {
        setMessage("⚠️ Completa tus datos antes de hacer check-in.");
        setShowConfirmCheckIn(false);
        setShowProfileModal(true);
      } else if (code === "VISIT_ALREADY_EXISTS") {
        setMessage("ℹ️ Ya hiciste check-in hoy.");
      } else {
        setMessage(msg);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const topStatus = useMemo(() => {
    if (!session) return null;
    if (isLoadingUser) return { label: "Cargando…", bg: colors.grayDark };
    if (!waiverSigned) return { label: "Waiver pendiente", bg: colors.danger };
    if (!profileComplete) return { label: "Perfil incompleto", bg: colors.danger };
    if (todaysVisit)
      return {
        label: `Hoy: ${visitLabel(todaysVisit)}`,
        bg: visitBadgeColor(todaysVisit),
      };
    return { label: "Hoy: sin check-in", bg: colors.grayDark };
  }, [session, isLoadingUser, waiverSigned, profileComplete, todaysVisit]);

  const lastVisits = useMemo(() => {
    const sorted = [...visits].sort((a, b) => {
      const da = a?.date ? new Date(a.date).getTime() : 0;
      const db = b?.date ? new Date(b.date).getTime() : 0;
      return db - da;
    });
    return sorted.slice(0, 6);
  }, [visits]);

  const gateText = useMemo(() => {
    if (!session) return "";
    if (!waiverSigned) return "Primero firma el waiver (checkbox + firma).";
    if (!profileComplete)
      return "Luego completa tus datos (documento + EPS + emergencia + teléfono).";
    return "Listo: marca tu check-in y reserva la MoonBoard si la vas a usar.";
  }, [session, waiverSigned, profileComplete]);

  const checkInButtonTitle = useMemo(() => {
    if (todaysVisit) return "Ya hiciste check-in hoy";
    if (!waiverSigned) return "Debes firmar el waiver";
    if (!profileComplete) return "Completa tus datos";
    return "";
  }, [todaysVisit, waiverSigned, profileComplete]);

  const checkInButtonText = useMemo(() => {
    if (todaysVisit) return "CHECK-IN DE HOY YA REGISTRADO";
    return "REGISTRAR CHECK-IN";
  }, [todaysVisit]);

  const handleSignIn = () => setShowLoginModal(true);
  const handleAcceptLogin = () => {
    setShowLoginModal(false);
    signIn("google");
  };
  const handleRejectLogin = () => setShowLoginModal(false);

  return (
    <Container>
      {!session ? (
        <Card>
          <WelcomeRow>Bienvenid@ a</WelcomeRow>
          <BrushTitle>CrashPath</BrushTitle>

          <Body>
            <p>
              <strong>CrashPath</strong> es un gimnasio de escalada y
              entrenamiento en Bucaramanga.
            </p>
            <p>
              Inicia sesión con Google para: <strong>firmar el waiver</strong>,
              completar tus <strong>datos de emergencia</strong> y reservar la
              MoonBoard.
            </p>
            <p>
              Horario: <strong>3:00 PM – 9:00 PM</strong>. Mañanas: coordinación
              por WhatsApp.
            </p>
            <SmallNote>
              Login con Google = fácil para ti y fácil para nosotros 😄
            </SmallNote>
          </Body>

          <PrimaryBtn onClick={handleSignIn}>
            INICIA SESIÓN CON GOOGLE
          </PrimaryBtn>
          <SecondaryBtn
            as="a"
            href={WHATSAPP_URL}
            target="_blank"
            rel="noopener noreferrer"
          >
            WHATSAPP (MAÑANAS)
          </SecondaryBtn>

          <FooterLink href="/privacy">
            Conoce nuestra política de privacidad
          </FooterLink>
        </Card>
      ) : (
        <Card>
          <WelcomeRow>
            Bienvenid@, <BrushName>{session.user?.name}</BrushName>
          </WelcomeRow>

          {loaded && (
            <PlanBox $warn={plan.warn}>
              <PlanTitle $warn={plan.warn}>{plan.title}</PlanTitle>
              <PlanDetail>{plan.detail}</PlanDetail>
              {plan.warn && (
                <PlanLink
                  href={WHATSAPP_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Recargar / renovar por WhatsApp →
                </PlanLink>
              )}
            </PlanBox>
          )}

          <ChipRow>
            {topStatus && (
              <Chip>
                <Badge $bg={topStatus.bg}>{topStatus.label}</Badge>
              </Chip>
            )}
            <Chip>
              <span>Horario:</span>
              <strong>3pm–9pm</strong>
            </Chip>
            <Chip>
              <span>Mañanas:</span>
              <a
                href={WHATSAPP_URL}
                target="_blank"
                rel="noopener noreferrer"
                style={{ textDecoration: "underline", fontWeight: 600 }}
              >
                WhatsApp
              </a>
            </Chip>
          </ChipRow>

          <Body>
            <p>{gateText}</p>
          </Body>

          {!waiverSigned ? (
            <>
              <PrimaryBtn
                onClick={handleOpenWaiver}
                disabled={isSubmitting || isLoadingUser}
              >
                ABRIR WAIVER Y FIRMAR
              </PrimaryBtn>
              <TertiaryBtn
                as="a"
                href={WHATSAPP_URL}
                target="_blank"
                rel="noopener noreferrer"
              >
                ¿Dudas? Escríbenos
              </TertiaryBtn>
            </>
          ) : !profileComplete ? (
            <>
              <PrimaryBtn
                onClick={openProfile}
                disabled={isSubmitting || isLoadingUser}
              >
                COMPLETAR DATOS (EPS + EMERGENCIA)
              </PrimaryBtn>
              <TertiaryBtn
                as="a"
                href={WHATSAPP_URL}
                target="_blank"
                rel="noopener noreferrer"
              >
                ¿No sabes tu EPS? Escríbenos
              </TertiaryBtn>
            </>
          ) : (
            <>
              <Body>
                <p>
                  El check-in solo marca tu asistencia de hoy.{" "}
                  <strong>No descuenta nada.</strong>
                </p>
              </Body>

              <PrimaryBtn
                onClick={() => setShowConfirmCheckIn(true)}
                disabled={!canCheckIn || isSubmitting || isLoadingUser}
                title={checkInButtonTitle}
              >
                {checkInButtonText}
              </PrimaryBtn>

              <SecondaryBtn
                as="a"
                href={WHATSAPP_URL}
                target="_blank"
                rel="noopener noreferrer"
              >
                WHATSAPP (MAÑANAS)
              </SecondaryBtn>
            </>
          )}

          <MoonSection
            session={session}
            canUseMoon={waiverSigned && profileComplete}
          />

          <Divider />

          <SectionTitle>Tu historial (últimos check-ins)</SectionTitle>

          {lastVisits.length > 0 ? (
            <ResList>
              {lastVisits.map((v, idx) => {
                const key = v?._id || `${v?.date || "no-date"}-${idx}`;
                const dateStr = v?.date ? formatDateShort(v.date) : "—";
                const label = visitLabel(v);
                const bg = visitBadgeColor(v);

                return (
                  <ResItem key={key}>
                    <div style={{ textAlign: "left" }}>
                      <ResTitle>{dateStr}</ResTitle>
                      <ResMeta>{label}</ResMeta>
                    </div>
                    <Badge $bg={bg}>{label}</Badge>
                  </ResItem>
                );
              })}
            </ResList>
          ) : (
            <SmallNote>Aún no tienes check-ins registrados.</SmallNote>
          )}

          <Logout onClick={() => signOut()}>Cerrar sesión</Logout>
          <FooterLink href="/privacy">
            Conoce nuestra política de privacidad
          </FooterLink>

          {message && <SmallNote style={{ marginTop: 8 }}>{message}</SmallNote>}
        </Card>
      )}

      {/* Login Modal */}
      {showLoginModal && (
        <ModalOverlay>
          <FrogCard>
            <FrogClose onClick={() => setShowLoginModal(false)}>×</FrogClose>
            <FrogImg src="/gecko.png" alt="Gecko" />
            <FrogSub>Iniciar sesión</FrogSub>
            <FrogBrush>CrashPath</FrogBrush>
            <FrogBody>
              <p style={{ margin: 0 }}>
                Inicia sesión con Google para acceder a tu cuenta, firmar el
                waiver y reservar la MoonBoard.
              </p>
            </FrogBody>
            <FrogRow>
              <ModalBtn $primary onClick={handleAcceptLogin}>CONTINUAR</ModalBtn>
              <ModalBtn $secondary onClick={handleRejectLogin}>CANCELAR</ModalBtn>
            </FrogRow>
          </FrogCard>
        </ModalOverlay>
      )}

      {/* Waiver Modal */}
      {showWaiverModal && (
        <ModalOverlay>
          <FrogCard>
            <FrogClose
              onClick={() => {
                setShowWaiverModal(false);
                setWaiverAccepted(false);
                clearSignature();
              }}
            >
              ×
            </FrogClose>
            <FrogImg src="/gecko.png" alt="Gecko" />
            <FrogSub>Antes de entrenar</FrogSub>
            <FrogBrush>Waiver</FrogBrush>

            <FrogBody>
              <WaiverBox>
                <p style={{ margin: "0 0 10px", fontWeight: 600 }}>
                  {waiverSnapshot?.title ||
                    "CRASHPATH – CONSENTIMIENTO INFORMADO (v1)"}
                </p>
                <p style={{ margin: "0 0 10px", fontSize: 11, color: colors.textLight }}>
                  {waiverCityLine}
                </p>
                <p style={{ margin: 0, whiteSpace: "pre-wrap" }}>
                  {waiverSnapshot?.text || ""}
                </p>
              </WaiverBox>

              <CheckboxRow>
                <input
                  type="checkbox"
                  checked={waiverAccepted}
                  onChange={(e) => setWaiverAccepted(e.target.checked)}
                />
                <span>
                  He leído y acepto el waiver/consentimiento de CrashPath.
                  Entiendo que esto es una firma electrónica.
                </span>
              </CheckboxRow>

              <SigWrap>
                <Label>Firma (dibuja aquí)</Label>
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
                  <Helper style={{ margin: 0 }}>
                    Firmando como: <strong>{session?.user?.name}</strong>
                  </Helper>
                  <TinyBtn
                    type="button"
                    onClick={() => {
                      clearSignature();
                      setMessage("");
                    }}
                  >
                    LIMPIAR
                  </TinyBtn>
                </SigRow>
              </SigWrap>
            </FrogBody>

            <FrogRow>
              <ModalBtn $primary onClick={handleSignWaiver} disabled={isSubmitting}>
                {isSubmitting ? "FIRMANDO..." : "ACEPTO Y FIRMO"}
              </ModalBtn>
              <ModalBtn $secondary
                onClick={() => {
                  setShowWaiverModal(false);
                  setWaiverAccepted(false);
                  clearSignature();
                }}
                disabled={isSubmitting}
              >
                CANCELAR
              </ModalBtn>
            </FrogRow>
          </FrogCard>
        </ModalOverlay>
      )}

      {/* Profile Modal */}
      {showProfileModal && (
        <ModalOverlay>
          <FrogCard>
            <FrogClose onClick={() => setShowProfileModal(false)}>×</FrogClose>
            <FrogImg src="/gecko.png" alt="Gecko" />
            <FrogSub>Datos importantes</FrogSub>
            <FrogBrush>Perfil</FrogBrush>

            <FrogBody>
              <p style={{ margin: "0 0 10px" }}>
                Para entrenar, necesitamos tu <strong>documento</strong>,{" "}
                <strong>EPS</strong> y un{" "}
                <strong>contacto de emergencia</strong>.
              </p>

              <Form>
                <Field>
                  <Label>Tipo de documento</Label>
                  <Select
                    value={documentType}
                    onChange={(e) => setDocumentType(e.target.value)}
                  >
                    <option value="CC">CC</option>
                    <option value="CE">CE</option>
                    <option value="TI">TI</option>
                    <option value="PP">Pasaporte</option>
                    <option value="NIT">NIT</option>
                    <option value="OTRO">Otro</option>
                  </Select>
                </Field>

                <Field>
                  <Label>Número de documento</Label>
                  <Input
                    value={documentNumber}
                    onChange={(e) => setDocumentNumber(e.target.value)}
                    placeholder="Ej: 1098xxxxxx"
                  />
                </Field>

                <Field>
                  <Label>Teléfono</Label>
                  <Input
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="Ej: 3001234567"
                  />
                </Field>

                <Field>
                  <Label>EPS</Label>
                  <Input
                    value={epsName}
                    onChange={(e) => setEpsName(e.target.value)}
                    placeholder="Ej: Sura, Nueva EPS…"
                  />
                </Field>

                <Field>
                  <Label>Nombre contacto de emergencia</Label>
                  <Input
                    value={emergencyContactName}
                    onChange={(e) => setEmergencyContactName(e.target.value)}
                    placeholder="Ej: Mamá / Hermano / Pareja…"
                  />
                </Field>

                <Field>
                  <Label>Teléfono contacto de emergencia</Label>
                  <Input
                    value={emergencyContactPhone}
                    onChange={(e) => setEmergencyContactPhone(e.target.value)}
                    placeholder="Ej: 3000000000"
                  />
                </Field>

                <Helper>Esto es para poder actuar rápido si pasa algo.</Helper>
              </Form>
            </FrogBody>

            <FrogRow>
              <ModalBtn $primary onClick={handleSaveProfile} disabled={isSubmitting}>
                {isSubmitting ? "GUARDANDO..." : "GUARDAR DATOS"}
              </ModalBtn>
              <ModalBtn $secondary
                onClick={() => setShowProfileModal(false)}
                disabled={isSubmitting}
              >
                LUEGO
              </ModalBtn>
            </FrogRow>
          </FrogCard>
        </ModalOverlay>
      )}

      {/* Public Info Modal */}
      {showPublicInfoModal && (
        <ModalOverlay>
          <FrogCard>
            <FrogClose onClick={() => setShowPublicInfoModal(false)}>×</FrogClose>
            <FrogImg src="/gecko.png" alt="Gecko" />
            <FrogSub>Información importante</FrogSub>
            <FrogBrush>CrashPath</FrogBrush>

            <FrogBody>
              <p style={{ margin: 0 }}>
                Buen día de parte del equipo de CrashPath. Ya no se hacen
                reservas del muro completo: ahora estamos siempre abiertos de{" "}
                <strong>3:00 PM a 9:00 PM</strong>, así que puedes pasar directo
                por el gimnasio en ese horario.
                <br />
                <br />
                Ahora esta app sirve para:
                <br />
                <strong>• Reservar la MoonBoard (por si se llena)</strong>
                <br />
                <strong>• Marcar tu check-in de asistencia</strong>
              </p>
            </FrogBody>

            <FrogRow>
              <ModalBtn $primary onClick={() => setShowPublicInfoModal(false)}>
                ENTENDIDO
              </ModalBtn>
            </FrogRow>
          </FrogCard>
        </ModalOverlay>
      )}

      {/* Confirm Check-in Modal */}
      {showConfirmCheckIn && (
        <ModalOverlay>
          <FrogCard>
            <FrogClose onClick={() => setShowConfirmCheckIn(false)}>×</FrogClose>
            <FrogImg src="/gecko.png" alt="Gecko" />
            <FrogSub>Confirmar</FrogSub>
            <FrogBrush>Check-in</FrogBrush>
            <FrogBody>
              <p style={{ margin: 0 }}>
                Vas a marcar tu <strong>check-in de hoy</strong>. Esto solo
                registra tu asistencia para llevar el control — no descuenta
                créditos ni nada.
              </p>
            </FrogBody>
            <FrogRow>
              <ModalBtn $primary onClick={handleCheckIn} disabled={isSubmitting}>
                {isSubmitting ? "REGISTRANDO..." : "CONFIRMAR"}
              </ModalBtn>
              <ModalBtn $secondary
                onClick={() => setShowConfirmCheckIn(false)}
                disabled={isSubmitting}
              >
                CANCELAR
              </ModalBtn>
            </FrogRow>
          </FrogCard>
        </ModalOverlay>
      )}
    </Container>
  );
}