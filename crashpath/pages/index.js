"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import styled, { createGlobalStyle } from "styled-components";

/** =========================
 * CrashPath Landing (updated)
 * - CrashPath is now a full climbing gym (not hourly sessions)
 * - Open 2pm–8pm (mornings via WhatsApp)
 * - App CTA: "Registrar visita" (1 crédito)
 * ========================= */

const themes = {
  day: {
    bg: "#E7E1D2",
    text: "#2B2620",
    muted: "#6B6257",
    border: "rgba(43,38,32,0.16)",
    panel: "rgba(255,255,255,0.55)",
    panelSolid: "#F3EFE6",
    accent: "#9C4F24",
    accent2: "#C26A34",
    overlay: "rgba(0,0,0,0.35)",
    heroText: "rgba(255,255,255,0.92)",
    heroMuted: "rgba(255,255,255,0.72)",
    chipBg: "rgba(0,0,0,0.35)",
    grain: 0.1,
    focus: "rgba(156,79,36,0.20)",
  },
  dark: {
    bg: "#0F0D0B",
    text: "rgba(255,255,255,0.90)",
    muted: "rgba(255,255,255,0.65)",
    border: "rgba(255,255,255,0.14)",
    panel: "rgba(255,255,255,0.06)",
    panelSolid: "rgba(255,255,255,0.08)",
    accent: "#C26A34",
    accent2: "#9C4F24",
    overlay: "rgba(0,0,0,0.55)",
    heroText: "rgba(255,255,255,0.92)",
    heroMuted: "rgba(255,255,255,0.72)",
    chipBg: "rgba(0,0,0,0.45)",
    grain: 0.16,
    focus: "rgba(194,106,52,0.24)",
  },
};

const GlobalStyle = createGlobalStyle`
  :root { color-scheme: ${(p) => (p.$mode === "dark" ? "dark" : "light")}; }
  *{ box-sizing:border-box; }
  html, body { height:100%; }
  body{
    margin:0;
    background:${(p) => p.$t.bg};
    color:${(p) => p.$t.text};
    -webkit-font-smoothing:antialiased;
    text-rendering:optimizeLegibility;
    font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial;
  }
  a{ color:inherit; text-decoration:none; }
  button, input { font-family: inherit; }
  button { -webkit-tap-highlight-color: transparent; }

  ::selection { background: ${(p) => p.$t.accent}33; }

  @media (prefers-reduced-motion: reduce) {
    * { transition:none !important; animation:none !important; scroll-behavior:auto !important; }
  }
`;

const Page = styled.div``;

const Header = styled.header`
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  z-index: 50;
  pointer-events: none;
`;

const HeaderInner = styled.div`
  max-width: 1200px;
  margin: 0 auto;
  padding: 16px 14px;
  display: grid;
  grid-template-columns: 1fr auto 1fr;
  align-items: center;
  gap: 12px;
`;

const NavLeft = styled.nav`
  display: none;
  gap: 18px;
  align-items: center;
  pointer-events: auto;

  @media (min-width: 860px) {
    display: flex;
  }
`;

const NavRight = styled.nav`
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  align-items: center;
  pointer-events: auto;
`;

const NavLink = styled.a`
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas,
    "Liberation Mono", monospace;
  font-size: 12px;
  letter-spacing: 0.02em;
  color: ${(p) => p.$t.heroMuted};
  padding: 8px 10px;
  border-radius: 999px;
  border: 1px solid transparent;

  &:hover {
    color: ${(p) => p.$t.heroText};
    border-color: rgba(255, 255, 255, 0.25);
    background: rgba(0, 0, 0, 0.18);
  }
`;

const CenterLogo = styled.div`
  pointer-events: auto;
  display: grid;
  place-items: center;
  text-align: center;
`;

const LogoMark = styled.div`
  font-weight: 950;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: ${(p) => p.$t.heroText};
  font-size: 12px;
`;

