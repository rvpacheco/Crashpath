"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { signIn, signOut, useSession } from "next-auth/react";
import styled from "styled-components";
import axios from "axios";
import { useRouter } from "next/router";
import Link from "next/link";
import { getWaiverSnapshot } from "@/lib/waiver";


const Container = styled.main`
  min-height: 100vh;
  display: grid;
  place-items: center;
  padding: 24px 16px;
`;

const Card = styled.section`
  width: 100%;
  max-width: 380px;
  text-align: center;
  display: grid;
  gap: 14px;
`;

const WelcomeRow = styled.h1`
  margin: 0;
  font-size: 18px;
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: #1e1e1e;
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
  strong {
    color: #9a4a23;
  }
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
  color: #3a3a3a;
`;

const SectionTitle = styled.p`
  margin: 10px 0 0;
  font-size: 13px;
  color: #2b2b2b;
  font-weight: 700;
`;

const PrimaryBtn = styled.button`
  width: 100%;
  border: 0;
  border-radius: 10px;
  height: 44px;
  background: #9a4a23;
  color: #fff;
  font-weight: 800;
  letter-spacing: 0.04em;
  cursor: pointer;
  box-shadow: 0 2px 0 rgba(0, 0, 0, 0.12);
  transition: transform 0.02s ease, box-shadow 0.2s ease, filter 0.2s ease;

  &:active {
    transform: translateY(1px);
    box-shadow: 0 1px 0 rgba(0, 0, 0, 0.12);
  }
  &:disabled {
    background: #d3d3d3;
    cursor: not-allowed;
  }
`;

const SecondaryBtn = styled(PrimaryBtn)`
  background: #2f6f7a;
  letter-spacing: 0.02em;
`;

const NeutralBtn = styled(PrimaryBtn)`
  background: #7aaab0;
  color: #0f2b30;
  font-weight: 700;
  letter-spacing: 0.02em;
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
  box-shadow: 0 2px 0 rgba(0, 0, 0, 0.12);
`;

const FooterLink = styled(Link)`
  display: inline-block;
  margin-top: 8px;
  font-size: 12.5px;
  color: #2b8dfc;
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
  border-radius: 999px;
  padding: 6px 10px;
  font-size: 12px;
  font-weight: 700;
  border: 1px solid #e7e7e7;
  background: #fff;
  color: #1f1f1f;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.06);
`;

const Badge = styled.span`
  font-size: 11px;
  padding: 4px 8px;
  border-radius: 999px;
  background: ${(p) => p.$bg || "#9a4a23"};
  color: #fff;
  font-weight: 800;
`;

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
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.06);
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 10px;
`;

const ResTitle = styled.span`
  font-size: 13.5px;
  color: #1f1f1f;
  font-weight: 700;
`;

const ResMeta = styled.span`
  display: block;
  font-size: 12.5px;
  color: #6b6b6b;
  margin-top: 2px;
`;

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
  background: #fff;
  width: 100%;
  max-width: 420px;
  border-radius: 16px;
  padding: 64px 18px 20px;
  box-shadow: 0 12px 28px rgba(0, 0, 0, 0.18);
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

const FrogBody = styled.div`
  margin: 0 0 12px;
  font-size: 13.5px;
  line-height: 1.5;
  color: #3a3a3a;
  text-align: left;
`;

const FrogRow = styled.div`
  display: flex;
  gap: 12px;
  justify-content: center;
  flex-wrap: wrap;
`;

const PublicBtn = styled.button`
  border: 0;
  border-radius: 12px;
  padding: 12px 18px;
  font-weight: 800;
  letter-spacing: 0.02em;
  cursor: pointer;
  color: #fff;
  background: #9a4a23;
  box-shadow: 0 2px 0 rgba(0, 0, 0, 0.12);
  transition: transform 0.02s ease, box-shadow 0.2s ease, filter 0.2s ease;

  &:active {
    transform: translateY(1px);
    box-shadow: 0 1px 0 rgba(0, 0, 0, 0.12);
  }
  &:hover {
    filter: brightness(0.98);
  }
  &:disabled {
    background: #d3d3d3;
    cursor: not-allowed;
  }
  min-width: 140px;
