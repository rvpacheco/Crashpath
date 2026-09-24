import dbConnect from "../../../../lib/mongodb";
import { requireAuth, PERMISOS } from "../../../../lib/authz";
import { renovarMensualidad } from "../../../../lib/operaciones";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ message: "Método no permitido." });
  }

  // Renovar el mes es una venta y el voluntario cobra durante su turno.
  let actor;
  try {
    actor = await requireAuth(req, res, PERMISOS.COBRAR);
  } catch {
    return;
  }

  await dbConnect();

  const { userId, months = 1 } = req.body;

  try {
    // La lógica vive en lib/operaciones.js: la comparte con el MCP.
    const { status, body } = await renovarMensualidad({ userId, months, actor });
    return res.status(status).json(body);
  } catch (error) {
    console.error("[renovar mensualidad]", error);
    return res.status(500).json({ message: "Error interno del servidor." });
  }
}
