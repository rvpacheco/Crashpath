import dbConnect from '../../../lib/mongodb';
import { requireAuth, PERMISOS } from '../../../lib/authz';
import { ajustarCreditos } from '../../../lib/operaciones';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  // Cobrar es del turno: el voluntario vende tiqueteras (requireAuth responde
  // 401/403 y lanza si no puede).
  let actor;
  try {
    actor = await requireAuth(req, res, PERMISOS.COBRAR);
  } catch {
    return;
  }

  try {
    const { userId } = req.body || {};

    // credits es un delta entero (positivo suma, negativo resta)
    const delta = Number(req.body?.credits);

    await dbConnect();
    // La lógica vive en lib/operaciones.js: la comparte con el MCP.
    // `venta: true` = se cobró una tiquetera (suma ingreso). Sin eso es una
    // corrección de saldo y no cuenta como plata.
    const { status, body } = await ajustarCreditos({ userId, delta, venta: req.body?.venta === true, actor });
    res.status(status).json(body);
  } catch (error) {
    console.error('Error al ajustar créditos:', error);
    res.status(500).json({ message: 'Error al ajustar créditos' });
  }
}
