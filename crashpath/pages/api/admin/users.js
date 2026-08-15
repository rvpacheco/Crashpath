import dbConnect from '../../../lib/mongodb';
import User from '../../../models/User';
import { isAdminRequest } from '../auth/[...nextauth]';

// Los KPIs y la asistencia del panel solo miran hoy/semana/mes (+ el período
// anterior para comparar), así que con ~3 meses de visitas alcanza. Sin este
// recorte, el payload crece sin límite con la historia completa de cada uno.
const VISITS_DAYS = 92;

export default async function handler(req, res) {
  try {
    await isAdminRequest(req, res);
    await dbConnect();

    const since = new Date(Date.now() - VISITS_DAYS * 86400000);

    // Lista liviana: visitas recientes y sin los campos pesados del waiver
    // (texto snapshot y firma en base64). El detalle completo de un usuario
    // se pide aparte en GET /api/admin/users/[id].
    const users = await User.aggregate([
      {
        $addFields: {
          visits: {
            $filter: {
              input: { $ifNull: ['$visits', []] },
              as: 'v',
              cond: { $gte: ['$$v.date', since] },
            },
          },
        },
      },
      {
        $project: {
          waiverTextSnapshot: 0,
          waiverSignatureUrl: 0,
          waiverSignatureText: 0,
          'visits.events': 0,
        },
      },
    ]);

    res.setHeader('Cache-Control', 'no-store');
    res.status(200).json({ users });
  } catch (error) {
    console.error('Error fetching users:', error.message);
    if (!res.headersSent) {
      res.status(500).json({ message: 'Error al obtener usuarios' });
    }
  }
}
