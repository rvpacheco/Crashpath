// GET /api/admin/users/[id]
// Detalle de un usuario (para admin incluye firma del waiver y snapshot),
// que la lista /api/admin/users ya no manda por peso.
import mongoose from "mongoose";
import dbConnect from "../../../../lib/mongodb";
import User from "../../../../models/User";
import { requireAuth, PERMISOS, opcionesRecorte } from "../../../../lib/authz";
import { proyeccionSinSensibles, recortarUsuario } from "../../../../lib/redact";

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ message: "Method not allowed" });
  }

  let actor;
  try {
    actor = await requireAuth(req, res, PERMISOS.VER_SOCIOS);
  } catch {
    return;
  }

  const { id } = req.query;
  if (!id || !mongoose.isValidObjectId(id)) {
    return res.status(400).json({ message: "ID inválido" });
  }

  try {
    await dbConnect();

    // El recorte va en la consulta y no solo sobre el resultado: el dato
    // sensible ni siquiera sale de Mongo cuando pregunta un voluntario.
    const { verSensible } = opcionesRecorte(actor);
    const query = User.findById(id);
    if (!verSensible) query.select(proyeccionSinSensibles());

    const user = await query.lean();
    if (!user) return res.status(404).json({ message: "Usuario no encontrado" });

    res.setHeader("Cache-Control", "no-store");
    return res.status(200).json({ user: recortarUsuario(user, { verSensible }) });
  } catch (err) {
    console.error("admin user detail error:", err);
    return res.status(500).json({ message: "Error al obtener el usuario" });
  }
}
