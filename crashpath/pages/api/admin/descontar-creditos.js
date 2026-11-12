import dbConnect from '../../../lib/mongodb';
import { requireAuth, PERMISOS } from '../../../lib/authz';
import { descontarCreditos } from '../../../lib/operaciones';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  // Es parte del check-in (acompañantes que entran con el socio), así que lo
  // puede hacer quien hace check-in. Sumar o corregir saldo sigue siendo
  // COBRAR en adjust-credits.
  let actor;
  try {
    actor = await requireAuth(req, res, PERMISOS.CHECKIN);
  } catch {
    return;
  }

  try {
    const { userId, cantidad, motivo } = req.body || {};
    await dbConnect();
    // La lógica vive en lib/operaciones.js: la comparte con el MCP.
    const { status, body } = await descontarCreditos({ userId, cantidad: Number(cantidad), motivo, actor });
    res.status(status).json(body);
  } catch (error) {
    console.error('Error al descontar créditos:', error);
    res.status(500).json({ message: 'Error al descontar créditos' });
  }
}
