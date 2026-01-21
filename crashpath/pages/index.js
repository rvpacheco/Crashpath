"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import styled, { createGlobalStyle } from "styled-components";

/** =========================
 * CrashPath Landing (from zero)
 * Quantum-ish layout:
 * - Full hero carousel
 * - Transparent header with centered logo
 * - Services tiles like "Collections" (5)
 * - About/Reservations section + video placeholder
 * - Day/Dark toggle (persisted)
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
    grain: 0.10,
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

const Page = styled.div`
  min-height: 100vh;
  position: relative;
  overflow-x: hidden;

  /* subtle grain */
  &::after{
    content:"";
    position:fixed;
    inset:0;
    pointer-events:none;
    z-index:0;
    opacity:${(p) => p.$t.grain};
    mix-blend-mode:${(p) => (p.$mode === "dark" ? "overlay" : "multiply")};
    background-image:
      repeating-linear-gradient(
        0deg,
        rgba(255,255,255,0.05),
        rgba(255,255,255,0.05) 1px,
        transparent 1px,
        transparent 3px
      );
  }
`;

const Header = styled.header`
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  z-index: 50;
  pointer-events: none; /* we will re-enable on children */
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

  @media (min-width: 860px){
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
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace;
  font-size: 12px;
  letter-spacing: 0.02em;
  color: ${(p) => p.$t.heroMuted};
  padding: 8px 10px;
  border-radius: 999px;
  border: 1px solid transparent;

  &:hover{
    color: ${(p) => p.$t.heroText};
    border-color: rgba(255,255,255,0.25);
    background: rgba(0,0,0,0.18);
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
  letter-spacing: 0.10em;
  text-transform: uppercase;
  color: ${(p) => p.$t.heroText};
  font-size: 12px;
`;

const LogoSub = styled.div`
  margin-top: 3px;
  font-weight: 900;
  letter-spacing: 0.22em;
  text-transform: uppercase;
  font-size: 10px;
  color: ${(p) => p.$t.heroMuted};
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace;
`;

const IconBtn = styled.button`
  width: 40px;
  height: 40px;
  border-radius: 12px;
  border: 1px solid rgba(255,255,255,0.20);
  background: rgba(0,0,0,0.22);
  color: ${(p) => p.$t.heroText};
  cursor: pointer;
  display: grid;
  place-items: center;
  font-weight: 900;

  &:hover { background: rgba(0,0,0,0.30); }
  &:focus-visible{
    outline: none;
    box-shadow: 0 0 0 4px ${(p) => p.$t.accent}33;
  }
`;

const CTA = styled(Link)`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 40px;
  padding: 9px 12px;
  border-radius: 999px;
  border: 1px solid rgba(255,255,255,0.22);
  background: rgba(0,0,0,0.22);
  color: ${(p) => p.$t.heroText};
  font-weight: 900;
  letter-spacing: 0.02em;
  font-size: 12px;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace;

  &:hover { background: rgba(0,0,0,0.30); }
`;

const Hero = styled.section`
  position: relative;
  height: 86vh;
  min-height: 560px;
  width: 100%;
  overflow: hidden;
  background: #000;
`;

const Slide = styled.div`
  position: absolute;
  inset: 0;
  background-image: url(${(p) => p.$src});
  background-size: cover;
  background-position: center;
  opacity: ${(p) => (p.$active ? 1 : 0)};
  transition: opacity 600ms ease;
  filter: ${(p) => (p.$mode === "dark" ? "contrast(1.05) saturate(1.0)" : "contrast(1.05) saturate(1.05)")};
`;

const HeroShade = styled.div`
  position: absolute;
  inset: 0;
  background: radial-gradient(1200px 700px at 50% 30%, rgba(0,0,0,0.10), ${(p) => p.$t.overlay});
`;

const HeroContent = styled.div`
  position: absolute;
  inset: 0;
  display: grid;
  align-content: end;
  justify-items: start;
  padding: 92px 14px 24px;
  z-index: 2;

  @media (min-width: 900px){
    padding: 96px 18px 36px;
  }
`;

const HeroBox = styled.div`
  max-width: 720px;
`;

const HeroTitle = styled.h1`
  margin: 0;
  color: ${(p) => p.$t.heroText};
  font-size: 34px;
  line-height: 1.02;
  letter-spacing: -0.02em;

  @media (min-width: 900px){
    font-size: 52px;
  }
`;

const HeroLead = styled.p`
  margin: 10px 0 0;
  color: ${(p) => p.$t.heroMuted};
  font-size: 13px;
  line-height: 1.7;
  max-width: 70ch;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace;

  @media (min-width: 900px){
    font-size: 14px;
  }
`;

const HeroActions = styled.div`
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
  margin-top: 14px;
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
  border: 1px solid ${(p) =>
    p.$kind === "primary" ? "transparent" : "rgba(255,255,255,0.22)"};
  background: ${(p) =>
    p.$kind === "primary"
      ? `linear-gradient(180deg, ${p.$t.accent}, ${p.$t.accent2})`
      : "rgba(0,0,0,0.22)"};
  color: ${(p) => p.$t.heroText};

  &:hover { filter: brightness(0.96); transform: translateY(-1px); }
`;

const Dots = styled.div`
  position: absolute;
  right: 16px;
  bottom: 16px;
  display: flex;
  gap: 8px;
  z-index: 3;
`;

const Dot = styled.button`
  width: 7px;
  height: 7px;
  border-radius: 999px;
  border: 1px solid rgba(255,255,255,0.45);
  background: ${(p) => (p.$active ? "rgba(255,255,255,0.90)" : "transparent")};
  cursor: pointer;
`;

const Section = styled.section`
  padding: 60px 14px;

  @media (min-width: 900px){
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

  @media (min-width: 900px){
    font-size: 34px;
  }
`;

const SectionKicker = styled.div`
  margin-top: 10px;
  text-align: center;
  color: ${(p) => p.$t.muted};
  font-size: 13px;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace;
`;

const Tiles = styled.div`
  margin-top: 26px;
  display: grid;
  gap: 16px;
  grid-template-columns: 1fr;

  @media (min-width: 760px){
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 18px;
  }

  @media (min-width: 1040px){
    grid-template-columns: repeat(12, minmax(0, 1fr));
    gap: 18px;
  }
`;

const TileWrap = styled.div`
  @media (min-width: 1040px){
    grid-column: span ${(p) => p.$span || 4};
  }
`;


const Tile = styled(Link)`
  position: relative;
  display: grid;
  align-content: end;
  border-radius: 22px;
  overflow: hidden;
  border: 1px solid ${(p) => p.$t.border};
  background: ${(p) => p.$t.panelSolid};

  /* 🔥 clave: consistencia visual */
  aspect-ratio: 16 / 9;
  min-height: 210px;

  box-shadow: ${(p) =>
    p.$mode === "dark"
      ? "0 18px 55px rgba(0,0,0,0.60)"
      : "0 14px 40px rgba(0,0,0,0.12)"};

  transform: translateZ(0);
  transition: transform 220ms ease, box-shadow 220ms ease, filter 220ms ease, border-color 220ms ease;

  &:hover{
    transform: translateY(-4px);
    border-color: ${(p) => (p.$mode === "dark" ? "rgba(255,255,255,0.22)" : "rgba(43,38,32,0.24)")};
    box-shadow: ${(p) =>
    p.$mode === "dark"
      ? "0 26px 80px rgba(0,0,0,0.70)"
      : "0 24px 70px rgba(0,0,0,0.16)"};
  }

  &:focus-visible{
    outline: none;
    box-shadow: 0 0 0 4px ${(p) => p.$t.accent}33, 0 18px 55px rgba(0,0,0,0.22);
  }
`;

const TileImg = styled.div`
  position: absolute;
  inset: 0;
  background-image: url(${(p) => p.$src});
  background-size: cover;
  background-position: center;
  transform: scale(1.02);
  transition: transform 420ms ease;
  filter: contrast(1.05) saturate(1.02);

  ${Tile}:hover & {
    transform: scale(1.07);
  }
`;

const TileShade = styled.div`
  position: absolute;
  inset: 0;
  background:
    radial-gradient(900px 420px at 15% 20%, rgba(0,0,0,0.10), transparent 60%),
    radial-gradient(900px 420px at 85% 10%, rgba(0,0,0,0.12), transparent 60%),
    linear-gradient(180deg, rgba(0,0,0,0.10) 0%, rgba(0,0,0,0.62) 75%, rgba(0,0,0,0.72) 100%);
`;

const TileTopRow = styled.div`
  position: absolute;
  top: 14px;
  left: 14px;
  right: 14px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 10px;
  z-index: 2;
`;

const TileLabel = styled.div`
  padding: 7px 10px;
  border-radius: 999px;
  border: 1px solid rgba(255,255,255,0.22);
  background: rgba(0,0,0,0.34);
  backdrop-filter: blur(8px);
  color: rgba(255,255,255,0.92);
  font-size: 12px;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace;
`;
const TileTitle = styled.div`
  color: rgba(255,255,255,0.96);
  font-weight: 950;
  font-size: 18px;
  letter-spacing: -0.01em;

  @media (min-width: 900px){
    font-size: 20px;
  }
`;

const TileSub = styled.div`
  color: rgba(255,255,255,0.80);
  font-size: 12px;
  line-height: 1.55;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace;

  /* para que no se vuelva un párrafo infinito */
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
`;
const TileArrow = styled.div`
  width: 38px;
  height: 38px;
  border-radius: 14px;
  border: 1px solid rgba(255,255,255,0.18);
  background: rgba(0,0,0,0.26);
  backdrop-filter: blur(8px);
  display: grid;
  place-items: center;
  color: rgba(255,255,255,0.92);
  font-weight: 900;
  transition: transform 220ms ease, background 220ms ease;

  ${Tile}:hover & {
    transform: translateY(-1px);
    background: rgba(0,0,0,0.34);
  }
`;


const TileContent = styled.div`
  position: relative;
  z-index: 2;
  padding: 16px;
  display: grid;
  gap: 8px;
`;


const AboutGrid = styled.div`
  margin-top: 26px;
  display: grid;
  gap: 16px;

  @media (min-width: 980px){
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

  li { margin: 6px 0; }
`;

const VideoBox = styled.div`
  border-radius: 18px;
  overflow: hidden;
  border: 1px solid ${(p) => p.$t.border};
  background: ${(p) => (p.$mode === "dark" ? "rgba(255,255,255,0.06)" : "rgba(255,255,255,0.55)")};
  min-height: 320px;
  display: grid;
  place-items: center;
  position: relative;
`;

const VideoHint = styled.div`
  color: ${(p) => p.$t.muted};
  font-size: 12px;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace;
  text-align: center;
  padding: 18px;
`;

const Footer = styled.footer`
  padding: 40px 14px 50px;
  text-align: center;
  color: ${(p) => p.$t.muted};
  font-size: 12px;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace;
`;

function getInitialMode() {
  if (typeof window === "undefined") return "day";
  const saved = window.localStorage.getItem("cp_theme");
  if (saved === "day" || saved === "dark") return saved;
  const prefersDark = window.matchMedia?.("(prefers-color-scheme: dark)")?.matches;
  return prefersDark ? "dark" : "day";
}

/** Replace these with your real images in /public */
const slides = [
  "/landing/hero-1.jpg",
  "/landing/hero-2.jpg",
  "/landing/hero-3.jpg",
];

const services = [
  {
    tag: "RESERVAS",
    title: "Moonboard Sessions",
    subtitle: "1h30 · cupos controlados · progreso medible.",
    href: "/reserve",
    img: "/landing/service-reserve.jpg",
    span: 6,
    tall: true,
  },
  {
    tag: "GUIADAS",
    title: "Trips & Guiadas",
    subtitle: "Roca + logística + coaching. Armamos grupos por nivel.",
    href: "/guides",
    img: "/landing/service-reserve.jpg",
    span: 6,
    tall: true,
  },
  {
    tag: "ENTRENOS",
    title: "Entrenos",
    subtitle: "Fuerza, resistencia y plan serio (sin humo).",
    href: "/training",
    img: "/landing/service-reserve.jpg",
    span: 4,
  },
  {
    tag: "SHOP",
    title: "Productos",
    subtitle: "Magnesio, straps, gear. Drops & collabs.",
    href: "/shop",
    img: "/landing/service-reserve.jpg",
    span: 4,
  },
  {
    tag: "STAY",
    title: "Hospedaje",
    subtitle: "Casa cerca de la roca para trips y temporadas.",
    href: "/stay",
    img: "/landing/service-reserve.jpg",
    span: 4,
  },
];

export default function CrashPathLanding() {
  const [mode, setMode] = useState("day");
  const t = useMemo(() => themes[mode], [mode]);

  const [idx, setIdx] = useState(0);
  const timerRef = useRef(null);

  useEffect(() => setMode(getInitialMode()), []);
  useEffect(() => {
    if (typeof window !== "undefined") window.localStorage.setItem("cp_theme", mode);
  }, [mode]);

  const toggleMode = () => setMode((m) => (m === "dark" ? "day" : "dark"));

  // auto-rotate hero
  useEffect(() => {
    // clear previous
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setIdx((i) => (i + 1) % slides.length);
    }, 5500);
    return () => timerRef.current && clearInterval(timerRef.current);
  }, []);

  const go = (i) => setIdx(i);

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

          {/* Center logo */}
          <CenterLogo>
            <LogoMark $t={t}>CRASHPATH</LogoMark>
            <LogoSub $t={t}>MOON</LogoSub>
          </CenterLogo>

          <NavRight>
            <IconBtn onClick={toggleMode} $t={t} aria-label="Cambiar tema">
              {mode === "dark" ? "☀" : "🌙"}
            </IconBtn>
            <CTA href="/login" $t={t}>LOGIN</CTA>
            <CTA href="/reserve" $t={t}>RESERVA</CTA>
          </NavRight>
        </HeaderInner>
      </Header>

      {/* HERO */}
      <Hero id="home">
        {slides.map((src, i) => (
          <Slide key={src} $src={src} $active={i === idx} $mode={mode} />
        ))}
        <HeroShade $t={t} />

        <HeroContent>
          <HeroBox>
            <HeroTitle $t={t}>
              CrashPath es marca. <br />
              No solo un muro.
            </HeroTitle>
            <HeroLead $t={t}>
              Reservas Moonboard, entrenos, guiadas a roca, productos y hospedaje.
              Vibra under pero pro — sin drama, con progreso.
            </HeroLead>

            <HeroActions>
              <HeroBtn href="#services" $t={t} $kind="ghost">
                VER SERVICIOS
              </HeroBtn>
              <HeroBtn href="/reserve" $t={t} $kind="primary">
                RESERVAR
              </HeroBtn>
            </HeroActions>
          </HeroBox>
        </HeroContent>

        <Dots>
          {slides.map((_, i) => (
            <Dot key={i} onClick={() => go(i)} $active={i === idx} aria-label={`Slide ${i + 1}`} />
          ))}
        </Dots>
      </Hero>

      {/* SERVICES (Collections-like) */}
      <Section id="services">
        <SectionInner>
          <SectionTitle>Servicios</SectionTitle>
          <SectionKicker $t={t}>
            5 líneas claras. click y te lleva. sin hablar paja.
          </SectionKicker>

          <Tiles>
            {services.map((s) => (
              <TileWrap key={s.title} $span={s.span} $tall={s.tall}>
                <Tile href={s.href} $t={t} $mode={mode}>
                  <TileImg $src={s.img} />
                  <TileShade />

                  <TileTopRow>
                    <TileLabel>{s.tag}</TileLabel>
                    <TileArrow>↗</TileArrow>
                  </TileTopRow>

                  <TileContent>
                    <TileTitle>{s.title}</TileTitle>
                    <TileSub>{s.subtitle}</TileSub>
                  </TileContent>
                </Tile>
              </TileWrap>
            ))}
          </Tiles>
        </SectionInner>
      </Section>

      {/* ABOUT / MOONBOARD & RESERVAS */}
      <Section id="about">
        <SectionInner>
          <SectionTitle>CrashPath Moon</SectionTitle>
          <SectionKicker $t={t}>
            un espacio de entrenamiento + una marca para escalar y salir a roca.
          </SectionKicker>

          <AboutGrid>
            <AboutCard $t={t} $mode={mode}>
              <AboutTitle>El muro, las reservas y el sistema</AboutTitle>
              <AboutText $t={t}>
                Creamos sesiones de 1h30 con cupos controlados para que entrenes sin caos.
                Si estás en modo performance, tienes entrenos y seguimiento. Si estás en modo
                aventura, te llevamos a roca con guiadas.
              </AboutText>
              <Bullets $t={t}>
                <li>Reservas simples, cupos claros, menos fricción.</li>
                <li>Entrenos (fuerza / resistencia / potencia) con progresión.</li>
                <li>Guiadas: logística + coaching + seguridad.</li>
                <li>Productos y hospedaje para temporadas.</li>
              </Bullets>
              <HeroActions style={{ marginTop: 14 }}>
                <HeroBtn href="/reserve" $t={t} $kind="primary">RESERVAR</HeroBtn>
                <HeroBtn href="/training" $t={t} $kind="ghost">VER ENTRENOS</HeroBtn>
              </HeroActions>
            </AboutCard>

            <VideoBox $t={t} $mode={mode}>
              {/* Reemplaza este bloque por <video ...> o embed */}
              <VideoHint $t={t}>
                VIDEO PLACEHOLDER<br />
                Aquí va un reel del Moonboard / trips / vibe de marca.<br />
                (pon un mp4 en /public/landing/intro.mp4 y lo incrustamos)
              </VideoHint>
            </VideoBox>
          </AboutGrid>
        </SectionInner>
      </Section>

      <Footer $t={t}>
        © {new Date().getFullYear()} CrashPath · Bucaramanga · IG @crashpath · WhatsApp +57 …
      </Footer>
    </Page>
  );
}
