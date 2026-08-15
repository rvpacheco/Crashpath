// pages/api/auth/[...nextauth].js
import NextAuth from 'next-auth';
import GoogleProvider from 'next-auth/providers/google';
import axios from 'axios';
import { esAdminEmail } from '../../../lib/roles';

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
          // Pista para la UI pública (ej. el redirect de /reservas), NO para
          // autorizar: queda congelada hasta el próximo login. Los endpoints
          // resuelven el rol por request con lib/authz.js.
          isAdmin: esAdminEmail(email),
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

// El guardia vive en lib/authz.js (requireAuth). Antes había un isAdminRequest
// acá y otros dos mecanismos sueltos; se unificaron para que el rol se resuelva
// por request y no desde el JWT.