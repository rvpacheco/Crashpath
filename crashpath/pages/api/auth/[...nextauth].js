// pages/api/auth/[...nextauth].js
import NextAuth from 'next-auth';
import GoogleProvider from 'next-auth/providers/google';
import axios from 'axios';
import { getToken } from "next-auth/jwt";

const adminEmails = [
  "santistebanfabi@gmail.com",
  "jeevanobando97@gmail.com",
  "mattucm01@gmail.com",
  "mattucm@hotmail.com",
  "rvpacheco17@gmail.com",
  "jdba.94@gmail.com"
].map((e) => e.trim().toLowerCase());

async function refreshAccessToken(token) {
  try {
    const response = await axios.post('https://oauth2.googleapis.com/token', {
      client_id: process.env.GOOGLE_CLIENT_ID,
      client_secret: process.env.GOOGLE_CLIENT_SECRET,
      refresh_token: token.refreshToken,
      grant_type: 'refresh_token',
    });

    const refreshedTokens = response.data;

    return {
      ...token,
      accessToken: refreshedTokens.access_token,
      accessTokenExpires: Date.now() + refreshedTokens.expires_in * 1000,
      refreshToken: refreshedTokens.refresh_token ?? token.refreshToken,
    };
  } catch (error) {
    console.error('Error refreshing access token:', error);
    return { ...token, error: 'RefreshAccessTokenError' };
  }
}

export const authOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      authorization: {
        params: {
          scope: 'openid email profile https://www.googleapis.com/auth/calendar.events',
          access_type: 'offline',
          prompt: 'consent',
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
      if (account && user) {
        const email = String(user.email || "").trim().toLowerCase();
        return {
          ...token,
          accessToken: account.access_token,
          accessTokenExpires: Date.now() + (Number(account.expires_in || 3600) * 1000),
          refreshToken: account.refresh_token ?? token.refreshToken,
          user: { name: user.name, email },
          isAdmin: adminEmails.includes(email),
        };
      }

      if (!token.accessTokenExpires) return token;
      if (Date.now() < token.accessTokenExpires) return token;

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
};

export default NextAuth(authOptions);

export async function isAdminRequest(req, res) {
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });

  const email = String(token?.user?.email || token?.email || "")
    .trim()
    .toLowerCase();

  if (!email || !adminEmails.includes(email)) {
    res.status(401).json({ message: "No autorizado" });
    throw new Error("Not authorized");
  }

  // Devuelve datos del admin para usarlos como `actor` en auditoría.
  return {
    email,
    name: token?.user?.name || token?.name || null,
    sub: token?.sub || null,
  };
}