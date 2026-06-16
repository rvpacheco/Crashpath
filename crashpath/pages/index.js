import { useState } from "react";
import Head from "next/head";
import Link from "next/link";
import styled, { createGlobalStyle } from "styled-components";
import Seo from "../components/Seo";
import LocalBusinessJsonLd from "../components/LocalBusinessJsonLd";

const themes = {
  day: {
    bg: "#E7E1D2",
    text: "#2B2620",
    muted: "#6B6257",
    border: "rgba(43,38,32,0.16)",
    panel: "rgba(255,255,255,0.55)",
    accent: "#9C4F24",
    accent2: "#C26A34",
    heroText: "rgba(255,255,255,0.92)",
    heroMuted: "rgba(255,255,255,0.72)",
    focus: "rgba(156,79,36,0.20)",
  },
};
const t = themes.day;

const GlobalStyle = createGlobalStyle`
  :root { color-scheme: light; }
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
  position: relative;
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

const MenuButton = styled.button`
  pointer-events: auto;
  justify-self: end;
  grid-column: 3;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 42px;
  height: 42px;
  border-radius: 12px;
  cursor: pointer;
  color: ${(p) => p.$t.heroText};
  border: 1px solid rgba(255, 255, 255, 0.22);
  background: rgba(10, 10, 10, 0.28);
  backdrop-filter: blur(10px);

  &:focus-visible {
    outline: none;
    box-shadow: 0 0 0 4px rgba(255, 255, 255, 0.18);
  }

  @media (min-width: 860px) {
    display: none;
  }
`;

const MobileMenu = styled.nav`
  pointer-events: auto;
  position: absolute;
  top: calc(100% - 4px);
  right: 14px;
  z-index: 60;
  display: grid;
  gap: 2px;
  padding: 8px;
  min-width: 180px;
  border-radius: 14px;
  border: 1px solid rgba(255, 255, 255, 0.16);
  background: rgba(10, 10, 10, 0.82);
  backdrop-filter: blur(14px);
  box-shadow: 0 18px 50px rgba(0, 0, 0, 0.4);

  @media (min-width: 860px) {
    display: none;
  }