const IconBtn = styled.button`
  width: 40px;
  height: 40px;
  border-radius: 12px;
  border: 1px solid rgba(255, 255, 255, 0.2);
  background: rgba(0, 0, 0, 0.22);
  color: ${(p) => p.$t.heroText};
  cursor: pointer;
  display: grid;
  place-items: center;
  font-weight: 900;

  &:hover {
    background: rgba(0, 0, 0, 0.3);
  }
  &:focus-visible {
    outline: none;
    box-shadow: 0 0 0 4px ${(p) => p.$t.focus};
  }
`;

const CTA = styled(Link)`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 40px;
  padding: 9px 12px;
  border-radius: 999px;
  border: 1px solid rgba(255, 255, 255, 0.22);
  background: rgba(0, 0, 0, 0.22);
  color: ${(p) => p.$t.heroText};
  font-weight: 900;
  letter-spacing: 0.02em;
  font-size: 12px;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas,
    "Liberation Mono", monospace;

  &:hover {
    background: rgba(0, 0, 0, 0.3);
  }
  &:focus-visible {
    outline: none;
    box-shadow: 0 0 0 4px ${(p) => p.$t.focus};
  }
`;

const Hero = styled.section`
  position: relative;
  height: 86vh;
  min-height: 560px;
  width: 100%;
  overflow: hidden;
  background: #000;
`;

const HeroShade = styled.div`
  position: absolute;
  inset: 0;
  pointer-events: none;
  background: linear-gradient(
    180deg,
    rgba(0, 0, 0, 0.05) 0%,
    rgba(0, 0, 0, 0.1) 45%,
    rgba(0, 0, 0, 0.55) 75%,
    rgba(0, 0, 0, 0.78) 100%
  );
`;

const HeroContent = styled.div`
  position: absolute;
  inset: 0;
  z-index: 2;

  display: grid;
  align-content: end;
  justify-items: center;

  padding: 92px 14px 32px;

  @media (min-width: 900px) {
    padding: 96px 18px 44px;
  }
`;

const HeroBox = styled.div`
  width: 100%;
  max-width: 920px;
  text-align: center;
`;

const HeroTitle = styled.h1`
  margin: 0;
  color: rgba(255, 255, 255, 0.92);

  font-weight: 800;
  letter-spacing: -0.03em;
  line-height: 1.02;

  font-family: ui-serif, Georgia, "Times New Roman", Times, serif;

  font-size: 38px;

  @media (min-width: 900px) {
    font-size: 64px;
  }
`;

const HeroLead = styled.p`
  margin: 10px auto 0;
  color: ${(p) => p.$t.heroMuted};
  font-size: 13px;
  line-height: 1.7;
  max-width: 70ch;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas,
    "Liberation Mono", monospace;

  @media (min-width: 900px) {
    font-size: 14px;
  }
`;

const HeroPill = styled.div`
  margin: 18px auto 0;
  width: min(520px, 100%);
  padding: 10px;
  border-radius: 999px;

  display: grid;
  grid-template-columns: 1fr 1px 1fr;
  align-items: center;

  border: 1px solid rgba(255, 255, 255, 0.22);
  background: rgba(10, 10, 10, 0.22);
  backdrop-filter: blur(12px);
  box-shadow: 0 18px 50px rgba(0, 0, 0, 0.35);
`;

const PillDivider = styled.div`
  height: 26px;
  width: 1px;
  background: rgba(255, 255, 255, 0.22);
  justify-self: center;
`;

const PillLink = styled(Link)`
  height: 44px;
  border-radius: 999px;

  display: grid;
  place-items: center;

  font-weight: 900;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  font-size: 12px;

  color: rgba(255, 255, 255, 0.92);

  &:hover {
    background: rgba(255, 255, 255, 0.08);
  }
  &:focus-visible {
    outline: none;
    box-shadow: 0 0 0 4px rgba(255, 255, 255, 0.18);
  }
`;

const PillPrimary = styled(PillLink)`
  background: rgba(194, 106, 52, 0.3);
  &:hover {
    background: rgba(194, 106, 52, 0.38);
  }
`;

