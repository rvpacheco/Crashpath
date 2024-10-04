import { SessionProvider } from 'next-auth/react';
import styled, { createGlobalStyle } from 'styled-components';

const GlobalStyle = createGlobalStyle`
  body {
    margin: 0;
    padding: 0;
    box-sizing: border-box;
    font-family: 'Arial', sans-serif;
    background-color: #f4f4f9;
  }
`;



const BackgroundLogo = styled.div`
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background-image: url('/AI LOGO_Mesa de trabajo 1.png');
  background-repeat: no-repeat;
  background-position: center;
  background-size: 50%; /* Ajusta el tamaño del logo según sea necesario */
  opacity: 0.1; /* Visibilidad del 20% */
  z-index: -1 ;

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
