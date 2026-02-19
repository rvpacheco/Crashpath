//auth/[...nextauth].js
import NextAuth from 'next-auth';
import GoogleProvider from 'next-auth/providers/google';
import axios from 'axios';
import { getToken } from "next-auth/jwt";
import { getSession } from 'next-auth/react'; // Cambia o añade esta importación


// Lista de correos electrónicos de administradores
const adminEmails = [
  "santistebanfabi@gmail.com",
  "jeevanobando97@gmail.com",
  "mattucm01@gmail.com",
  "rvpacheco17@gmail.com",
].map((e) => e.trim().toLowerCase());

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
    // primer login
    if (account && user) {
      const email = String(user.email || "").trim().toLowerCase();

      return {
        ...token,
        accessToken: account.access_token,
        accessTokenExpires: Date.now() + (Number(account.expires_in || 3600) * 1000),
        refreshToken: account.refresh_token ?? token.refreshToken, // conserva el anterior si no viene
        user: { name: user.name, email },
        isAdmin: adminEmails.includes(email),
      };
    }

    // si no tenemos expiración, no intentes refrescar
    if (!token.accessTokenExpires) return token;

    // token vigente
    if (Date.now() < token.accessTokenExpires) return token;

    // refrescar
    return refreshAccessToken(token);
  },

  async session({ session, token }) {
    session.user = token.user || session.user;
    session.accessToken = token.accessToken;
    session.error = token.error;
    session.isAdmin = !!token.isAdmin;
    return session;
  },
},
});

// Función para verificar si la solicitud proviene de un administrador
export async function isAdminRequest(req, res) {
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });

  const email = String(token?.user?.email || token?.email || "")
    .trim()
    .toLowerCase();

  if (!email || !adminEmails.includes(email)) {
    res.status(401).json({ message: "No autorizado" });
    throw new Error("Not authorized");
  }
}