`;

const MobileLink = styled.a`
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas,
    "Liberation Mono", monospace;
  font-size: 13px;
  letter-spacing: 0.02em;
  color: ${(p) => p.$t.heroMuted};
  padding: 12px 12px;
  border-radius: 10px;

  &:hover {
    color: ${(p) => p.$t.heroText};
    background: rgba(255, 255, 255, 0.08);
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

const HeroBg = styled.div`
  position: absolute;
  inset: 0;
  background-image: url(${(p) => p.$src});
  background-size: cover;
  background-position: center 35%;
  filter: contrast(1.05) saturate(1.05);
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
  border: 1px solid ${(p) => (p.$highlight ? p.$t.accent : p.$t.border)};
  border-radius: 20px;
  background: ${(p) => p.$t.panel};
  padding: 24px 20px;
  backdrop-filter: blur(10px);
  display: grid;
  gap: 10px;
  box-shadow: ${(p) =>
    p.$highlight
      ? `0 0 0 1px ${p.$t.accent}44, 0 20px 60px rgba(0,0,0,0.12)`
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
  border: 1px solid
    ${(p) => (p.$kind === "primary" ? "transparent" : p.$t.border)};
  background: ${(p) =>
    p.$kind === "primary"
      ? `linear-gradient(180deg, ${p.$t.accent}, ${p.$t.accent2})`
      : "transparent"};
  color: ${(p) => (p.$kind === "primary" ? "#fff" : p.$t.text)};
  transition: filter 180ms ease, transform 180ms ease;

  &:hover {
    filter: brightness(0.94);
    transform: translateY(-1px);
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
  box-shadow: 0 14px 40px rgba(0, 0, 0, 0.1);
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
  background: rgba(255, 255, 255, 0.55);
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

const FooterLink = styled.a`
  color: ${(p) => p.$t.accent};
  font-weight: 700;

  &:hover {
    text-decoration: underline;
  }
`;

/** Replace these with your real images in /public */
const heroImage = "/landing/hero-2.jpg";

const WHATSAPP_URL = "https://wa.me/573208608016";
const INSTAGRAM_URL = "https://www.instagram.com/crash_path/";

export default function CrashPathLanding() {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <Page $t={t}>
      <Seo
        description="Gimnasio de escalada en Bucaramanga: MoonBoard 25° y 40°, placa principal y guiadas a roca natural. Entrena de 3 a 9 PM, de lunes a sábado. Todos los niveles."
        path="/"
        keywords="escalada Bucaramanga, gimnasio de escalada, rocódromo, MoonBoard, boulder, escalada en roca, climbing gym Colombia"
      />
      <LocalBusinessJsonLd />
      <Head>
        {/* Precarga del hero (LCP): la imagen va vía CSS-in-JS y el navegador
            la descubre tarde; este hint la baja antes. */}
        <link rel="preload" as="image" href={heroImage} fetchpriority="high" />
      </Head>
      <GlobalStyle $t={t} />

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

          <MenuButton
            $t={t}
            type="button"
            aria-label="Abrir menú"
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((v) => !v)}
          >
            {menuOpen ? (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <line x1="6" y1="6" x2="18" y2="18" />
                <line x1="18" y1="6" x2="6" y2="18" />
              </svg>
            ) : (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <line x1="3" y1="6" x2="21" y2="6" />
                <line x1="3" y1="12" x2="21" y2="12" />
                <line x1="3" y1="18" x2="21" y2="18" />
              </svg>
            )}
          </MenuButton>

          {menuOpen && (
            <MobileMenu>
              <Link href="#home" passHref legacyBehavior>
                <MobileLink $t={t} onClick={() => setMenuOpen(false)}>Home</MobileLink>
              </Link>
              <Link href="#services" passHref legacyBehavior>
                <MobileLink $t={t} onClick={() => setMenuOpen(false)}>Servicios</MobileLink>
              </Link>
              <Link href="#about" passHref legacyBehavior>
                <MobileLink $t={t} onClick={() => setMenuOpen(false)}>CrashPath</MobileLink>
              </Link>
            </MobileMenu>
          )}
        </HeaderInner>
      </Header>

      {/* HERO */}
      <Hero id="home">
        <HeroBg $src={heroImage} />
        <HeroShade $t={t} />

        <HeroContent>
          <HeroBox>
            <HeroTitle>
              CrashPath
              <br />
              Gimnasio de Escalada
            </HeroTitle>

            <HeroLocation>
              📍 Bucaramanga, Colombia · Roca natural · Guiadas en español &
              English
            </HeroLocation>

            <HeroPill>
              <PillPrimary href="/reservas">REGISTRAR VISITA</PillPrimary>
              <PillDivider />
              <PillLink
                as="a"
                href={WHATSAPP_URL}
                target="_blank"
                rel="noopener noreferrer"
              >
                MAÑANAS (WA)
              </PillLink>
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
            <ServiceBlock $t={t}>
              <ServiceTag $t={t}>GIMNASIO</ServiceTag>
              <ServiceName $t={t}>Entrenamiento Libre</ServiceName>
              <ServiceDesc $t={t}>
                Escala cuando quieras dentro del horario de tarde. MoonBoard a
                25° y 40°, placa principal, enfoque en progreso real. Sin
                reserva previa — llegas y entrenas.
              </ServiceDesc>
              <ServiceMeta $t={t}>
                Lunes a Sábado · 3:00 PM – 9:00 PM
              </ServiceMeta>
              <ServiceCTA href="/reservas" $t={t} $kind="primary">
                REGISTRAR VISITA
              </ServiceCTA>
            </ServiceBlock>

            {/* ENTRENAMIENTO */}
            <ServiceBlock $t={t}>
              <ServiceTag $t={t}>ENTRENAMIENTO</ServiceTag>
              <ServiceName $t={t}>Programación Enfocada</ServiceName>
              <ServiceDesc $t={t}>
                Fuerza de dedos, resistencia y técnica aplicada a la escalada.
                Rutinas diseñadas para escalar mejor en roca y placa. Para todos
                los niveles.
              </ServiceDesc>
              <ServiceMeta $t={t}>Incluido con acceso al gym</ServiceMeta>
              <ServiceCTA href="#about" $t={t} $kind="ghost">
                CÓMO FUNCIONA
              </ServiceCTA>
            </ServiceBlock>

            {/* GUIADAS */}
            <ServiceBlock $t={t} $highlight>
              <ServiceTag $t={t} $highlight>
                GUIADAS · TRIPS
              </ServiceTag>
              <ServiceName $t={t}>Escalada en Roca Real</ServiceName>
              <ServiceDesc $t={t}>
                Salidas a roca natural cerca de Bucaramanga. Grupos por nivel,
                logística incluida. Ideal para visitantes y extranjeros. Guías
                en español e inglés.
              </ServiceDesc>
              <ServiceMeta $t={t}>
                📍 Bucaramanga, Colombia · Sport climbing
              </ServiceMeta>
              <ServiceCTA
                as="a"
                href={WHATSAPP_URL}
                target="_blank"
                rel="noopener noreferrer"
                $t={t}
                $kind="primary"
              >
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
            Ya no trabajamos por horas. Llegas, entrenas y te enfocas en tu
            progreso.
          </SectionKicker>

          <AboutGrid>
            <AboutCard $t={t}>
              <AboutTitle>Entrenamiento en CrashPath</AboutTitle>

              <AboutText $t={t}>
                CrashPath ahora es un gimnasio de escalada enfocado en
                entrenamiento real. Puedes escalar libremente dentro del horario
                de la tarde (<b>3:00 PM – 9:00 PM</b>), usando tanto la{" "}
                <b>MoonBoard</b> como nuestra <b>placa principal</b>.
                <br />
                <br />
                Para mañanas, escríbenos por WhatsApp y coordinamos según
                disponibilidad.
              </AboutText>

              <Bullets $t={t}>
                <li>Acceso libre en horario de tarde (3pm–9pm).</li>
                <li>MoonBoard a 25° y 40° disponible.</li>
                <li>Nueva placa principal de escalada.</li>
                <li>Enfoque en técnica, fuerza y resistencia.</li>
                <li>Para entrenar en la mañana: coordinación por WhatsApp.</li>
              </Bullets>

              <HeroActions style={{ marginTop: 14 }}>
                <HeroBtn href="/reservas" $t={t} $kind="primary">
                  REGISTRAR VISITA
                </HeroBtn>
                <HeroBtn
                  as="a"
                  href={WHATSAPP_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  $t={t}
                  $kind="ghost"
                >
                  WHATSAPP (MAÑANAS)
                </HeroBtn>
              </HeroActions>
            </AboutCard>

            {/*
              Slot de video. Cuando tengas el reel:
              pon un mp4 en /public/landing/intro.mp4 y reemplaza el
              VideoHint por:
              <video src="/landing/intro.mp4" autoPlay muted loop playsInline
                style={{ width: "100%", height: "100%", objectFit: "cover" }} />
            
            
            <VideoBox $t={t}>
              <VideoHint $t={t}>
                VIDEO PLACEHOLDER
                <br />
                Aquí va un reel de la placa / MoonBoard / vibe del gimnasio.
              </VideoHint>
            </VideoBox>
            */}
          </AboutGrid>
        </SectionInner>
      </Section>

      <Footer $t={t}>
        © {new Date().getFullYear()} CrashPath · Bucaramanga · Gimnasio de
        Escalada y Entrenamiento ·{" "}
        <FooterLink
          as="a"
          href={INSTAGRAM_URL}
          target="_blank"
          rel="noopener noreferrer"
          $t={t}
        >
          IG @crash_path
        </FooterLink>{" "}
        ·{" "}
        <FooterLink
          as="a"
          href={WHATSAPP_URL}
          target="_blank"
          rel="noopener noreferrer"
          $t={t}
        >
          WhatsApp +57 320 8608016
        </FooterLink>
      </Footer>
    </Page>
  );
}