const HeroActions = styled.div`
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
  margin-top: 14px;
  justify-content: center;
`;

const HeroBtn = styled(Link)`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 44px;
  padding: 10px 14px;
  border-radius: 12px;
  font-weight: 950;
  letter-spacing: 0.02em;
  border: 1px solid
    ${(p) =>
    p.$kind === "primary" ? "transparent" : "rgba(255,255,255,0.22)"};
  background: ${(p) =>
    p.$kind === "primary"
      ? `linear-gradient(180deg, ${p.$t.accent}, ${p.$t.accent2})`
      : "rgba(0,0,0,0.22)"};
  color: ${(p) => p.$t.heroText};

  &:hover {
    filter: brightness(0.96);
    transform: translateY(-1px);
  }
  &:focus-visible {
    outline: none;
    box-shadow: 0 0 0 4px ${(p) => p.$t.focus};
  }
`;

const Section = styled.section`
  position: relative;
  z-index: 1;
  padding: 60px 14px;

  @media (min-width: 900px) {
    padding: 80px 18px;
  }
`;

const SectionInner = styled.div`
  max-width: 1200px;
  margin: 0 auto;
`;

const SectionTitle = styled.h2`
  margin: 0;
  text-align: center;
  font-size: 28px;
  letter-spacing: -0.01em;

  @media (min-width: 900px) {
    font-size: 34px;
  }
`;

const SectionKicker = styled.div`
  margin-top: 10px;
  text-align: center;
  color: ${(p) => p.$t.muted};
  font-size: 13px;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas,
    "Liberation Mono", monospace;
`;

const Tiles = styled.div`
  margin-top: 26px;

  display: grid;
  grid-auto-flow: column;
  grid-auto-columns: calc(100% - 56px);
  gap: 14px;

  overflow-x: auto;
  padding: 0 28px 18px;
  scroll-padding: 28px;
  scroll-snap-type: x mandatory;
  scroll-behavior: smooth;
  overscroll-behavior-x: contain;
  -webkit-overflow-scrolling: touch;

  scrollbar-width: none;
  &::-webkit-scrollbar {
    display: none;
  }

  @media (min-width: 700px) {
    grid-auto-columns: 70%;
    padding: 0 22px 20px;
    scroll-padding: 22px;
  }

  @media (min-width: 1040px) {
    padding: 0;
    overflow: visible;
    grid-auto-flow: initial;
    grid-auto-columns: initial;
    scroll-snap-type: none;

    display: grid;
    gap: 18px;
    grid-template-columns: repeat(12, minmax(0, 1fr));
  }
`;

const TileWrap = styled.div`
  width: 100%;
  scroll-snap-align: center;
  scroll-snap-stop: always;
  touch-action: pan-x;

  @media (min-width: 1040px) {
    scroll-snap-align: initial;
    scroll-snap-stop: normal;
    grid-column: span ${(p) => p.$span || 4};
  }
`;

const Tile = styled(Link)`
  display: block;
  width: 100%;

  position: relative;
  border-radius: 22px;
  overflow: hidden;
  border: 1px solid ${(p) => p.$t.border};
  background: ${(p) => p.$t.panelSolid};

  aspect-ratio: 16 / 10;
  min-height: 230px;

  box-shadow: ${(p) =>
    p.$mode === "dark"
      ? "0 18px 55px rgba(0,0,0,0.55)"
      : "0 14px 40px rgba(0,0,0,0.10)"};

  transform: translateZ(0);
  transition: transform 220ms ease, box-shadow 220ms ease,
    border-color 220ms ease, filter 220ms ease;

  &:active {
    transform: scale(0.99);
  }

  &:hover {
    transform: translateY(-3px);
    border-color: ${(p) =>
    p.$mode === "dark"
      ? "rgba(255,255,255,0.22)"
      : "rgba(43,38,32,0.24)"};
    box-shadow: ${(p) =>
    p.$mode === "dark"
      ? "0 26px 80px rgba(0,0,0,0.65)"
      : "0 22px 70px rgba(0,0,0,0.14)"};
  }

  &:focus-visible {
    outline: none;
    box-shadow: 0 0 0 4px ${(p) => `${p.$t.accent}33`},
      ${(p) =>
    p.$mode === "dark"
      ? "0 26px 80px rgba(0,0,0,0.65)"
      : "0 22px 70px rgba(0,0,0,0.14)"};
  }
`;

