// /.well-known/oauth-authorization-server (rewrite en next.config.js).
// Le dice a claude.ai dónde registrarse, autorizar y pedir tokens.
import { cors, urlBase } from "../../../lib/mcpAuth";

export default function handler(req, res) {
  cors(res);
  if (req.method === "OPTIONS") return res.status(204).end();

  const base = urlBase(req);
  res.setHeader("Cache-Control", "public, max-age=3600");
  return res.status(200).json({
    issuer: base,
    authorization_endpoint: `${base}/api/oauth/authorize`,
    token_endpoint: `${base}/api/oauth/token`,
    registration_endpoint: `${base}/api/oauth/register`,
    response_types_supported: ["code"],
    grant_types_supported: ["authorization_code", "refresh_token"],
    code_challenge_methods_supported: ["S256"],
    token_endpoint_auth_methods_supported: ["none"],
    scopes_supported: ["crashpath"],
  });
}
