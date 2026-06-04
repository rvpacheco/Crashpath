import { SessionProvider } from 'next-auth/react';
import Head from 'next/head';
import styled, { createGlobalStyle } from 'styled-components';

const GlobalStyle = createGlobalStyle`
  /* Variables de fuente (los <link> están en _document.js) */
  :root {
    --font-body: 'Montserrat', system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif;
    --font-brush: 'Knewave', system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif;
  }

  *, *::before, *::after { box-sizing: border-box; }

  html, body, #__next { height: 100%; }

  body {
    margin: 0;
    padding: 0;
    font-family: var(--font-body);
    background-color: #E5E5D1;
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
  }
`;

/* Fondo repetido, sin bloquear clics, con control de escala */
const BackgroundLogo = styled.div`
  position: fixed;
  inset: 0;
  z-index: -1;
  pointer-events: none;
  background-image: url('/test1.png');
  background-repeat: repeat;
  background-position: center;
  background-size: 320px 320px;
`;

export default function App({ Component, pageProps: { session, ...pageProps } }) {
  return (
    <SessionProvider session={session}>
      {/*
        OJO: aquí SOLO van meta-tags GLOBALES (iguales en toda la app).
        El title, description, keywords y canonical van por página con el
        componente <Seo />, porque si los pones acá todas las rutas heredan
        el mismo title/canonical y Google las trata como duplicadas.
      */}
      <Head>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="author" content="CrashPath" />
        <meta name="theme-color" content="#E5E5D1" />

        {/* Open Graph: solo lo que no cambia entre páginas */}
        <meta property="og:type" content="website" />
        <meta property="og:site_name" content="CrashPath" />
        <meta property="og:locale" content="es_CO" />

        {/* Iconos */}
        <link rel="icon" href="/favicon.ico" />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
      </Head>

      <GlobalStyle />
      <BackgroundLogo />
      <Component {...pageProps} />
    </SessionProvider>
  );
}