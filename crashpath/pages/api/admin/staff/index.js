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
import { esAdminEmail, normalizarEmail } from "../../../../lib/roles";
import { finDelTurno, estadoTurno } from "../../../../lib/staff";
import { logAudit } from "../../../../lib/audit";

// Cuánta historia devuelve el GET. Alcanza para responder "¿quién estuvo en el
// mostrador esta semana?" sin traerse la colección entera.
const HISTORIAL_DIAS = 30;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

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
      res.setHeader("Cache-Control", "no-store");
      return res.status(200).json({
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
    const email = normalizarEmail(req.body?.email);
    const name = String(req.body?.name || "").trim().slice(0, 120);
    const nota = String(req.body?.nota || "").trim().slice(0, 300);

    if (email.length > 254 || !EMAIL_RE.test(email)) {
      return res.status(400).json({ message: "Email inválido", code: "EMAIL_INVALIDO" });
    }

    // Un admin ya entra por lib/roles.js; el grant no le sumaría nada y después
    // confundiría al leer la lista ("¿este es voluntario o admin?").
    if (esAdminEmail(email)) {
      return res.status(400).json({
        message: "Ese email ya es administrador permanente.",
        code: "YA_ES_ADMIN",
      });
    }

    try {
      // Si ya tiene turno hoy, no se duplica: se devuelve el que hay. Dos
      // admins dándole acceso al mismo voluntario es lo normal en un sábado.
      // Se pregunta por vigencia y no por "el último" por lo mismo que en
      // lib/authz.js: todos los turnos del día vencen en el mismo instante y
      // ordenar por fecha empata.
      const existente = await StaffGrant.findOne({
        email,
        revocadoEn: null,
        vence: { $gte: new Date() },
      });
      if (existente) {
        return res.status(200).json({
          message: "Ese voluntario ya tenía turno hoy.",
          code: "YA_TENIA_TURNO",
          turno: {
            _id: String(existente._id),
            email: existente.email,
            name: existente.name || null,
            vence: existente.vence,
            estado: "vigente",
          },
        });
      }

      const vence = finDelTurno();
      if (!vence) {
        // finDelTurno solo devuelve null si el día calendario es inválido, que
        // no debería pasar nunca; igual no se otorga un turno sin vencimiento.
        return res.status(500).json({ message: "No se pudo calcular el vencimiento del turno" });
      }

      const grant = await StaffGrant.create({
        email,
        name: name || undefined,
        vence,
        otorgadoEn: new Date(),
        otorgadoPor: { email: actor.email, name: actor.name },
        nota: nota || undefined,
      });

      const auditEvent = await logAudit({
        action: "STAFF_GRANT",
        actor,
        user: { email, name: name || undefined },
        summary: `Turno de voluntario otorgado a ${email} (vence ${vence.toLocaleString("es-CO", {
          timeZone: "America/Bogota",
        })})`,
        meta: { email, vence, nota: nota || undefined },
      });

      return res.status(201).json({
        message: "Turno otorgado. Vence al final del día.",
        turno: {
          _id: String(grant._id),
          email: grant.email,
          name: grant.name || null,
          vence: grant.vence,
          estado: "vigente",
        },
        auditEvent,
      });
    } catch (e) {
      console.error("staff grant error:", e?.message || e);
      return res.status(500).json({ message: "No se pudo otorgar el turno" });
    }
  }

  return res.status(405).json({ message: "Method not allowed" });
}
