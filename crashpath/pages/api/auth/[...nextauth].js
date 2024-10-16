//auth/[...nextauth].js
import NextAuth from 'next-auth';
import GoogleProvider from 'next-auth/providers/google';
import axios from 'axios';
import { getSession } from 'next-auth/react'; // Cambia o añade esta importación


// Lista de correos electrónicos de administradores
const adminEmails = [' santistebanfabi@gmail.com','jeevanobando97@gmail.com','mattucm01@gmail.com','rvpacheco17@gmail.com'];

// Función para refrescar el token de acceso
async function refreshAccessToken(token) {
  try {
    const url = 'https://oauth2.googleapis.com/token';
    const response = await axios.post(url, {
      client_id: process.env.GOOGLE_CLIENT_ID,
      client_secret: process.env.GOOGLE_CLIENT_SECRET,
      refresh_token: token.refreshToken,
      grant_type: 'refresh_token',
    });

    const refreshedTokens = response.data;

    return {
      ...token,
      accessToken: refreshedTokens.access_token,
      accessTokenExpires: Date.now() + refreshedTokens.expires_in * 1000,  // Expira en 1 hora
      refreshToken: refreshedTokens.refresh_token ?? token.refreshToken,  // Usar el refresh token anterior si no se proporciona uno nuevo
    };
  } catch (error) {
    console.error('Error refreshing access token:', error);
    return {
      ...token,
      error: 'RefreshAccessTokenError',
    };
  }
}

// Configuración de NextAuth
export default NextAuth({
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      authorization: {
        params: {
          scope: 'openid email profile https://www.googleapis.com/auth/calendar.events',
          access_type: 'offline',  // Asegúrate de solicitar acceso offline para obtener un refresh token
          prompt: 'consent',       // Forzar a Google para que solicite consentimiento y obtener refresh token
        },
      },
    }),
  ],
  secret: process.env.NEXTAUTH_SECRET,
  session: {
    strategy: 'jwt',
  },
  callbacks: {
    async jwt({ token, account, user }) {
      // Si es el primer inicio de sesión, adjunta los datos del usuario al token
      if (account && user) {
        return {
          ...token,
          accessToken: account.access_token,
          accessTokenExpires: Date.now() + account.expires_in * 1000,
          refreshToken: account.refresh_token,
          user: { name: user.name, email: user.email },  // Adjuntar detalles del usuario
          isAdmin: adminEmails.includes(user.email), // Verificar si es admin y adjuntar al token
        };
      }

      // Si el token aún no ha expirado, devolverlo tal cual
      if (Date.now() < token.accessTokenExpires) {
        return token;
      }

      // Refrescar el token si ha expirado
      return refreshAccessToken(token);
    },
    async session({ session, token }) {
      // Adjuntar el usuario y el token de acceso a la sesión
      session.user = token.user;
      session.user.role = token.role;
      session.accessToken = token.accessToken;
      session.error = token.error;
      session.isAdmin = token.isAdmin; // Adjuntar el flag de admin a la sesión
      return session;
    },
  },
});

// Función para verificar si la solicitud proviene de un administrador
export async function isAdminRequest(req, res) {
  try {
    // Obtener la sesión actual
    const session = await getSession({ req });

    // Verificar si el usuario tiene un correo y si pertenece a los administradores
    if (!session?.user?.email || !adminEmails.includes(session.user.email)) {
      return res.status(401).json({ message: 'No autorizado' });
    }
  } catch (error) {
    console.error('Error verificando el administrador:', error.message);
    return res.status(500).json({ message: 'Error en el servidor' });
  }
}