const TileImg = styled.div`
  position: absolute;
  inset: 0;

  background-image: url(${(p) => p.$src});
  background-size: cover;
  background-position: center;

  filter: contrast(1.05) saturate(0.98);
  transform: scale(1.03);
  transition: transform 520ms ease, filter 520ms ease;

  ${Tile}:hover & {
    transform: scale(1.08);
    filter: contrast(1.08) saturate(1.02);
  }
`;

const TileShade = styled.div`
  position: absolute;
  inset: 0;
  pointer-events: none;

  background: linear-gradient(
    180deg,
    rgba(0, 0, 0, 0) 40%,
    rgba(0, 0, 0, 0.35) 70%,
    rgba(0, 0, 0, 0.7) 100%
  );
`;

const TileTopRow = styled.div`
  position: absolute;
  left: 14px;
  right: 14px;
  bottom: 14px;
  z-index: 2;

  display: grid;
  gap: 8px;
`;

const TileLabel = styled.div`
  justify-self: start;
  padding: 5px 9px;
  border-radius: 999px;

  border: 1px solid rgba(255, 255, 255, 0.18);
  background: rgba(0, 0, 0, 0.22);
  backdrop-filter: blur(10px);

  color: rgba(255, 255, 255, 0.92);
  font-size: 10px;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  font-weight: 800;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas,
    "Liberation Mono", monospace;
`;

const TileTitle = styled.div`
  color: rgba(255, 255, 255, 0.96);
  font-weight: 900;
  font-size: 18px;
  letter-spacing: -0.02em;
  line-height: 1.05;
  text-shadow: 0 10px 22px rgba(0, 0, 0, 0.55);

  @media (min-width: 900px) {
    font-size: 20px;
  }
`;

const TileSub = styled.div`
  color: rgba(255, 255, 255, 0.78);
  font-size: 12px;
  line-height: 1.45;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas,
    "Liberation Mono", monospace;

  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
`;

const HeroBg = styled.div`
  position: absolute;
  inset: 0;
  background-image: url(${(p) => p.$src});
  background-size: cover;
  background-position: center 35%;
  filter: ${(p) =>
    p.$mode === "dark"
      ? "contrast(1.05) saturate(1.0)"
      : "contrast(1.05) saturate(1.05)"};
`;

const TileContent = styled.div`
  position: absolute;
  left: 12px;
  right: 12px;
  bottom: 12px;
  z-index: 2;

  border-radius: 18px;
  border: 1px solid rgba(255, 255, 255, 0.14);
  background: rgba(10, 10, 10, 0.34);
  backdrop-filter: blur(14px);

  padding: 12px;
  display: grid;
  gap: 6px;

  box-shadow: 0 10px 26px rgba(0, 0, 0, 0.22);
`;

const Dots = styled.div`
  display: flex;
  gap: 6px;
  justify-content: center;
  margin-top: 10px;

  @media (min-width: 1040px) {
    display: none;
  }
`;

const Dot = styled.button`
  width: 7px;
  height: 7px;
  border-radius: 999px;
  border: 1px solid ${(p) => p.$t.border};
  background: ${(p) => (p.$active ? p.$t.accent : "transparent")};
  cursor: pointer;
  padding: 0;

  &:focus-visible {
    outline: none;
    box-shadow: 0 0 0 4px ${(p) => p.$t.focus};
  }
`;

const AboutGrid = styled.div`
  margin-top: 26px;
  display: grid;
  gap: 16px;

  @media (min-width: 980px) {
    grid-template-columns: 1.1fr 0.9fr;
    align-items: start;
  }
`;

