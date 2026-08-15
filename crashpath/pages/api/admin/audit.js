import dbConnect from "../../../lib/mongodb";
import AuditLog from "../../../models/AuditLog";
import { requireAuth, PERMISOS } from '../../../lib/authz';

export default async function handler(req, res) {
  try {
    await requireAuth(req, res, PERMISOS.VER_AUDITORIA);
    await dbConnect();

    const limit = Math.min(Number(req.query.limit || 40), 200);
    const userId = req.query.userId;

    const filter = {};
    if (userId) filter.userId = userId;

    const events = await AuditLog.find(filter).sort({ ts: -1 }).limit(limit).lean();
    res.status(200).json({ events });
  } catch (e) {
    // requireAuth responde 401/403 y DESPUÉS lanza. Sin el guardia, este catch
    // escribe encima de una respuesta ya cerrada: al cliente igual le llega el
    // 401, pero Next registra un 500 que nunca existió y ese ruido tapa los
    // 500 de verdad en los logs. Mismo patrón que /api/admin/users.
    console.error("Error cargando auditoría:", e.message);
    if (!res.headersSent) {
      res.status(500).json({ message: "No se pudo cargar auditoría." });
    }
  }
}