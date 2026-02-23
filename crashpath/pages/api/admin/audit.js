import dbConnect from "../../../lib/mongodb";
import AuditLog from "../../../models/AuditLog";
import { isAdminRequest } from '../auth/[...nextauth]';

export default async function handler(req, res) {
  try {
    await isAdminRequest(req, res);
    await dbConnect();

    const limit = Math.min(Number(req.query.limit || 40), 200);
    const userId = req.query.userId;

    const filter = {};
    if (userId) filter.userId = userId;

    const events = await AuditLog.find(filter).sort({ ts: -1 }).limit(limit).lean();
    res.status(200).json({ events });
  } catch (e) {
    res.status(500).json({ message: "No se pudo cargar auditoría." });
  }
}