// POST /api/admin/staff/revocar
// Corta el turno antes de que venza solo. Body: { email } o { id }.
//
// Tiene efecto INMEDIATO: el guardia resuelve el rol en cada request, así que
// el voluntario pierde el acceso en su siguiente click, sin esperar a que se
// le caiga la sesión.
import mongoose from "mongoose";
import dbConnect from "../../../../lib/mongodb";
import StaffGrant from "../../../../models/StaffGrant";
import { requireAuth, PERMISOS } from "../../../../lib/authz";
import { normalizarEmail } from "../../../../lib/roles";
import { logAudit } from "../../../../lib/audit";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ message: "Method not allowed" });
  }

  let actor;
  try {
    actor = await requireAuth(req, res, PERMISOS.GESTIONAR_STAFF);
  } catch {
    return;
  }

  const id = String(req.body?.id || "").trim();
  const email = normalizarEmail(req.body?.email);

  if (!id && !email) {
    return res.status(400).json({ message: "Falta id o email" });
  }
  if (id && !mongoose.isValidObjectId(id)) {
    return res.status(400).json({ message: "ID inválido" });
  }

  try {
    await dbConnect();

    // Se resuelve a QUIÉN se le revoca; después se cortan TODOS sus turnos
    // vigentes, no solo el que se clickeó. Si dos admins le dieron turno a la
    // misma persona (un sábado ocupado es exactamente eso), revocar uno solo
    // dejaba el otro vivo: el panel decía "revocado" y la persona seguía
    // entrando.
    const referencia = id ? await StaffGrant.findById(id).lean() : null;
    if (id && !referencia) {
      return res.status(404).json({ message: "Ese turno no existe", code: "NO_ENCONTRADO" });
    }

    const objetivo = referencia?.email || email;
    const ahora = new Date();

    const resultado = await StaffGrant.updateMany(
      { email: objetivo, revocadoEn: null, vence: { $gte: ahora } },
      { $set: { revocadoEn: ahora, revocadoPor: { email: actor.email, name: actor.name } } }
    );

    // Idempotente: revocar dos veces no reescribe la fecha ni ensucia la
    // auditoría con un evento que no pasó.
    if (resultado.modifiedCount === 0) {
      const existeAlguno = referencia || (await StaffGrant.exists({ email: objetivo }));
      if (!existeAlguno) {
        return res.status(404).json({ message: "Ese voluntario no tiene turnos", code: "NO_ENCONTRADO" });
      }
      return res.status(200).json({
        message: "Ese turno ya estaba revocado o vencido.",
        code: "SIN_EFECTO",
        email: objetivo,
      });
    }

    const auditEvent = await logAudit({
      action: "STAFF_REVOKE",
      actor,
      user: { email: objetivo, name: referencia?.name || undefined },
      summary: `Turno de voluntario revocado a ${objetivo}`,
      meta: { email: objetivo, turnosCortados: resultado.modifiedCount },
    });

    return res.status(200).json({
      message: "Turno revocado. El acceso se corta de inmediato.",
      email: objetivo,
      turnosCortados: resultado.modifiedCount,
      auditEvent,
    });
  } catch (e) {
    console.error("staff revoke error:", e?.message || e);
    return res.status(500).json({ message: "No se pudo revocar el turno" });
  }
}
