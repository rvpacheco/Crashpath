// POST /api/admin/staff/revocar
// Corta el turno antes de que venza solo. Body: { email } o { id }.
//
// Tiene efecto INMEDIATO: el guardia resuelve el rol en cada request, así que
// el voluntario pierde el acceso en su siguiente click, sin esperar a que se
// le caiga la sesión. La regla vive en lib/turnos.js (la comparte el MCP).
import dbConnect from "../../../../lib/mongodb";
import { requireAuth, PERMISOS } from "../../../../lib/authz";
import { revocarTurno } from "../../../../lib/turnos";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ message: "Method not allowed" });
  }

  let actor;
  try {
    actor = await requireAuth(req, res, PERMISOS.GESTIONAR_STAFF);
  } catch {
    return;
  }

  try {
    await dbConnect();
    const { status, body } = await revocarTurno({ id: req.body?.id, email: req.body?.email, actor });
    return res.status(status).json(body);
  } catch (e) {
    console.error("staff revoke error:", e?.message || e);
    return res.status(500).json({ message: "No se pudo revocar el turno" });
  }
}