const AboutCard = styled.div`
  border: 1px solid ${(p) => p.$t.border};
  border-radius: 18px;
  background: ${(p) => p.$t.panel};
  padding: 16px;
  backdrop-filter: blur(10px);
  box-shadow: ${(p) =>
    p.$mode === "dark"
      ? "0 20px 60px rgba(0,0,0,0.55)"
      : "0 14px 40px rgba(0,0,0,0.10)"};
`;

const AboutTitle = styled.h3`
  margin: 0;
  font-size: 16px;
`;

const AboutText = styled.p`
  margin: 10px 0 0;
  color: ${(p) => p.$t.muted};
  font-size: 13px;
  line-height: 1.75;
  max-width: 78ch;
`;

const Bullets = styled.ul`
  margin: 12px 0 0;
  padding-left: 18px;
  color: ${(p) => p.$t.muted};
  font-size: 13px;
  line-height: 1.7;

  li {
    margin: 6px 0;
  }
`;

const VideoBox = styled.div`
  border-radius: 18px;
  overflow: hidden;
  border: 1px solid ${(p) => p.$t.border};
  background: ${(p) =>
    p.$mode === "dark" ? "rgba(255,255,255,0.06)" : "rgba(255,255,255,0.55)"};
  min-height: 320px;
  display: grid;
  place-items: center;
  position: relative;
`;

const VideoHint = styled.div`
  color: ${(p) => p.$t.muted};
  font-size: 12px;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas,
    "Liberation Mono", monospace;
  text-align: center;
  padding: 18px;
`;

const Footer = styled.footer`
  position: relative;
  z-index: 1;
  padding: 40px 14px 50px;
  text-align: center;
  color: ${(p) => p.$t.muted};
  font-size: 12px;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas,
    "Liberation Mono", monospace;
`;
const ServiceGrid = styled.div`
  margin-top: 32px;
  display: grid;
  gap: 14px;

  @media (min-width: 860px) {
    grid-template-columns: repeat(3, 1fr);
    align-items: start;
  }
`;

const ServiceBlock = styled.div`
  border: 1px solid ${(p) =>
    p.$highlight ? p.$t.accent : p.$t.border};
  border-radius: 20px;
  background: ${(p) => p.$t.panel};
  padding: 24px 20px;
  backdrop-filter: blur(10px);
  display: grid;
  gap: 10px;
  box-shadow: ${(p) =>
    p.$highlight
      ? `0 0 0 1px ${p.$t.accent}44, 0 20px 60px rgba(0,0,0,0.12)`
      : p.$mode === "dark"
        ? "0 20px 60px rgba(0,0,0,0.45)"
        : "0 14px 40px rgba(0,0,0,0.07)"};
  transition: transform 220ms ease, box-shadow 220ms ease;

  &:hover {
    transform: translateY(-2px);
  }
`;

const ServiceTag = styled.div`
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas,
    "Liberation Mono", monospace;
  font-size: 10px;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  font-weight: 800;
  color: ${(p) => (p.$highlight ? p.$t.accent : p.$t.muted)};
`;

const ServiceName = styled.h3`
  margin: 0;
  font-size: 20px;
  letter-spacing: -0.02em;
  color: ${(p) => p.$t.text};
`;

const ServiceDesc = styled.p`
  margin: 0;
  font-size: 13px;
  line-height: 1.75;
  color: ${(p) => p.$t.muted};
`;

const ServiceMeta = styled.div`
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas,
    "Liberation Mono", monospace;
  font-size: 11px;
  color: ${(p) => p.$t.muted};
  padding: 6px 0;
  border-top: 1px solid ${(p) => p.$t.border};
`;

