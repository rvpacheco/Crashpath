import { getServerSession } from "next-auth";
import { authOptions } from "../../../auth/[...nextauth]";
import dbConnect from "@/lib/mongodb";
import mongoose from "mongoose";
import User from "@/models/User";
import MoonReservation from "@/models/MoonReservation";
import { logAudit } from "@/lib/audit";

export default async function handler(req, res) {
  const session = await getServerSession(req, res, authOptions);

  if (!session || !session.isAdmin) {
    return res.status(401).json({ message: "No autorizado" });
  }

  if (req.method !== "DELETE") {
    return res.status(405).json({ message: "Método no permitido" });
  }

  const { id } = req.query;

  if (!id || !mongoose.Types.ObjectId.isValid(id)) {
    return res.status(400).json({ message: "ID de usuario inválido" });
  }

  try {
    await dbConnect();

    const userToDelete = await User.findById(id);
    if (!userToDelete) {
      return res.status(404).json({ message: "Usuario no encontrado" });
    }

    await User.findByIdAndDelete(id);

    // Eliminar sus reservas de moonboard. El userId en MoonReservation puede
    // ser el sub de Google (reserva propia) o el _id (reserva creada por admin),
    // así que cubrimos ambos casos por email.
    await MoonReservation.deleteMany({
      $or: [{ userId: String(id) }, { userEmail: userToDelete.email }],
    });

    const auditEvent = await logAudit({
      action: "USER_DELETE",
      actor: { email: session.user?.email, name: session.user?.name },
      user: userToDelete,
      summary: `Usuario eliminado: ${userToDelete.name || userToDelete.email}`,
    });

    res.status(200).json({
      message: "Usuario eliminado correctamente",
      auditEvent,
    });
  } catch (error) {
    console.error("Error deleting user:", error);
    res.status(500).json({ message: "Error al eliminar el usuario: " + error.message });
  }
}
