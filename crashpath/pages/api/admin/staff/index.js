// GET  /api/admin/staff  -> turnos vigentes + historial reciente
// POST /api/admin/staff  -> otorga el turno de hoy a un email
//
// Solo admin. Otorgar no pide fecha a propósito: el turno SIEMPRE vence al
// final del día en Bogotá (lib/staff.js). Sin campo de fecha no hay forma de
// dejar por error un acceso abierto una semana, y olvidarse de revocar es el
// camino seguro en vez del peligroso.
import dbConnect from "../../../../lib/mongodb";
import StaffGrant from "../../../../models/StaffGrant";
import { requireAuth, PERMISOS } from "../../../../lib/authz";
import { estadoTurno } from "../../../../lib/staff";
import { otorgarTurno, agregarPermanente, listarPermanentes } from "../../../../lib/turnos";

// Cuánta historia devuelve el GET. Alcanza para responder "¿quién estuvo en el
// mostrador esta semana?" sin traerse la colección entera.
const HISTORIAL_DIAS = 30;

export default async function handler(req, res) {
  let actor;
  try {
    actor = await requireAuth(req, res, PERMISOS.GESTIONAR_STAFF);
  } catch {
    return;
  }

  await dbConnect();

  if (req.method === "GET") {
    try {
      const desde = new Date(Date.now() - HISTORIAL_DIAS * 86400000);
      const grants = await StaffGrant.find({ vence: { $gte: desde } })
        .sort({ vence: -1 })
        .lean();

      const ahora = new Date();
      const permanentes = await listarPermanentes();
      res.setHeader("Cache-Control", "no-store");
      return res.status(200).json({
        permanentes: permanentes.map((p) => ({
          _id: String(p._id),
          email: p.email,
          name: p.name || null,
          nota: p.nota || null,
          agregadoEn: p.agregadoEn,
          agregadoPor: p.agregadoPor?.email || null,
        })),
        turnos: grants.map((g) => ({
          _id: String(g._id),
          email: g.email,
          name: g.name || null,
          vence: g.vence,
          otorgadoEn: g.otorgadoEn,
          otorgadoPor: g.otorgadoPor?.email || null,
          revocadoEn: g.revocadoEn || null,
          revocadoPor: g.revocadoPor?.email || null,
          nota: g.nota || null,
          estado: estadoTurno(g, ahora),
        })),
      });
    } catch (e) {
      console.error("staff list error:", e?.message || e);
      return res.status(500).json({ message: "No se pudo cargar la lista de voluntarios" });
    }
  }

  if (req.method === "POST") {
    try {
      // `permanente: true` = entra todos los días, sin turno, hasta que lo quiten.
      const accion = req.body?.permanente === true ? agregarPermanente : otorgarTurno;
      const { status, body } = await accion({
        email: req.body?.email,
        name: req.body?.name,
        nota: req.body?.nota,
        actor,
      });
      return res.status(status).json(body);
    } catch (e) {
      console.error("staff grant error:", e?.message || e);
      return res.status(500).json({ message: "No se pudo otorgar el turno" });
    }
  }

  return res.status(405).json({ message: "Method not allowed" });
}
