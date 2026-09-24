// Registro dinámico de clientes (RFC 7591). Stateless: el client_id ES un JWT
// firmado con los redirect_uris aprobados, así no hace falta guardarlo.
//
// Registrarse no da acceso a nada: para sacar un token igual hay que pasar
// por /api/oauth/authorize con el Google de un email permitido.
import { cors, firmar, redirectPermitido } from "../../../lib/mcpAuth";

export default function handler(req, res) {
  cors(res);
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") return res.status(405).json({ error: "invalid_request" });

  const body = req.body || {};
  const redirectUris = Array.isArray(body.redirect_uris) ? body.redirect_uris.map(String) : [];

  if (!redirectUris.length || redirectUris.length > 5) {
    return res.status(400).json({ error: "invalid_redirect_uri", error_description: "redirect_uris es requerido" });
  }
  const malo = redirectUris.find((u) => !redirectPermitido(u));
  if (malo) {
    return res.status(400).json({ error: "invalid_redirect_uri", error_description: `redirect_uri no permitido: ${malo}` });
  }

  const clientName = String(body.client_name || "Cliente MCP").slice(0, 80);
  const clientId = firmar("cliente", { redirect_uris: redirectUris, client_name: clientName });

  return res.status(201).json({
    client_id: clientId,
    client_id_issued_at: Math.floor(Date.now() / 1000),
    client_name: clientName,
    redirect_uris: redirectUris,
    grant_types: ["authorization_code", "refresh_token"],
    response_types: ["code"],
    token_endpoint_auth_method: "none",
  });
}
