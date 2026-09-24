// /.well-known/oauth-protected-resource (rewrite en next.config.js).
// Dice qué servidor de autorización protege /api/mcp.
import { cors, urlBase } from "../../../lib/mcpAuth";

export default function handler(req, res) {
  cors(res);
  if (req.method === "OPTIONS") return res.status(204).end();

  const base = urlBase(req);
  res.setHeader("Cache-Control", "public, max-age=3600");
  return res.status(200).json({
    resource: `${base}/api/mcp`,
    authorization_servers: [base],
    bearer_methods_supported: ["header"],
    scopes_supported: ["crashpath"],
  });
}
