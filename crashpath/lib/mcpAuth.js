// OAuth mínimo para el MCP de Crashpath (docs/ideas-pendientes.md §1).
//
// claude.ai (web y celular) conecta con servidores MCP remotos por OAuth 2.1:
// registra un cliente, manda al dueño a /api/oauth/authorize, recibe un code y
// lo cambia por un token. Acá todo es STATELESS: el client_id, el code y los
// tokens son JWT firmados, así que no hay colección nueva en Mongo.
//
// Quién puede entrar: solo los emails de MCP_ALLOWED_EMAILS que además sean
// admin (lib/roles.js). Sin esa variable no entra nadie: fail-safe. El login
// es el mismo Google de NextAuth que usa el panel.
//
// Para cortar todos los tokens de una vez: cambiar MCP_JWT_SECRET (o sacar el
// email de MCP_ALLOWED_EMAILS, que se revisa en CADA request).

import crypto from "node:crypto";
import jwt from "jsonwebtoken";
import { esAdminEmail, normalizarEmail } from "./roles.js";

export const TTL = {
  cliente: 365 * 86400, // client_id de un registro dinámico
  solicitud: 10 * 60,   // pantalla de "¿autorizar?" abierta
  code: 5 * 60,
  access: 60 * 60,
  refresh: 30 * 86400,
};

const ISSUER = "crashpath-mcp";

/** Clave de firma. Si no hay una propia, se deriva de NEXTAUTH_SECRET. */
export function claveFirma(env = process.env) {
  if (env.MCP_JWT_SECRET) return env.MCP_JWT_SECRET;
  if (!env.NEXTAUTH_SECRET) throw new Error("Falta MCP_JWT_SECRET (o NEXTAUTH_SECRET)");
  // Derivada y no la misma: un token del MCP nunca sirve como sesión de NextAuth.
  return crypto.createHmac("sha256", env.NEXTAUTH_SECRET).update("crashpath-mcp-v1").digest("hex");
}

/** Firma un JWT del tipo `typ` ("cliente", "solicitud", "code", "access", "refresh"). */
export function firmar(typ, payload, env = process.env) {
  return jwt.sign({ ...payload, typ }, claveFirma(env), {
    algorithm: "HS256",
    issuer: ISSUER,
    expiresIn: TTL[typ],
  });
}

/**
 * Verifica firma, vencimiento y TIPO: un code no sirve como access token ni
 * un refresh como code. Devuelve el payload o null.
 */
export function verificar(token, typ, env = process.env) {
  if (!token || typeof token !== "string") return null;
  try {
    const p = jwt.verify(token, claveFirma(env), { algorithms: ["HS256"], issuer: ISSUER });
    return p?.typ === typ ? p : null;
  } catch {
    return null;
  }
}

/** Emails autorizados a usar el MCP. */
export function emailsPermitidos(env = process.env) {
  return String(env.MCP_ALLOWED_EMAILS || "")
    .split(",")
    .map(normalizarEmail)
    .filter(Boolean);
}

/** ¿Este email puede usar el MCP? Tiene que estar en la lista Y ser admin. */
export function emailPermitido(email, env = process.env) {
  const e = normalizarEmail(email);
  return !!e && esAdminEmail(e) && emailsPermitidos(env).includes(e);
}

const HOSTS_REDIRECT_DEFAULT = ["claude.ai", "claude.com"];

/**
 * ¿Se puede mandar un code a este redirect_uri? Solo a Claude (https) o a
 * localhost (Claude Code, MCP Inspector). Evita que alguien registre un
 * cliente propio y le haga autorizar al dueño un redirect hacia su servidor.
 */
export function redirectPermitido(uri, env = process.env) {
  let u;
  try {
    u = new URL(uri);
  } catch {
    return false;
  }
  if (u.hash) return false;
  const local = u.hostname === "localhost" || u.hostname === "127.0.0.1" || u.hostname === "[::1]";
  if (local) return u.protocol === "http:" || u.protocol === "https:";
  if (u.protocol !== "https:") return false;
  const extra = String(env.MCP_REDIRECT_HOSTS || "").split(",").map((h) => h.trim().toLowerCase()).filter(Boolean);
  const hosts = [...HOSTS_REDIRECT_DEFAULT, ...extra];
  return hosts.some((h) => u.hostname === h || u.hostname.endsWith(`.${h}`));
}

/** PKCE S256: base64url(sha256(verifier)) === challenge. */
export function pkceValido(verifier, challenge) {
  if (!verifier || !challenge) return false;
  const calc = crypto.createHash("sha256").update(String(verifier)).digest("base64url");
  const a = Buffer.from(calc);
  const b = Buffer.from(String(challenge));
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

/** URL pública del sitio (sin / final). */
export function urlBase(req, env = process.env) {
  if (env.NEXTAUTH_URL) return env.NEXTAUTH_URL.replace(/\/+$/, "");
  const proto = String(req?.headers?.["x-forwarded-proto"] || "https").split(",")[0].trim();
  const host = req?.headers?.["x-forwarded-host"] || req?.headers?.host;
  return `${proto}://${host}`;
}

/** Deja pasar llamadas desde el navegador (MCP Inspector). No hay cookies: es Bearer. */
export function cors(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS, DELETE");
  res.setHeader(
    "Access-Control-Allow-Headers",
    "Authorization, Content-Type, Mcp-Session-Id, Mcp-Protocol-Version, Last-Event-ID"
  );
  res.setHeader("Access-Control-Expose-Headers", "WWW-Authenticate, Mcp-Session-Id");
}

/** Escapa texto para meterlo en el HTML de la pantalla de autorización. */
export function escaparHtml(v) {
  return String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
}
