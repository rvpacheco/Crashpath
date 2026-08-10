import dbConnect from '../../../lib/mongodb';
import User from '../../../models/User';
import { isAdminRequest } from '../auth/[...nextauth]';
import { logAudit } from '../../../lib/audit';
import { otorgarCortesia } from '../../../lib/cortesia';

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

    // Recarga (delta > 0) sobre tiquetera vencida o sin fechas: inicia una
    // vigencia nueva de 60 días. Si la tiquetera está activa, un ajuste NO
    // toca sus fechas (una corrección de +1 no debe regalar 60 días).
    if (delta > 0 && user.accessType === 'ticketera') {
      const end = user.tiquetera?.endDate ? new Date(user.tiquetera.endDate) : null;
      if (!end || end < new Date()) {
        const startDate = new Date();
        user.tiquetera = {
          startDate,
          endDate: new Date(startDate.getTime() + 60 * 86400000),
          totalUses: user.credits,
        };
      }

      // Cargar créditos = tiquetera nueva => cortesía renovada (vuelve a 1, no
      // se acumula). Se otorga en CUALQUIER recarga, no solo cuando arranca una
      // vigencia nueva: quien recompra antes de vencerse también compró su
      // tiquetera. Un ajuste de +1 por corrección también la renueva; el admin
      // puede quitarla a mano desde el panel si no corresponde.
      otorgarCortesia(user, { vence: user.tiquetera?.endDate || null });
    }

    await user.save();

    const auditEvent = await logAudit({
      action: 'ADJUST_CREDITS',
      actor,
      user,
      summary: `Créditos: ${before} → ${user.credits} (${delta >= 0 ? '+' : ''}${delta})${
        delta > 0 && user.accessType === 'ticketera' ? ' · cortesía renovada' : ''
      }`,
      meta: { before, after: user.credits, delta, cortesia: user.cortesia?.disponibles ?? 0 },
    });

    res.status(200).json({
      message: 'Créditos ajustados con éxito',
      credits: user.credits,
      cortesia: user.cortesia,
      auditEvent,
    });
  } catch (error) {
    console.error('Error al ajustar créditos:', error);
    res.status(500).json({ message: 'Error al ajustar créditos' });
  }
}