const ServiceCTA = styled(Link)`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  margin-top: 4px;
  min-height: 42px;
  padding: 10px 14px;
  border-radius: 12px;
  font-weight: 950;
  letter-spacing: 0.06em;
  font-size: 12px;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas,
    "Liberation Mono", monospace;
  border: 1px solid ${(p) =>
    p.$kind === "primary" ? "transparent" : p.$t.border};
  background: ${(p) =>
    p.$kind === "primary"
      ? `linear-gradient(180deg, ${p.$t.accent}, ${p.$t.accent2})`
      : "transparent"};
  color: ${(p) =>
    p.$kind === "primary" ? "#fff" : p.$t.text};
  transition: filter 180ms ease, transform 180ms ease;

  &:hover {
    filter: brightness(0.94);
    transform: translateY(-1px);
  }
`;
const HeroLocation = styled.div`
  display: inline-flex;
  align-items: center;
  gap: 6px;
  margin-top: 14px;
  padding: 6px 14px;
  border-radius: 999px;
  border: 1px solid rgba(255, 255, 255, 0.18);
  background: rgba(0, 0, 0, 0.22);
  backdrop-filter: blur(10px);

  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas,
    "Liberation Mono", monospace;
  font-size: 11px;
  letter-spacing: 0.08em;
  color: rgba(255, 255, 255, 0.78);
`;

function getInitialMode() {
  if (typeof window === "undefined") return "day";
  const saved = window.localStorage.getItem("cp_theme");
  if (saved === "day" || saved === "dark") return saved;
  const prefersDark = window.matchMedia?.("(prefers-color-scheme: dark)")?.matches;
  return prefersDark ? "dark" : "day";
}

/** Replace these with your real images in /public */
const heroImage = "/landing/hero-2.jpg";

/** ✅ Replace with your real WhatsApp number */
const WHATSAPP_URL = "https://wa.me/57XXXXXXXXXX";

const services = [
  {
    tag: "GIMNASIO",
    title: "Entrenamiento Libre",
    subtitle: "Acceso 2pm–8pm · MoonBoard + placa principal · enfoque en progreso.",
    href: "/reservas",
    img: "/landing/service-reserve.jpg",
    span: 6,
    tall: true,
  },
  {
    tag: "GUIADAS",
    title: "Trips & Guiadas",
    subtitle: "Roca + logística + coaching. Armamos grupos por nivel.",
    href: "/guides",
    img: "/landing/service-guides.jpg",
    span: 6,
    tall: true,
  },
  {
    tag: "ENTRENOS",
    title: "Entrenos",
    subtitle: "Fuerza, resistencia y técnica aplicada.",
    href: "/training",
    img: "/landing/service-training.jpg",
    span: 4,
  },
  {
    tag: "SHOP",
    title: "Productos",
    subtitle: "Magnesio, straps, gear. Drops & collabs.",
    href: "/shop",
    img: "/landing/service-shop.jpg",
    span: 4,
  },
  {
    tag: "STAY",
    title: "Hospedaje",
    subtitle: "Casa cerca de la roca para trips y temporadas.",
    href: "/stay",
    img: "/landing/service-stay.jpg",
    span: 4,
  },
];

