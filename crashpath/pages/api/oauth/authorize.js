// Pantalla de "¿Autorizar a Claude?" del MCP.
//
// GET:  valida el pedido, exige sesión de Google (la misma del panel) con un
//       email permitido y muestra un botón. Sin sesión → login y vuelve acá.
// POST: el botón. Emite el code y redirige de vuelta a Claude.
//
// El botón existe a propósito (no se autoriza solo): así un link armado por
// otro no le saca un token al dueño por el solo hecho de tener sesión abierta.
// El POST lleva la `solicitud` firmada, atada al email de la sesión, y la
// cookie de NextAuth es SameSite=Lax, así que otro sitio no puede postear acá
// con la sesión del dueño.

import { getToken } from "next-auth/jwt";
import { normalizarEmail } from "../../../lib/roles";
import {
  firmar,
  verificar,
  emailPermitido,
  redirectPermitido,
  escaparHtml,
  urlBase,
} from "../../../lib/mcpAuth";

function pagina(res, status, titulo, cuerpo) {
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Content-Security-Policy", "default-src 'none'; style-src 'unsafe-inline'; form-action 'self' https: http://localhost:* http://127.0.0.1:*; frame-ancestors 'none'");
  return res.status(status).send(`<!doctype html>
<html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escaparHtml(titulo)} · Crashpath</title>
<style>
  body{font-family:system-ui,sans-serif;background:#111;color:#eee;display:flex;min-height:100vh;align-items:center;justify-content:center;margin:0;padding:16px}
  main{max-width:420px;width:100%;background:#1c1c1c;border-radius:12px;padding:24px}
  h1{font-size:1.25rem;margin:0 0 12px}
  p{line-height:1.5;color:#ccc}
  code{background:#2a2a2a;padding:2px 6px;border-radius:4px;word-break:break-all}
  .acciones{display:flex;gap:8px;margin-top:20px}
  button{flex:1;padding:12px;border-radius:8px;border:0;font-size:1rem;cursor:pointer}
  .si{background:#f5c518;color:#111;font-weight:600}
  .no{background:#333;color:#eee}
</style></head><body><main><h1>${escaparHtml(titulo)}</h1>${cuerpo}</main></body></html>`);
}

/** Valida los parámetros del pedido OAuth. Devuelve { ok, datos } o { ok:false, error }. */
function validarPedido(p) {
  const cliente = verificar(String(p.client_id || ""), "cliente");
  if (!cliente) return { ok: false, error: "client_id inválido. Volvé a agregar el conector en Claude." };

  const redirectUri = String(p.redirect_uri || "");
  if (!cliente.redirect_uris?.includes(redirectUri) || !redirectPermitido(redirectUri)) {
    return { ok: false, error: "redirect_uri no registrado para este cliente." };
  }
  if (p.response_type !== "code") return { ok: false, error: "response_type debe ser code." };
  if (!p.code_challenge || p.code_challenge_method !== "S256") {
    return { ok: false, error: "Falta PKCE (code_challenge con S256)." };
  }

  return {
    ok: true,
    datos: {
      client_id: String(p.client_id),
      client_name: cliente.client_name,
      redirect_uri: redirectUri,
      state: p.state ? String(p.state) : undefined,
      code_challenge: String(p.code_challenge),
    },
  };
}

function redirigir(res, redirectUri, params) {
  const u = new URL(redirectUri);
  for (const [k, v] of Object.entries(params)) if (v !== undefined) u.searchParams.set(k, v);
  res.setHeader("Cache-Control", "no-store");
  return res.redirect(302, u.toString());
}

async function emailDeSesion(req) {
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
  return {
    email: normalizarEmail(token?.user?.email || token?.email),
    name: token?.user?.name || token?.name || null,
  };
}

export default async function handler(req, res) {
  if (req.method === "GET") {
    const pedido = validarPedido(req.query || {});
    if (!pedido.ok) return pagina(res, 400, "Pedido inválido", `<p>${escaparHtml(pedido.error)}</p>`);

    const { email, name } = await emailDeSesion(req);
    if (!email) {
      const volver = `${urlBase(req)}${req.url}`;
      return res.redirect(302, `/api/auth/signin?callbackUrl=${encodeURIComponent(volver)}`);
    }
    if (!emailPermitido(email)) {
      return pagina(
        res,
        403,
        "Sin acceso",
        `<p>La cuenta <code>${escaparHtml(email)}</code> no está autorizada para usar el MCP de Crashpath.</p>
         <p>Se habilita con la variable <code>MCP_ALLOWED_EMAILS</code> en Vercel.</p>`
      );
    }

    const solicitud = firmar("solicitud", { ...pedido.datos, email, name });
    const destino = new URL(pedido.datos.redirect_uri).host;

    return pagina(
      res,
      200,
      "¿Conectar Claude con Crashpath?",
      `<p><strong>${escaparHtml(pedido.datos.client_name)}</strong> va a poder consultar socios y hacer check-ins,
       renovar mensualidades y cargar tiqueteras a tu nombre (<code>${escaparHtml(email)}</code>).</p>
       <p>Todo queda en la auditoría con origen <code>mcp</code>.</p>
       <p>Vuelve a: <code>${escaparHtml(destino)}</code></p>
       <form method="post" action="/api/oauth/authorize">
         <input type="hidden" name="solicitud" value="${escaparHtml(solicitud)}">
         <div class="acciones">
           <button class="no" name="decision" value="no">Cancelar</button>
           <button class="si" name="decision" value="si">Autorizar</button>
         </div>
       </form>`
    );
  }

  if (req.method === "POST") {
    const s = verificar(String(req.body?.solicitud || ""), "solicitud");
    if (!s) return pagina(res, 400, "Pedido vencido", "<p>Pasaron más de 10 minutos. Volvé a conectar desde Claude.</p>");

    // La sesión tiene que ser la MISMA que vio la pantalla.
    const { email } = await emailDeSesion(req);
    if (!email || email !== s.email || !emailPermitido(email)) {
      return pagina(res, 403, "Sin acceso", "<p>La sesión cambió o ya no está autorizada.</p>");
    }
    if (!redirectPermitido(s.redirect_uri)) {
      return pagina(res, 400, "Pedido inválido", "<p>redirect_uri no permitido.</p>");
    }

    if (req.body?.decision !== "si") {
      return redirigir(res, s.redirect_uri, { error: "access_denied", state: s.state });
    }

    const code = firmar("code", {
      email: s.email,
      name: s.name,
      client_id: s.client_id,
      redirect_uri: s.redirect_uri,
      code_challenge: s.code_challenge,
    });
    return redirigir(res, s.redirect_uri, { code, state: s.state });
  }

  res.setHeader("Allow", "GET, POST");
  return res.status(405).end();
}