`;

const NeutralModalBtn = styled(PublicBtn)`
  background: #7aaab0;
  color: #0f2b30;
  font-weight: 700;
`;

const Form = styled.div`
  display: grid;
  gap: 10px;
  margin-top: 10px;
`;

const Field = styled.div`
  display: grid;
  gap: 6px;
  text-align: left;
`;

const Label = styled.label`
  font-size: 12px;
  font-weight: 800;
  color: #1f1f1f;
`;

const Input = styled.input`
  height: 42px;
  border-radius: 10px;
  border: 1px solid #e7e7e7;
  padding: 0 12px;
  font-size: 14px;
  outline: none;
`;

const Helper = styled.p`
  margin: 0;
  font-size: 12px;
  color: #6b6b6b;
`;

const WaiverBox = styled.div`
  border: 1px solid #e7e7e7;
  border-radius: 12px;
  padding: 10px;
  background: #fff;
  max-height: 220px;
  overflow: auto;
`;

const CheckboxRow = styled.label`
  display: flex;
  gap: 10px;
  align-items: flex-start;
  text-align: left;
  font-size: 12.5px;
  color: #2c2c2c;
  line-height: 1.35;
`;

const SigWrap = styled.div`
  margin-top: 10px;
  text-align: left;
`;

const SigCanvas = styled.canvas`
  width: 100%;
  height: 140px;
  border-radius: 12px;
  border: 1px dashed #bfbfbf;
  background: #fafafa;
  touch-action: none;
`;

const SigRow = styled.div`
  display: flex;
  gap: 10px;
  margin-top: 8px;
  justify-content: space-between;
`;

const TinyBtn = styled.button`
  border: 0;
  background: #eaeaea;
  border-radius: 10px;
  padding: 10px 12px;
  cursor: pointer;
  font-weight: 800;
  color: #1f1f1f;
`;

const Select = styled.select`
  height: 42px;
  border-radius: 10px;
  border: 1px solid #e7e7e7;
  padding: 0 12px;
  font-size: 14px;
  outline: none;
  background: #fff;
