import { SessionProvider } from 'next-auth/react';
import styled, { createGlobalStyle } from 'styled-components';

const GlobalStyle = createGlobalStyle`
  /* Variables de fuente (los <link> están en _document.js) */
  :root {
    --font-body: 'Montserrat', system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif;
    --font-brush: 'Knewave', system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif;
  }

  /* Box-sizing consistente en toda la app */
  *, *::before, *::after { box-sizing: border-box; }

  html, body, #__next {
    height: 100%;
  }

  body {
    margin: 0;
    padding: 0;
    font-family: var(--font-body);
    background-color: #E5E5D1;
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
  }
`;

/* Fondo repetido, sin bloquear clics, y con control de escala */
const BackgroundLogo = styled.div`
  position: fixed;
  inset: 0;
  z-index: -1;
  pointer-events: none;

  background-image: url('/test1.png');
  background-repeat: repeat;
  background-position: center;

  /* Ajusta el tamaño del patrón a gusto:
     - 100% estira el tile al ancho completo (no suele ser ideal para repetir)
     - 320px 320px lo hace tipo patrón; cámbialo según tu asset */
  background-size: 320px 320px;

  /* Opcional: ligera transparencia si quieres que el contenido respire más */
  /* opacity: 0.06; */
`;

export default function App({ Component, pageProps: { session, ...pageProps } }) {
  return (
    <SessionProvider session={session}>
      <GlobalStyle />
      <BackgroundLogo />
      <Component {...pageProps} />
    </SessionProvider>
  );
}