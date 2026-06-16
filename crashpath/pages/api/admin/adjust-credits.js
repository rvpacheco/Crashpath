import dbConnect from '../../../lib/mongodb';
import User from '../../../models/User';
import { isAdminRequest } from '../auth/[...nextauth]';
import { logAudit } from '../../../lib/audit';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  // Solo admin (isAdminRequest responde 401 y lanza si no autorizado)
  let actor;
  try {
    actor = await isAdminRequest(req, res);
  } catch {
    return;
  }

  try {
    const { userId } = req.body || {};

    // credits es un delta entero (positivo suma, negativo resta)
    const delta = Number(req.body?.credits);
    if (!userId) {
      return res.status(400).json({ message: 'Falta userId' });
    }
    if (!Number.isInteger(delta)) {
      return res.status(400).json({ message: 'credits debe ser un entero' });
    }

    await dbConnect();
    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({ message: 'Usuario no encontrado' });
    }

    const before = user.credits ?? 0;
    // No permitir saldo negativo
    user.credits = Math.max(0, before + delta);
    await user.save();

    const auditEvent = await logAudit({
      action: 'ADJUST_CREDITS',
      actor,
      user,
      summary: `Créditos: ${before} → ${user.credits} (${delta >= 0 ? '+' : ''}${delta})`,
      meta: { before, after: user.credits, delta },
    });

    res.status(200).json({
      message: 'Créditos ajustados con éxito',
      credits: user.credits,
      auditEvent,
    });
  } catch (error) {
    console.error('Error al ajustar créditos:', error);
    res.status(500).json({ message: 'Error al ajustar créditos' });
  }
}
