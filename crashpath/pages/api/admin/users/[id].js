// GET /api/admin/users/[id]
// Detalle COMPLETO de un usuario (incluye firma del waiver y snapshot),
// que la lista /api/admin/users ya no manda por peso.
import mongoose from "mongoose";
import dbConnect from "../../../../lib/mongodb";
import User from "../../../../models/User";
import { isAdminRequest } from "../../auth/[...nextauth]";

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ message: "Method not allowed" });
  }

  try {
    await isAdminRequest(req, res);
  } catch {
    return;
  }

  const { id } = req.query;
  if (!id || !mongoose.isValidObjectId(id)) {
    return res.status(400).json({ message: "ID inválido" });
  }

  try {
    await dbConnect();
    const user = await User.findById(id).lean();
    if (!user) return res.status(404).json({ message: "Usuario no encontrado" });

    res.setHeader("Cache-Control", "no-store");
    return res.status(200).json({ user });
  } catch (err) {
    console.error("admin user detail error:", err);
    return res.status(500).json({ message: "Error al obtener el usuario" });
  }
}
