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
import { turnoVigente } from "../../../../lib/staff";
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

    const grant = id
      ? await StaffGrant.findById(id)
      : await StaffGrant.findOne({ email }).sort({ vence: -1 });

    if (!grant) {
      return res.status(404).json({ message: "Ese voluntario no tiene turnos", code: "NO_ENCONTRADO" });
    }

    // Idempotente: revocar dos veces no vuelve a escribir la fecha ni ensucia
    // la auditoría con un evento que no pasó.
    if (!turnoVigente(grant)) {
      return res.status(200).json({
        message: grant.revocadoEn ? "Ese turno ya estaba revocado." : "Ese turno ya había vencido.",
        code: "SIN_EFECTO",
        turno: { _id: String(grant._id), email: grant.email, vence: grant.vence },
      });
    }

    grant.revocadoEn = new Date();
    grant.revocadoPor = { email: actor.email, name: actor.name };
    await grant.save();

    const auditEvent = await logAudit({
      action: "STAFF_REVOKE",
      actor,
      user: { email: grant.email, name: grant.name || undefined },
      summary: `Turno de voluntario revocado a ${grant.email}`,
      meta: { email: grant.email, vencíaEn: grant.vence },
    });

    return res.status(200).json({
      message: "Turno revocado. El acceso se corta de inmediato.",
      turno: {
        _id: String(grant._id),
        email: grant.email,
        vence: grant.vence,
        revocadoEn: grant.revocadoEn,
      },
      auditEvent,
    });
  } catch (e) {
    console.error("staff revoke error:", e?.message || e);
    return res.status(500).json({ message: "No se pudo revocar el turno" });
  }
}
