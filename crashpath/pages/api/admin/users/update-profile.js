// pages/api/admin/users/update-profile.js
import { isAdminRequest } from "../../auth/[...nextauth]";
import dbConnect from "../../../../lib/mongodb";
import User from "../../../../models/User";

const VALID_DOC_TYPES = ["CC", "CE", "TI", "PP", "NIT", "OTRO"];

export default async function handler(req, res) {
  if (req.method !== "POST")
    return res.status(405).json({ message: "Method not allowed" });

  try {
    await isAdminRequest(req, res);
  } catch {
    return;
  }

  const {
    userId,
    name,
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
  const cleanPhone = (phone || "").trim();
  const cleanDocType = (documentType || "").trim().toUpperCase();
  const cleanDocNumber = (documentNumber || "").trim();
  const cleanEps = (epsName || "").trim();
  const cleanEcn = (emergencyContactName || "").trim();
  const cleanEcp = (emergencyContactPhone || "").trim();

  if (!cleanName)
    return res.status(400).json({ message: "El nombre es obligatorio." });

  if (cleanDocType && !VALID_DOC_TYPES.includes(cleanDocType))
    return res.status(400).json({ message: "Tipo de documento inválido." });

  await dbConnect();

  try {
    const updateFields = {};

    if (cleanName) updateFields.name = cleanName;
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

    return res.status(200).json({
      message: "Perfil actualizado correctamente.",
      user,
      auditEvent: {
        action: "UPDATE_PROFILE",
        userId: String(user._id),
        userName: user.name,
        userEmail: user.email,
        actorEmail: "admin",
        summary: `Perfil actualizado: ${user.name}`,
        ts: new Date().toISOString(),
      },
    });
  } catch (err) {
    console.error("UPDATE PROFILE ERROR:", err);
    return res.status(500).json({ message: "Error actualizando el perfil." });
  }
}