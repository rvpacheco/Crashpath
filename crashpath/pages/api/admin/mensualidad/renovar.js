
import dbConnect from "../../../../lib/mongodb";
import User from "../../../../models/User";
import { requireAuth, PERMISOS, opcionesRecorte } from "../../../../lib/authz";
import { recortarCortesia } from "../../../../lib/redact";
import { logAudit } from "../../../../lib/audit";
import { otorgarCortesia } from "../../../../lib/cortesia";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ message: "Método no permitido." });
  }

  // Renovar el mes es una venta y el voluntario cobra durante su turno.
  let actor;
  try {
    actor = await requireAuth(req, res, PERMISOS.COBRAR);
  } catch {
    return;
  }

  await dbConnect();

  const { userId, months = 1 } = req.body;

  if (!userId) {
    return res.status(400).json({ message: "userId es requerido." });
  }

  if (!Number.isInteger(months) || months < 1 || months > 12) {
    return res.status(400).json({ message: "months debe ser entre 1 y 12." });
  }

  try {
    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({ message: "Usuario no encontrado." });
    }

    if (user.accessType !== "mensualidad") {
      return res.status(400).json({
        message: "Este usuario es de tiquetera, no de mensualidad.",
      });
    }

    const now = new Date();

    // Si tiene mensualidad activa y no ha vencido, extender desde endDate
    // Si ya venció o no tiene, empezar desde hoy
    const base =
      user.mensualidad?.endDate && new Date(user.mensualidad.endDate) > now
        ? new Date(user.mensualidad.endDate)
        : now;

    const newEndDate = new Date(base);
    newEndDate.setMonth(newEndDate.getMonth() + months);

    user.mensualidad.active = true;
    user.mensualidad.startDate = user.mensualidad.startDate ?? now;
    user.mensualidad.endDate = newEndDate;

    user.mensualidad.renewals.push({
      renewedAt: now,
      renewedBy: actor.rol,
      adminEmail: actor.email ?? "desconocido",
      newEndDate,
    });

    // Renovar el mes renueva la cortesía: vuelve a 1 (no se acumula) y vence
    // con la mensualidad.
    otorgarCortesia(user, { vence: newEndDate, ts: now });

    await user.save();

    const auditEvent = await logAudit({
      action: "MENSUALIDAD_RENEW",
      actor,
      user,
      summary: `Mensualidad renovada +${months} mes(es) (vence ${newEndDate.toLocaleDateString("en-CA")}) · cortesía renovada`,
      meta: { months, newEndDate, cortesia: user.cortesia?.disponibles ?? 0 },
    });

    return res.status(200).json({
      message: "Mensualidad renovada correctamente.",
      mensualidad: {
        active: user.mensualidad.active,
        startDate: user.mensualidad.startDate,
        endDate: user.mensualidad.endDate,
        renewals: user.mensualidad.renewals,
      },
      cortesia: recortarCortesia(user.cortesia, opcionesRecorte(actor)),
      auditEvent,
    });
  } catch (error) {
    console.error("[renovar mensualidad]", error);
    return res.status(500).json({ message: "Error interno del servidor." });
  }
}