`;

const WHATSAPP_URL = "https://wa.me/57XXXXXXXXXX";

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
  if (status === "checked_in" || status === "checked-in") return "#2f6f7a";
  if (status === "registered") return "#9a4a23";
  if (status === "no_show" || status === "noshow") return "#6b6b6b";
  if (status === "cancelled") return "#b5632e";
  return "#9a4a23";
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

  const [message, setMessage] = useState("");
  const [isLoadingUser, setIsLoadingUser] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [showLoginModal, setShowLoginModal] = useState(false);
  const [showWaiverModal, setShowWaiverModal] = useState(false);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [showConfirmRegister, setShowConfirmRegister] = useState(false);

  const [waiverAccepted, setWaiverAccepted] = useState(false);
  const canvasRef = useRef(null);
  const drawingRef = useRef(false);
  const hasInkRef = useRef(false);
  const lastPointRef = useRef({ x: 0, y: 0 });

  const [documentType, setDocumentType] = useState("CC");
  const [documentNumber, setDocumentNumber] = useState("");
  const [phone, setPhone] = useState("");
  const [epsName, setEpsName] = useState("");
  const [emergencyContactName, setEmergencyContactName] = useState("");
  const [emergencyContactPhone, setEmergencyContactPhone] = useState("");

  const waiverSigned = userData?.waiverStatus === "signed";
  const profileComplete = userData?.profileStatus === "complete" || isProfileComplete(userData);

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
  const mensualidadInfo = useMemo(() => getMensualidadStatus(userData?.mensualidad), [userData?.mensualidad]);
  const [showAccessModal, setShowAccessModal] = useState(false);
  const [accessTypeChoice, setAccessTypeChoice] = useState("ticketera");

  const canRegister = useMemo(() => {
    if (!session) return false;
    if (!waiverSigned) return false;
    if (!profileComplete) return false;
    if (todaysVisit) return false;

    if (accessType === "mensualidad") return !!mensualidadInfo.active;
    return (userData?.credits ?? 0) >= 1;
  }, [session, waiverSigned, profileComplete, todaysVisit, accessType, mensualidadInfo.active, userData?.credits]);

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

      setDocumentType(u?.documentType || "CC");
      setDocumentNumber(u?.documentNumber || "");
      setPhone(u?.phone || "");
      setEpsName(u?.epsName || "");
      setEmergencyContactName(u?.emergencyContactName || "");
      setEmergencyContactPhone(u?.emergencyContactPhone || "");

      if (autoOpenGates) {
        // Gate 0: elegir modalidad
        if (!u?.accessType) {
          setShowAccessModal(true);
        } else if (u?.waiverStatus !== "signed") {
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session, router]);

  const handleSignIn = () => setShowLoginModal(true);
  const handleAcceptLogin = () => {
    setShowLoginModal(false);
    signIn("google");
  };
  const handleRejectLogin = () => setShowLoginModal(false);

  function getCanvasCtx() {
    const c = canvasRef.current;
    if (!c) return null;
    return c.getContext("2d");
  }
  const handleSaveAccessType = async () => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    setMessage("");

    try {
      await axios.post("/api/access/set", { accessType: accessTypeChoice });
      setShowAccessModal(false);
      await refreshUser({ autoOpenGates: true }); // sigue con waiver/perfil
    } catch (e) {
      setMessage(e?.response?.data?.message || "Error guardando modalidad.");
    } finally {
      setIsSubmitting(false);
    }
  };

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

  useEffect(() => {
    if (showWaiverModal) {
      setTimeout(() => {
        resizeCanvasToDevicePixels();
        clearSignature();
      }, 0);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showWaiverModal]);

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
    const c = canvasRef.current;
    const ctx = getCanvasCtx();
    if (!c || !ctx) return;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, c.width, c.height);
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
      setMessage("Completa: tipo y número de documento, teléfono, EPS y datos de emergencia.");
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
      setMessage("✅ Datos guardados. Ya puedes registrar tu visita.");
    } catch (e) {
      setMessage(e?.response?.data?.message || "Error guardando tu perfil.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRegisterVisit = async () => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    setMessage("");
    try {
      const res = await axios.post("/api/visits/register", {});
      await refreshUser();
      setMessage(res?.data?.message || "✅ Visita registrada");
      setShowConfirmRegister(false);
    } catch (e) {
      const code = e?.response?.data?.code;
      const msg = e?.response?.data?.message || "Error registrando visita.";

      if (code === "WAIVER_REQUIRED") {
        setMessage("⚠️ Debes firmar el waiver antes de registrar tu visita.");
        setShowConfirmRegister(false);
        setShowWaiverModal(true);
      } else if (code === "PROFILE_INCOMPLETE") {
        setMessage("⚠️ Completa tus datos antes de registrar tu visita.");
        setShowConfirmRegister(false);
        setShowProfileModal(true);
      } else if (code === "INSUFFICIENT_CREDITS") {
        setMessage("⚠️ No tienes créditos disponibles.");
      } else if (code === "MENSUALIDAD_EXPIRED") {
        setMessage("⚠️ Tu mensualidad está vencida. Escríbenos para renovarla.");
      } else if (code === "VISIT_ALREADY_EXISTS") {
        setMessage("ℹ️ Ya tienes una visita registrada hoy.");
      } else {
        setMessage(msg);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const topStatus = useMemo(() => {
    if (!session) return null;
    if (isLoadingUser) return { label: "Cargando…", bg: "#6b6b6b" };
    if (!waiverSigned) return { label: "Waiver pendiente", bg: "#b5632e" };
    if (!profileComplete) return { label: "Perfil incompleto", bg: "#b5632e" };
    if (todaysVisit) return { label: `Hoy: ${visitLabel(todaysVisit)}`, bg: visitBadgeColor(todaysVisit) };
    return { label: "Hoy: sin registrar", bg: "#6b6b6b" };
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
    if (!profileComplete) return "Luego completa tus datos (documento + EPS + emergencia + teléfono).";
    if (accessType === "mensualidad") {
      return mensualidadInfo.active
        ? "Listo: puedes registrar tu visita."
        : "Tu mensualidad está vencida. Escríbenos por WhatsApp para renovarla.";
    }
    return "Listo: puedes registrar tu visita.";
  }, [session, waiverSigned, profileComplete, accessType, mensualidadInfo.active]);

  const accessChip = useMemo(() => {
    if (!session) return null;

    if (accessType === "mensualidad") {
      return {
        label: `Mensualidad · ${mensualidadInfo.label}`,
        bg: mensualidadInfo.active ? "#2f6f7a" : "#b5632e",
      };
    }
    const c = userData?.credits ?? 0;
    return {
      label: `Tiquetera · ${c} crédito(s)`,
      bg: c >= 1 ? "#2f6f7a" : "#b5632e",
    };
  }, [session, accessType, mensualidadInfo, userData?.credits]);

  const registerButtonTitle = useMemo(() => {
    if (todaysVisit) return "Ya tienes una visita registrada hoy";
    if (!waiverSigned) return "Debes firmar el waiver";
    if (!profileComplete) return "Completa tus datos";
    if (accessType === "mensualidad") {
      return mensualidadInfo.active ? "" : "Mensualidad vencida";
    }
    return (userData?.credits ?? 0) < 1 ? "No tienes créditos" : "";
  }, [todaysVisit, waiverSigned, profileComplete, accessType, mensualidadInfo.active, userData?.credits]);

  const registerButtonText = useMemo(() => {
    if (todaysVisit) return "VISITA DE HOY YA REGISTRADA";
    if (accessType === "mensualidad") return "REGISTRAR VISITA";
    return "REGISTRAR VISITA (1 CRÉDITO)";
  }, [todaysVisit, accessType]);

  return (
    <Container>
      {!session ? (
        <Card>
          <WelcomeRow>Bienvenid@ a</WelcomeRow>
          <BrushTitle>CrashPath</BrushTitle>

          <Body>
            <p>
              <strong>CrashPath</strong> es un gimnasio de escalada y entrenamiento en Bucaramanga.
            </p>
            <p>
              Inicia sesión con Google para: <strong>firmar el waiver</strong>, completar tus <strong>datos de emergencia</strong> y registrar tus visitas.
            </p>
            <p>
              Horario: <strong>3:00 PM – 10:00 PM</strong>. Mañanas: coordinación por WhatsApp.
            </p>
            <SmallNote>Login con Google = fácil para ti y fácil para nosotros 😄</SmallNote>
          </Body>

          <PrimaryBtn onClick={handleSignIn}>INICIA SESIÓN CON GOOGLE</PrimaryBtn>
          <SecondaryBtn as="a" href={WHATSAPP_URL}>
            WHATSAPP (MAÑANAS)
          </SecondaryBtn>

          <FooterLink href="/privacy">Conoce nuestra política de privacidad</FooterLink>
        </Card>
      ) : (
        <Card>
          <WelcomeRow>
            Bienvenid@, <BrushName>{session.user?.name}</BrushName>
          </WelcomeRow>

          {accessType === "mensualidad" ? (
            <Credits>
              Acceso por <strong>mensualidad</strong>
            </Credits>
          ) : (
            <Credits>
              Tienes <strong>{userData?.credits ?? 0}</strong> crédito(s) disponible(s)
            </Credits>
          )}

          <ChipRow>
            {topStatus && (
              <Chip>
                <Badge $bg={topStatus.bg}>{topStatus.label}</Badge>
              </Chip>
            )}
            {accessChip && (
              <Chip>
                <Badge $bg={accessChip.bg}>{accessChip.label}</Badge>
              </Chip>
            )}
            <Chip>
              <span>Horario:</span>
              <strong>3pm–10pm</strong>
            </Chip>
            <Chip>
              <span>Mañanas:</span>
              <a href={WHATSAPP_URL} style={{ textDecoration: "underline", fontWeight: 800 }}>
                WhatsApp
              </a>
            </Chip>
          </ChipRow>

          <Body>
            <p>{gateText}</p>
          </Body>

          {!waiverSigned ? (
            <>
              <PrimaryBtn onClick={handleOpenWaiver} disabled={isSubmitting || isLoadingUser}>
                ABRIR WAIVER Y FIRMAR
              </PrimaryBtn>
              <NeutralBtn as="a" href={WHATSAPP_URL}>
                ¿Dudas? Escríbenos
              </NeutralBtn>
            </>
          ) : !profileComplete ? (
            <>
              <PrimaryBtn onClick={openProfile} disabled={isSubmitting || isLoadingUser}>
                COMPLETAR DATOS (EPS + EMERGENCIA)
              </PrimaryBtn>
              <NeutralBtn as="a" href={WHATSAPP_URL}>
                ¿No sabes tu EPS? Escríbenos
              </NeutralBtn>
            </>
          ) : (
            <>
              <Body>
                <p>
                  {accessType === "mensualidad" ? (
                    <>
                      Tu acceso es por <strong>mensualidad</strong>. Registra tu visita para llevar el control.
                    </>
                  ) : (
                    <>
                      Registrar visita descuenta <strong>1 crédito</strong>.
                    </>
                  )}
                </p>
              </Body>

              <PrimaryBtn
                onClick={() => setShowConfirmRegister(true)}
                disabled={!canRegister || isSubmitting || isLoadingUser}
                title={registerButtonTitle}
              >
                {registerButtonText}
              </PrimaryBtn>

              <SecondaryBtn as="a" href={WHATSAPP_URL}>
                WHATSAPP (MAÑANAS)
              </SecondaryBtn>
            </>
          )}

          <SectionTitle>Tu historial (últimas visitas)</SectionTitle>

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
            <SmallNote>Aún no tienes visitas registradas.</SmallNote>
          )}

          <Logout onClick={() => signOut()}>Cerrar sesión</Logout>
          <FooterLink href="/privacy">Conoce nuestra política de privacidad</FooterLink>

          {message && <SmallNote style={{ marginTop: 6 }}>{message}</SmallNote>}
        </Card>
      )}

      {showLoginModal && (
        <ModalOverlay>
          <FrogCard>
            <FrogClose onClick={() => setShowLoginModal(false)}>×</FrogClose>
            <FrogImg src="/gecko.png" alt="Gecko" />
            <FrogSub>Iniciar sesión</FrogSub>
            <FrogBrush>CrashPath</FrogBrush>
            <FrogBody>
              <p style={{ margin: 0 }}>
                Inicia sesión con Google para acceder a tu cuenta, firmar el waiver y registrar visitas.
              </p>
            </FrogBody>
            <FrogRow>
              <PublicBtn onClick={handleAcceptLogin}>CONTINUAR</PublicBtn>
              <NeutralModalBtn onClick={handleRejectLogin}>CANCELAR</NeutralModalBtn>
            </FrogRow>
          </FrogCard>
        </ModalOverlay>
      )}

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
                <p style={{ margin: "0 0 10px" }}>
                  <strong>{waiverSnapshot?.title || "CRASHPATH – CONSENTIMIENTO INFORMADO (v1)"}</strong>
                </p>
                <p style={{ margin: "0 0 10px", fontSize: 12.5, color: "#6b6b6b" }}>{waiverCityLine}</p>
                <p style={{ margin: 0, whiteSpace: "pre-wrap" }}>{waiverSnapshot?.text || ""}</p>
              </WaiverBox>

              <div style={{ marginTop: 10 }}>
                <CheckboxRow>
                  <input
                    type="checkbox"
                    checked={waiverAccepted}
                    onChange={(e) => setWaiverAccepted(e.target.checked)}
                    style={{ marginTop: 2 }}
                  />
                  <span>
                    He leído y acepto el waiver/consentimiento de CrashPath. Entiendo que esto es una firma electrónica.
                  </span>
                </CheckboxRow>
              </div>

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
              <PublicBtn onClick={handleSignWaiver} disabled={isSubmitting}>
                {isSubmitting ? "FIRMANDO..." : "ACEPTO Y FIRMO"}
              </PublicBtn>
              <NeutralModalBtn
                onClick={() => {
                  setShowWaiverModal(false);
                  setWaiverAccepted(false);
                  clearSignature();
                }}
                disabled={isSubmitting}
              >
                CANCELAR
              </NeutralModalBtn>
            </FrogRow>
          </FrogCard>
        </ModalOverlay>
      )}

      {showProfileModal && (
        <ModalOverlay>
          <FrogCard>
            <FrogClose onClick={() => setShowProfileModal(false)}>×</FrogClose>
            <FrogImg src="/gecko.png" alt="Gecko" />
            <FrogSub>Datos importantes</FrogSub>
            <FrogBrush>Perfil</FrogBrush>

            <FrogBody>
              <p style={{ margin: "0 0 10px" }}>
                Para entrenar, necesitamos tu <strong>documento</strong>, <strong>EPS</strong> y un{" "}
                <strong>contacto de emergencia</strong>.
              </p>

              <Form>
                <Field>
                  <Label>Tipo de documento</Label>
                  <Select value={documentType} onChange={(e) => setDocumentType(e.target.value)}>
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
                  <Input value={documentNumber} onChange={(e) => setDocumentNumber(e.target.value)} placeholder="Ej: 1098xxxxxx" />
                </Field>

                <Field>
                  <Label>Teléfono</Label>
                  <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Ej: 3001234567" />
                </Field>

                <Field>
                  <Label>EPS</Label>
                  <Input value={epsName} onChange={(e) => setEpsName(e.target.value)} placeholder="Ej: Sura, Nueva EPS…" />
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
              <PublicBtn onClick={handleSaveProfile} disabled={isSubmitting}>
                {isSubmitting ? "GUARDANDO..." : "GUARDAR DATOS"}
              </PublicBtn>
              <NeutralModalBtn onClick={() => setShowProfileModal(false)} disabled={isSubmitting}>
                LUEGO
              </NeutralModalBtn>
            </FrogRow>
          </FrogCard>
        </ModalOverlay>
      )}

      {showConfirmRegister && (
        <ModalOverlay>
          <FrogCard>
            <FrogClose onClick={() => setShowConfirmRegister(false)}>×</FrogClose>
            <FrogImg src="/gecko.png" alt="Gecko" />
            <FrogSub>Confirmar</FrogSub>
            <FrogBrush>Visita</FrogBrush>
            <FrogBody>
              <p style={{ margin: 0 }}>
                {accessType === "mensualidad" ? (
                  <>
                    Vas a registrar tu visita de hoy. Esto ayuda a llevar el control de asistencia.
                  </>
                ) : (
                  <>
                    Vas a registrar tu visita de hoy. Se descuenta <strong>1 crédito</strong> y no es reembolsable si no asistes.
                  </>
                )}
              </p>
            </FrogBody>
            <FrogRow>
              <PublicBtn onClick={handleRegisterVisit} disabled={isSubmitting}>
                {isSubmitting ? "REGISTRANDO..." : "CONFIRMAR"}
              </PublicBtn>
              <NeutralModalBtn onClick={() => setShowConfirmRegister(false)} disabled={isSubmitting}>
                CANCELAR
              </NeutralModalBtn>
            </FrogRow>
          </FrogCard>
        </ModalOverlay>
      )}
      {showAccessModal && (
        <ModalOverlay>
          <FrogCard>
            <FrogClose onClick={() => setShowAccessModal(false)}>×</FrogClose>
            <FrogImg src="/gecko.png" alt="Gecko" />
            <FrogSub>Antes de continuar</FrogSub>
            <FrogBrush>Modalidad</FrogBrush>

            <FrogBody>
              <p style={{ margin: "0 0 10px" }}>
                ¿Cómo vas a entrenar en <strong>CrashPath</strong>?
              </p>

              <Form>
                <Field>
                  <Label>Selecciona una opción</Label>
                  <Select value={accessTypeChoice} onChange={(e) => setAccessTypeChoice(e.target.value)}>
                    <option value="ticketera">Tiquetera (por créditos)</option>
                    <option value="mensualidad">Mensualidad</option>
                  </Select>
                </Field>

                <Helper>
                  Esto define cómo se registra tu visita: con créditos o por mensualidad activa.
                </Helper>
              </Form>
            </FrogBody>

            <FrogRow>
              <PublicBtn onClick={handleSaveAccessType} disabled={isSubmitting}>
                {isSubmitting ? "GUARDANDO..." : "CONTINUAR"}
              </PublicBtn>
              <NeutralModalBtn onClick={() => signOut()} disabled={isSubmitting}>
                SALIR
              </NeutralModalBtn>
            </FrogRow>
          </FrogCard>
        </ModalOverlay>
      )}
    </Container>
  );
}