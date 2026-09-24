// Cambia un code por tokens, o renueva con un refresh token.
import { cors, firmar, verificar, pkceValido, emailPermitido, TTL } from "../../../lib/mcpAuth";

const fallo = (res, status, error, error_description) =>
  res.status(status).json({ error, ...(error_description ? { error_description } : {}) });

function emitir(res, { email, name, clientId }) {
  res.setHeader("Cache-Control", "no-store");
  return res.status(200).json({
    access_token: firmar("access", { email, name, client_id: clientId }),
    token_type: "Bearer",
    expires_in: TTL.access,
    refresh_token: firmar("refresh", { email, name, client_id: clientId }),
    scope: "crashpath",
  });
}

export default function handler(req, res) {
  cors(res);
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") return fallo(res, 405, "invalid_request");

  // Next parsea application/x-www-form-urlencoded y JSON a objeto.
  const b = req.body || {};
  const clientId = String(b.client_id || "");

  if (b.grant_type === "authorization_code") {
    const code = verificar(b.code, "code");
    if (!code) return fallo(res, 400, "invalid_grant", "code inválido o vencido");
    if (clientId && clientId !== code.client_id) return fallo(res, 400, "invalid_grant", "client_id no coincide");
    if (String(b.redirect_uri || "") !== code.redirect_uri) {
      return fallo(res, 400, "invalid_grant", "redirect_uri no coincide");
    }
    if (!pkceValido(b.code_verifier, code.code_challenge)) {
      return fallo(res, 400, "invalid_grant", "code_verifier inválido");
    }
    if (!emailPermitido(code.email)) return fallo(res, 400, "invalid_grant", "email no autorizado");
    return emitir(res, { email: code.email, name: code.name, clientId: code.client_id });
  }

  if (b.grant_type === "refresh_token") {
    const rt = verificar(b.refresh_token, "refresh");
    if (!rt) return fallo(res, 400, "invalid_grant", "refresh_token inválido o vencido");
    if (clientId && clientId !== rt.client_id) return fallo(res, 400, "invalid_grant", "client_id no coincide");
    // Se revisa de nuevo: sacar el email de MCP_ALLOWED_EMAILS corta el acceso.
    if (!emailPermitido(rt.email)) return fallo(res, 400, "invalid_grant", "email no autorizado");
    return emitir(res, { email: rt.email, name: rt.name, clientId: rt.client_id });
  }

  return fallo(res, 400, "unsupported_grant_type");
}