export default function CrashPathLanding() {
  const [activeIdx, setActiveIdx] = useState(0);
  const railRef = useRef(null);

  const [mode, setMode] = useState("day");
  const t = useMemo(() => themes[mode], [mode]);

  useEffect(() => setMode(getInitialMode()), []);
  useEffect(() => {
    if (typeof window !== "undefined") window.localStorage.setItem("cp_theme", mode);
  }, [mode]);

  const toggleMode = () => setMode((m) => (m === "dark" ? "day" : "dark"));

  const scrollToIdx = (i) => {
    const el = railRef.current;
    if (!el) return;
    const child = el.children?.[i];
    if (!child) return;

    const targetLeft = child.offsetLeft - (el.clientWidth - child.clientWidth) / 2;
    el.scrollTo({ left: targetLeft, behavior: "smooth" });
  };

  useEffect(() => {
    const el = railRef.current;
    if (!el) return;

    let raf = 0;

    const computeActive = () => {
      const children = Array.from(el.children || []);
      if (!children.length) return;

      const railRect = el.getBoundingClientRect();
      const railCenter = railRect.left + railRect.width / 2;

      let best = 0;
      let bestDist = Infinity;

      children.forEach((c, i) => {
        const r = c.getBoundingClientRect();
        const cCenter = r.left + r.width / 2;
        const dist = Math.abs(cCenter - railCenter);
        if (dist < bestDist) {
          bestDist = dist;
          best = i;
        }
      });

      setActiveIdx(best);
    };

    const onScroll = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(computeActive);
    };

    el.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", computeActive);

    computeActive();

    return () => {
      cancelAnimationFrame(raf);
      el.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", computeActive);
    };
  }, []);

  return (
    <Page $t={t} $mode={mode}>
      <GlobalStyle $t={t} $mode={mode} />

      {/* Fixed transparent header */}
      <Header>
        <HeaderInner>
          <NavLeft>
            <Link href="#home" passHref legacyBehavior>
              <NavLink $t={t}>Home</NavLink>
            </Link>
            <Link href="#services" passHref legacyBehavior>
              <NavLink $t={t}>Servicios</NavLink>
            </Link>
            <Link href="#about" passHref legacyBehavior>
              <NavLink $t={t}>CrashPath</NavLink>
            </Link>
          </NavLeft>

          <CenterLogo>
            <LogoMark $t={t}>CRASHPATH</LogoMark>
          </CenterLogo>

          <NavRight>
            <IconBtn onClick={toggleMode} $t={t} aria-label="Cambiar tema">
              {mode === "dark" ? "☀" : "🌙"}
            </IconBtn>

            <CTA href="/login" $t={t}>
              LOGIN
            </CTA>

            {/* WhatsApp quick access (mornings + general contact) */}
            <CTA href={WHATSAPP_URL} $t={t}>
              WHATSAPP
            </CTA>
          </NavRight>
        </HeaderInner>
      </Header>

      {/* HERO */}
      <Hero id="home">
        <HeroBg $src={heroImage} $mode={mode} />
        <HeroShade $t={t} />

        <HeroContent>
          <HeroBox>
            <HeroTitle>
              CrashPath
              <br />
              Gimnasio de Escalada

            </HeroTitle>
            <HeroLocation>📍 Bucaramanga, Colombia · Roca natural · Guiadas en español & English</HeroLocation>



            <HeroPill>
              <PillPrimary href="/reservas">REGISTRAR VISITA</PillPrimary>
              <PillDivider />
              <PillLink href={WHATSAPP_URL}>MAÑANAS (WA)</PillLink>
            </HeroPill>

            <HeroActions>
              <HeroBtn href="#services" $t={t} $kind="ghost">
                VER SERVICIOS
              </HeroBtn>
              <HeroBtn href="#about" $t={t} $kind="primary">
                CÓMO FUNCIONA
              </HeroBtn>
            </HeroActions>
          </HeroBox>
        </HeroContent>
      </Hero>
      {/* SERVICES */}
      <Section id="services">
        <SectionInner>
          <SectionTitle>Lo que hacemos</SectionTitle>
          <SectionKicker $t={t}>
            Gimnasio · Entrenamiento · Guiadas en roca
          </SectionKicker>

          <ServiceGrid>
            {/* GIMNASIO */}
            <ServiceBlock $t={t} $mode={mode}>
              <ServiceTag $t={t}>GIMNASIO</ServiceTag>
              <ServiceName $t={t}>Entrenamiento Libre</ServiceName>
              <ServiceDesc $t={t}>
                Escala cuando quieras dentro del horario de tarde.
                MoonBoard a 25° y 40°, placa principal, enfoque en progreso real.
                Sin reserva previa — llegas y entrenas.
              </ServiceDesc>
              <ServiceMeta $t={t}>Lunes a Sábado · 2:00 PM – 8:00 PM</ServiceMeta>
              <ServiceCTA href="/reservas" $t={t} $kind="primary">
                REGISTRAR VISITA
              </ServiceCTA>
            </ServiceBlock>

            {/* ENTRENAMIENTO */}
            <ServiceBlock $t={t} $mode={mode}>
              <ServiceTag $t={t}>ENTRENAMIENTO</ServiceTag>
              <ServiceName $t={t}>Programación Enfocada</ServiceName>
              <ServiceDesc $t={t}>
                Fuerza de dedos, resistencia y técnica aplicada a la escalada.
                Rutinas diseñadas para escalar mejor en roca y placa.
                Para todos los niveles.
              </ServiceDesc>
              <ServiceMeta $t={t}>Incluido con acceso al gym</ServiceMeta>
              <ServiceCTA href="#about" $t={t} $kind="ghost">
                CÓMO FUNCIONA
              </ServiceCTA>
            </ServiceBlock>

            {/* GUIADAS */}
            <ServiceBlock $t={t} $mode={mode} $highlight>
              <ServiceTag $t={t} $highlight>GUIADAS · TRIPS</ServiceTag>
              <ServiceName $t={t}>Escalada en Roca Real</ServiceName>
              <ServiceDesc $t={t}>
                Salidas a roca natural cerca de Bucaramanga. Grupos por nivel,
                logística incluida. Ideal para visitantes y extranjeros.
                Guías en español e inglés.
              </ServiceDesc>
              <ServiceMeta $t={t}>📍 Bucaramanga, Colombia · Sport climbing</ServiceMeta>
              <ServiceCTA href={WHATSAPP_URL} $t={t} $kind="primary">
                ESCRIBIR POR WHATSAPP
              </ServiceCTA>
            </ServiceBlock>
          </ServiceGrid>
        </SectionInner>
      </Section>

      {/* ABOUT / HOW IT WORKS NOW */}
      <Section id="about">
        <SectionInner>
          <SectionTitle>CrashPath — Cómo entrenas hoy</SectionTitle>
          <SectionKicker $t={t}>
            Ya no trabajamos por horas. Llegas, entrenas y te enfocas en tu progreso.
          </SectionKicker>

          <AboutGrid>
            <AboutCard $t={t} $mode={mode}>
              <AboutTitle>Entrenamiento en CrashPath</AboutTitle>

              <AboutText $t={t}>
                CrashPath ahora es un gimnasio de escalada enfocado en entrenamiento real.
                Puedes escalar libremente dentro del horario de la tarde (<b>2:00 PM – 8:00 PM</b>),
                usando tanto la <b>MoonBoard</b> como nuestra <b>placa principal</b>.
                <br />
                <br />
                Para mañanas, escríbenos por WhatsApp y coordinamos según disponibilidad.
              </AboutText>

              <Bullets $t={t}>
                <li>Acceso libre en horario de tarde (2pm–8pm).</li>
                <li>MoonBoard a 25° y 40° disponible.</li>
                <li>Nueva placa principal de escalada.</li>
                <li>Enfoque en técnica, fuerza y resistencia.</li>
                <li>Para entrenar en la mañana: coordinación por WhatsApp.</li>
              </Bullets>

              <HeroActions style={{ marginTop: 14 }}>
                <HeroBtn href="/reservas" $t={t} $kind="primary">
                  REGISTRAR VISITA
                </HeroBtn>
                <HeroBtn href={WHATSAPP_URL} $t={t} $kind="ghost">
                  WHATSAPP (MAÑANAS)
                </HeroBtn>
              </HeroActions>
            </AboutCard>

            <VideoBox $t={t} $mode={mode}>
              <VideoHint $t={t}>
                VIDEO PLACEHOLDER
                <br />
                Aquí va un reel de la placa / MoonBoard / vibe del gimnasio.
                <br />
                (pon un mp4 en /public/landing/intro.mp4 y lo incrustamos)
              </VideoHint>
            </VideoBox>
          </AboutGrid>
        </SectionInner>
      </Section>

      <Footer $t={t}>
        © {new Date().getFullYear()} CrashPath · Bucaramanga · Gimnasio de Escalada y Entrenamiento · IG @crashpath · WhatsApp +57 …
      </Footer>
    </Page>
  );
}
