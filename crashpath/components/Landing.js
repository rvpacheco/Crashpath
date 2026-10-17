import { useEffect, useState } from "react";
import Head from "next/head";
import Link from "next/link";
import styled, { createGlobalStyle } from "styled-components";
import Seo from "./Seo";
import LocalBusinessJsonLd from "./LocalBusinessJsonLd";
import { COPY } from "../lib/landingCopy";

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
  pointer-events: ${(p) => (p.$solid ? "auto" : "none")};
  background: ${(p) => (p.$solid ? `${p.$t.bg}eb` : "transparent")};
  border-bottom: 1px solid ${(p) => (p.$solid ? p.$t.border : "transparent")};
  backdrop-filter: ${(p) => (p.$solid ? "blur(10px)" : "none")};
  transition: background 200ms ease, border-color 200ms ease;
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
  color: ${(p) => (p.$solid ? p.$t.muted : p.$t.heroMuted)};
  padding: 8px 10px;
  border-radius: 999px;
  border: 1px solid transparent;
  transition: color 200ms ease;

  &:hover {
    color: ${(p) => (p.$solid ? p.$t.text : p.$t.heroText)};
    border-color: ${(p) =>
      p.$solid ? p.$t.border : "rgba(255, 255, 255, 0.25)"};
    background: ${(p) => (p.$solid ? p.$t.panel : "rgba(0, 0, 0, 0.18)")};
  }
`;

const CenterLogo = styled.div`
  grid-column: 2;
  pointer-events: auto;
  display: grid;
  place-items: center;
  text-align: center;
`;

const LogoMark = styled.div`
  font-weight: 950;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: ${(p) => (p.$solid ? p.$t.text : p.$t.heroText)};
  font-size: 12px;
  transition: color 200ms ease;
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
  color: ${(p) => (p.$solid ? p.$t.text : p.$t.heroText)};
  border: 1px solid
    ${(p) => (p.$solid ? p.$t.border : "rgba(255, 255, 255, 0.22)")};
  background: ${(p) => (p.$solid ? p.$t.panel : "rgba(10, 10, 10, 0.28)")};
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
  background-image: url(${(p) => p.$desktop});
  background-size: cover;
  background-position: center 35%;
  filter: contrast(1.05) saturate(1.05);

  /* Versión ya recortada en vertical: el celular no baja la foto de escritorio. */
  @media (max-width: 600px) {
    background-image: url(${(p) => p.$mobile});
  }
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
  /* El menú es fijo (75px en celular): sin esto, al tocar un enlace del menú el
     título de la sección queda tapado por la barra. */
  scroll-margin-top: 40px;

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

const Price = styled.div`
  margin-top: 4px;
  font-weight: 900;
  letter-spacing: -0.02em;
  font-size: 32px;
  color: ${(p) => p.$t.text};

  span {
    font-size: 13px;
    font-weight: 700;
    color: ${(p) => p.$t.muted};
    letter-spacing: 0;
  }
`;

const PriceDetail = styled.div`
  font-size: 13px;
  line-height: 1.7;
  color: ${(p) => p.$t.muted};
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

const FooterLinks = styled.div`
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 0 6px;
  margin-top: 4px;
`;

const FooterLink = styled.a`
  color: ${(p) => p.$t.accent};
  font-weight: 700;
  /* Zona táctil de 44px: como texto suelto medía 14px y era fácil fallar. */
  display: inline-flex;
  align-items: center;
  min-height: 44px;
  padding: 0 8px;

  &:hover {
    text-decoration: underline;
  }
