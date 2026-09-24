// Servidor MCP de Crashpath (docs/ideas-pendientes.md §1). Se agrega en
// claude.ai como conector personalizado con la URL <sitio>/api/mcp.
//
// Stateless: cada request arma su propio server + transport, como corresponde
// en Vercel (no hay proceso que viva entre requests). El token lo emite
// /api/oauth/* y se revisa acá en cada llamada.

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import dbConnect from "../../lib/mongodb";
import { ROL_ADMIN } from "../../lib/permisos";
import { cors, verificar, emailPermitido, urlBase } from "../../lib/mcpAuth";
import { registrarHerramientas } from "../../lib/mcpHerramientas";

function noAutorizado(req, res, descripcion) {
  // Solo el motivo y la forma del header, nunca el token.
  const auth = String(req.headers.authorization || "");
  console.warn(`[mcp] 401 ${descripcion} · header=${auth ? `${auth.split(" ")[0]} (${auth.length} chars)` : "ausente"}`);
  res.setHeader(
    "WWW-Authenticate",
    `Bearer resource_metadata="${urlBase(req)}/.well-known/oauth-protected-resource", error="invalid_token", error_description="${descripcion}"`
  );
  return res.status(401).json({ error: "invalid_token", error_description: descripcion });
}

export default async function handler(req, res) {
  cors(res);
  if (req.method === "OPTIONS") return res.status(204).end();

  const auth = String(req.headers.authorization || "");
  // El esquema no distingue mayúsculas (RFC 7235): hay clientes que mandan "bearer".
  const m = auth.match(/^bearer\s+(.+)$/i);
  const token = m ? m[1].trim() : "";
  if (!token) return noAutorizado(req, res, "Falta el token");

  const claims = verificar(token, "access");
  if (!claims) return noAutorizado(req, res, "Token inválido o vencido");
  // Se revisa en cada request: sacar el email de MCP_ALLOWED_EMAILS corta el acceso ya.
  if (!emailPermitido(claims.email)) return noAutorizado(req, res, "Email no autorizado");

  // Stateless: no hay stream SSE que abrir ni sesión que cerrar.
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST, OPTIONS");
    return res.status(405).json({ jsonrpc: "2.0", error: { code: -32000, message: "Method not allowed" }, id: null });
  }

  const actor = { email: claims.email, name: claims.name || null, rol: ROL_ADMIN };

  try {
    await dbConnect();

    const server = new McpServer(
      { name: "crashpath", version: "1.0.0" },
      {
        instructions:
          "Herramientas del gimnasio Crashpath (Bogotá). Para actuar sobre un socio, primero buscalo con buscar_usuario; " +
          "si hay más de un candidato parecido, preguntá cuál es. Las herramientas que cambian datos devuelven una vista " +
          "previa sin `confirmar`; mostrala y pedí confirmación explícita antes de llamar con confirmar=true.",
      }
    );
    registrarHerramientas(server, actor);

    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
      enableJsonResponse: true,
    });
    res.on("close", () => {
      transport.close();
      server.close();
    });

    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);
  } catch (e) {
    console.error("[mcp]", e);
    if (!res.headersSent) {
      res.status(500).json({ jsonrpc: "2.0", error: { code: -32603, message: "Error interno" }, id: null });
    }
  }
}
