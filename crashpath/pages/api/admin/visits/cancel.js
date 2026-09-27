// pages/api/admin/visits/cancel.js
import { requireAuth, PERMISOS } from "../../../../lib/authz";
import dbConnect from "../../../../lib/mongodb";
import { cancelarVisita } from "../../../../lib/operaciones";

/**
 * POST /api/admin/visits/cancel
 * Body:
 *  - userId: string (required)
 *  - visitId: string (required)  // _id del subdocumento visit
 *  - notes?: string
 *  - refund?: boolean (optional, default false) // si quieres reembolsar el crédito manualmente
 *
 * Marca la visita como cancelled.
 * Por defecto NO reembolsa crédito (mantiene tu lógica Flow B).
 * La lógica vive en lib/operaciones.js (compartida con el MCP).
 */
export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ message: "Method not allowed" });

  let actor;
  try {
    actor = await requireAuth(req, res, PERMISOS.CHECKIN);
  } catch {
    return;
  }

  await dbConnect();

  try {
    const { status, body } = await cancelarVisita({
      userId: String(req.body?.userId || "").trim(),
      visitId: String(req.body?.visitId || "").trim(),
      notes: String(req.body?.notes || "").trim(),
      refund: Boolean(req.body?.refund || false),
      actor,
    });
    return res.status(status).json(body);
  } catch (err) {
    console.error("admin visits cancel error:", err);
    return res.status(500).json({ message: "Failed to cancel visit" });
  }
}