`;

// Dos versiones del hero en WebP (120 KB y 185 KB). El JPG original pesaba
// 1,27 MB y llevaba el LCP en móvil a 10 s. El corte de 600px debe ser el
// mismo en el CSS de HeroBg y en la precarga de abajo.
const heroImageMobile = "/landing/hero-2-movil.webp";
const heroImageDesktop = "/landing/hero-2-escritorio.webp";

const WHATSAPP_URL = "https://wa.me/573208608016";
const INSTAGRAM_URL = "https://www.instagram.com/crash_path/";

// **texto** -> <b>texto</b>. Los textos viven en lib/landingCopy.js.
function rich(texto) {
  return texto.split("**").map((parte, i) => (i % 2 ? <b key={i}>{parte}</b> : parte));
}

export default function Landing({ lang = "es" }) {
  const c = COPY[lang];
  const otro = lang === "es" ? "en" : "es";
  const [menuOpen, setMenuOpen] = useState(false);
  // El menú es transparente con texto blanco, pensado para ir sobre la foto.
  // Cuando el hero sale de la pantalla le damos fondo claro y texto oscuro.
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const hero = document.getElementById("home");
    if (!hero || typeof IntersectionObserver === "undefined") return;
    const obs = new IntersectionObserver(
      ([entry]) => setScrolled(!entry.isIntersecting),
      { rootMargin: "-72px 0px 0px 0px" }
    );
    obs.observe(hero);
    return () => obs.disconnect();
  }, []);

  return (
    <Page $t={t}>
      <Seo
        title={c.seo.title}
        description={c.seo.description}
        path={c.seo.path}
        keywords={c.seo.keywords}
        locale={c.seo.locale}
        alternates={{ es: "/", en: "/en" }}
      />
      <LocalBusinessJsonLd description={c.jsonLdDescription} />
      <Head>
        {/* Precarga del hero (LCP): la imagen va vía CSS-in-JS y el navegador
            la descubre tarde; este hint la baja antes. */}
        <link rel="preload" as="image" href={heroImageMobile} media="(max-width: 600px)" fetchpriority="high" />
        <link rel="preload" as="image" href={heroImageDesktop} media="(min-width: 601px)" fetchpriority="high" />
      </Head>
      <GlobalStyle $t={t} />

      {/* Header fijo: transparente sobre el hero, con fondo al bajar */}
      <Header $t={t} $solid={scrolled}>
        <HeaderInner>
          <NavLeft>
            <Link href="#home" passHref legacyBehavior>
              <NavLink $t={t} $solid={scrolled}>{c.nav.home}</NavLink>
            </Link>
            <Link href="#services" passHref legacyBehavior>
              <NavLink $t={t} $solid={scrolled}>{c.nav.services}</NavLink>
            </Link>
            <Link href="#precios" passHref legacyBehavior>
              <NavLink $t={t} $solid={scrolled}>{c.nav.pricing}</NavLink>
            </Link>
            <Link href="#about" passHref legacyBehavior>
              <NavLink $t={t} $solid={scrolled}>{c.nav.about}</NavLink>
            </Link>
            <NavLink
              href={c.langSwitch.href}
              hrefLang={c.langSwitch.hrefLang}
              lang={c.langSwitch.hrefLang}
              title={c.langSwitch.title}
              $t={t}
              $solid={scrolled}
            >
              {c.langSwitch.label}
            </NavLink>
          </NavLeft>

          <CenterLogo>
            <LogoMark $t={t} $solid={scrolled}>CRASHPATH</LogoMark>
          </CenterLogo>

          <MenuButton
            $t={t}
            $solid={scrolled}
            type="button"
            aria-label={c.nav.openMenu}
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
                <MobileLink $t={t} onClick={() => setMenuOpen(false)}>{c.nav.home}</MobileLink>
              </Link>
              <Link href="#services" passHref legacyBehavior>
                <MobileLink $t={t} onClick={() => setMenuOpen(false)}>{c.nav.services}</MobileLink>
              </Link>
              <Link href="#precios" passHref legacyBehavior>
                <MobileLink $t={t} onClick={() => setMenuOpen(false)}>{c.nav.pricing}</MobileLink>
              </Link>
              <Link href="#about" passHref legacyBehavior>
                <MobileLink $t={t} onClick={() => setMenuOpen(false)}>{c.nav.about}</MobileLink>
              </Link>
              <MobileLink
                href={c.langSwitch.href}
                hrefLang={c.langSwitch.hrefLang}
                lang={c.langSwitch.hrefLang}
                title={c.langSwitch.title}
                $t={t}
              >
                {c.langSwitch.label}
              </MobileLink>
            </MobileMenu>
          )}
        </HeaderInner>
      </Header>

      {/* HERO */}
      <Hero id="home">
        <HeroBg $mobile={heroImageMobile} $desktop={heroImageDesktop} />
        <HeroShade $t={t} />

        <HeroContent>
          <HeroBox>
            <HeroTitle>
              CrashPath
              <br />
              {c.hero.title}
            </HeroTitle>

            <HeroLocation>
              {c.hero.location}
            </HeroLocation>

            <HeroPill>
              <PillPrimary href="/reservas">{c.hero.register}</PillPrimary>
              <PillDivider />
              <PillLink
                as="a"
                href={WHATSAPP_URL}
                target="_blank"
                rel="noopener noreferrer"
              >
                {c.hero.mornings}
              </PillLink>
            </HeroPill>

            <HeroActions>
              <HeroBtn href="#services" $t={t} $kind="ghost">
                {c.hero.seeServices}
              </HeroBtn>
              <HeroBtn href="#about" $t={t} $kind="primary">
                {c.hero.howItWorks}
              </HeroBtn>
            </HeroActions>
          </HeroBox>
        </HeroContent>
      </Hero>

      {/* SERVICES */}
      <Section id="services">
        <SectionInner>
          <SectionTitle>{c.services.title}</SectionTitle>
          <SectionKicker $t={t}>{c.services.kicker}</SectionKicker>

          <ServiceGrid>
            {/* GIMNASIO */}
            <ServiceBlock $t={t}>
              <ServiceTag $t={t}>{c.services.gym.tag}</ServiceTag>
              <ServiceName $t={t}>{c.services.gym.name}</ServiceName>
              <ServiceDesc $t={t}>{c.services.gym.desc}</ServiceDesc>
              <ServiceMeta $t={t}>{c.services.gym.meta}</ServiceMeta>
              <ServiceCTA href="/reservas" $t={t} $kind="primary">
                {c.services.gym.cta}
              </ServiceCTA>
            </ServiceBlock>

            {/* ENTRENAMIENTO */}
            <ServiceBlock $t={t}>
              <ServiceTag $t={t}>{c.services.training.tag}</ServiceTag>
              <ServiceName $t={t}>{c.services.training.name}</ServiceName>
              <ServiceDesc $t={t}>{c.services.training.desc}</ServiceDesc>
              <ServiceMeta $t={t}>{c.services.training.meta}</ServiceMeta>
              <ServiceCTA href="#about" $t={t} $kind="ghost">
                {c.services.training.cta}
              </ServiceCTA>
            </ServiceBlock>

            {/* GUIADAS */}
            <ServiceBlock $t={t} $highlight>
              <ServiceTag $t={t} $highlight>
                {c.services.guided.tag}
              </ServiceTag>
              <ServiceName $t={t}>{c.services.guided.name}</ServiceName>
              <ServiceDesc $t={t}>{c.services.guided.desc}</ServiceDesc>
              <ServiceMeta $t={t}>{c.services.guided.meta}</ServiceMeta>
              <ServiceCTA
                as="a"
                href={WHATSAPP_URL}
                target="_blank"
                rel="noopener noreferrer"
                $t={t}
                $kind="primary"
              >
                {c.services.guided.cta}
              </ServiceCTA>
            </ServiceBlock>
          </ServiceGrid>
        </SectionInner>
      </Section>

      {/* PRECIOS */}
      <Section id="precios">
        <SectionInner>
          <SectionTitle>{c.prices.title}</SectionTitle>
          <SectionKicker $t={t}>{c.prices.kicker}</SectionKicker>

          <ServiceGrid>
            {/* PASE DEL DÍA */}
            <ServiceBlock $t={t}>
              <ServiceTag $t={t}>{c.prices.day.tag}</ServiceTag>
              <ServiceName $t={t}>{c.prices.day.name}</ServiceName>
              <Price $t={t}>
                {c.prices.day.price} <span>{c.prices.day.note}</span>
              </Price>
              <PriceDetail $t={t}>{c.prices.day.detail}</PriceDetail>
              <ServiceMeta $t={t}>{c.prices.day.meta}</ServiceMeta>
              <ServiceCTA href="/reservas" $t={t} $kind="primary">
                {c.prices.day.cta}
              </ServiceCTA>
            </ServiceBlock>

            {/* TICKETERA */}
            <ServiceBlock $t={t}>
              <ServiceTag $t={t}>{c.prices.pack.tag}</ServiceTag>
              <ServiceName $t={t}>{c.prices.pack.name}</ServiceName>
              <Price $t={t}>
                {c.prices.pack.price} <span>{c.prices.pack.note}</span>
              </Price>
              <PriceDetail $t={t}>{c.prices.pack.detail}</PriceDetail>
              <ServiceMeta $t={t}>{c.prices.pack.meta}</ServiceMeta>
              <ServiceCTA href="/reservas" $t={t} $kind="ghost">
                {c.prices.pack.cta}
              </ServiceCTA>
            </ServiceBlock>

            {/* MENSUALIDAD */}
            <ServiceBlock $t={t} $highlight>
              <ServiceTag $t={t} $highlight>
                {c.prices.month.tag}
              </ServiceTag>
              <ServiceName $t={t}>{c.prices.month.name}</ServiceName>
              <Price $t={t}>
                {c.prices.month.price} <span>{c.prices.month.note}</span>
              </Price>
              <PriceDetail $t={t}>{c.prices.month.detail}</PriceDetail>
              <ServiceMeta $t={t}>{c.prices.month.meta}</ServiceMeta>
              <ServiceCTA href="/reservas" $t={t} $kind="primary">
                {c.prices.month.cta}
              </ServiceCTA>
            </ServiceBlock>
          </ServiceGrid>
        </SectionInner>
      </Section>

      {/* ABOUT / HOW IT WORKS NOW */}
      <Section id="about">
        <SectionInner>
          <SectionTitle>{c.about.title}</SectionTitle>
          <SectionKicker $t={t}>{c.about.kicker}</SectionKicker>

          <AboutGrid>
            <AboutCard $t={t}>
              <AboutTitle>{c.about.cardTitle}</AboutTitle>

              <AboutText $t={t}>
                {rich(c.about.p1)}
                <br />
                <br />
                {c.about.p2}
              </AboutText>

              <Bullets $t={t}>
                {c.about.bullets.map((b) => (
                  <li key={b}>{b}</li>
                ))}
              </Bullets>

              <HeroActions style={{ marginTop: 14 }}>
                {/* ServiceCTA y no HeroBtn: el ghost de HeroBtn es texto blanco
                    para ir sobre la foto y en esta tarjeta clara no se lee. */}
                <ServiceCTA href="/reservas" $t={t} $kind="primary">
                  {c.about.register}
                </ServiceCTA>
                <ServiceCTA
                  as="a"
                  href={WHATSAPP_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  $t={t}
                  $kind="ghost"
                >
                  {c.about.whatsapp}
                </ServiceCTA>
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
        © {new Date().getFullYear()} {c.footer.line}
        <FooterLinks>
          <FooterLink
            href={INSTAGRAM_URL}
            target="_blank"
            rel="noopener noreferrer"
            $t={t}
          >
            {c.footer.instagram}
          </FooterLink>
          <FooterLink
            href={WHATSAPP_URL}
            target="_blank"
            rel="noopener noreferrer"
            $t={t}
          >
            {c.footer.whatsapp}
          </FooterLink>
        </FooterLinks>
      </Footer>
    </Page>
  );
}