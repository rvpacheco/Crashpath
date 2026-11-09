// GET /api/me/rol
// Qué puede hacer quien está mirando el panel. El front lo usa para el gate de
// /admin y para esconder botones.
//
// Existe porque el rol NO puede salir de la sesión: session.isAdmin queda
// congelado en el JWT desde el login, así que un turno otorgado hace un minuto
// no aparecería y uno revocado seguiría vivo. Acá se resuelve por request.
//
// Que la UI esconda un botón es comodidad, no seguridad: cada endpoint vuelve
// a preguntar por su cuenta (lib/authz.js).
import { resolverActor } from "../../../lib/authz";
import { permisosDe, nombreRol } from "../../../lib/permisos";

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ message: "Method not allowed" });
  }

  try {
    const actor = await resolverActor(req);

    res.setHeader("Cache-Control", "no-store");
    return res.status(200).json({
      email: actor.email,
      name: actor.name,
      rol: actor.rol,
      rolNombre: nombreRol(actor.rol),
      permisos: permisosDe(actor.rol),
      // Solo el voluntario tiene vencimiento; el admin no vence.
      vence: actor.vence || null,
      // Voluntario permanente: es staff pero sin hora de caída.
      permanente: !!actor.permanente,
      motivo: actor.motivo || null,
    });
  } catch (e) {
    // Sin rol NO es un error: es la respuesta para quien no es del staff. El
    // 503 es solo si no se pudo averiguar (Mongo caído), y el panel lo
    // distingue para no mandar a un admin al inicio por un problema de red.
    console.error("me/rol error:", e?.message || e);
    return res.status(503).json({ message: "No se pudo verificar el rol", code: "AUTH_NO_DISPONIBLE" });
  }
}
