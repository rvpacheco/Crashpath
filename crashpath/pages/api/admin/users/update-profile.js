// pages/api/admin/users/update-profile.js
import { requireAuth, PERMISOS } from "../../../../lib/authz";
import dbConnect from "../../../../lib/mongodb";
import { actualizarPerfil } from "../../../../lib/operaciones";

export default async function handler(req, res) {
  if (req.method !== "POST")
    return res.status(405).json({ message: "Method not allowed" });

  let actor;
  try {
    // Solo admin: el formulario de perfil escribe documento, teléfono y
    // contacto de emergencia de un tercero. Quien no puede leerlos tampoco
    // puede sobrescribirlos.
    actor = await requireAuth(req, res, PERMISOS.EDITAR_PERFIL);
  } catch {
    return;
  }

  const { userId, ...datos } = req.body || {};

  if (!userId)
    return res.status(400).json({ message: "Missing userId" });

  // El formulario siempre manda el nombre: si llega vacío es que lo borraron.
  if (!String(datos.name ?? "").trim())
    return res.status(400).json({ message: "El nombre es obligatorio." });

  await dbConnect();

  try {
    const { status, body } = await actualizarPerfil({ userId, datos, actor });
    return res.status(status).json(body);
  } catch (err) {
    console.error("UPDATE PROFILE ERROR:", err);
    return res.status(500).json({ message: "Error actualizando el perfil." });
  }
}
