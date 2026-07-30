// pages/api/admin/users/update-profile.js
import { isAdminRequest } from "../../auth/[...nextauth]";
import dbConnect from "../../../../lib/mongodb";
import User from "../../../../models/User";
import { logAudit } from "../../../../lib/audit";

const VALID_DOC_TYPES = ["CC", "CE", "TI", "PP", "NIT", "OTRO"];

export default async function handler(req, res) {
  if (req.method !== "POST")
    return res.status(405).json({ message: "Method not allowed" });

  let actor;
  try {
    actor = await isAdminRequest(req, res);
  } catch {
    return;
  }

  const {
    userId,
    name,
    email,
    phone,
    documentType,
    documentNumber,
    epsName,
    emergencyContactName,
    emergencyContactPhone,
  } = req.body || {};

  if (!userId)
    return res.status(400).json({ message: "Missing userId" });

  // Validaciones básicas
  const cleanName = (name || "").trim();
  const cleanEmail = (email || "").trim().toLowerCase();
  const cleanPhone = (phone || "").trim();
  const cleanDocType = (documentType || "").trim().toUpperCase();
  const cleanDocNumber = (documentNumber || "").trim();
  const cleanEps = (epsName || "").trim();
  const cleanEcn = (emergencyContactName || "").trim();
  const cleanEcp = (emergencyContactPhone || "").trim();

  if (!cleanName)
    return res.status(400).json({ message: "El nombre es obligatorio." });

  if (cleanEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail))
    return res.status(400).json({ message: "Email inválido." });

  if (cleanDocType && !VALID_DOC_TYPES.includes(cleanDocType))
    return res.status(400).json({ message: "Tipo de documento inválido." });

  await dbConnect();

  try {
    // Email: importante para usuarios importados/walk-in con placeholder
    // @crashpath.local — al ponerles su email real de Google, el login los
    // conecta con esta misma cuenta (login busca por email).
    if (cleanEmail) {
      const emailInUse = await User.findOne({ email: cleanEmail, _id: { $ne: userId } });
      if (emailInUse) {
        return res.status(409).json({
          message: "Ese email ya está en uso por otra cuenta.",
          code: "EMAIL_IN_USE",
        });
      }
    }

    const updateFields = {};

    if (cleanName) updateFields.name = cleanName;
    if (cleanEmail) updateFields.email = cleanEmail;
    if (cleanPhone) updateFields.phone = cleanPhone;
    if (cleanDocType) updateFields.documentType = cleanDocType;
    if (cleanDocNumber) updateFields.documentNumber = cleanDocNumber;
    if (cleanEps) updateFields.epsName = cleanEps;
    if (cleanEcn) updateFields.emergencyContactName = cleanEcn;
    if (cleanEcp) updateFields.emergencyContactPhone = cleanEcp;

    const user = await User.findByIdAndUpdate(
      userId,
      { $set: updateFields },
      { new: true, runValidators: true }
    );

    if (!user)
      return res.status(404).json({ message: "Usuario no encontrado." });

    const auditEvent = await logAudit({
      action: "UPDATE_PROFILE",
      actor,
      user,
      summary: `Perfil actualizado: ${user.name}`,
      meta: { fields: Object.keys(updateFields) },
    });

    return res.status(200).json({
      message: "Perfil actualizado correctamente.",
      user,
      auditEvent,
    });
  } catch (err) {
    console.error("UPDATE PROFILE ERROR:", err);
    return res.status(500).json({ message: "Error actualizando el perfil." });
  }
}