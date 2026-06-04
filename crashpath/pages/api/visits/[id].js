// pages/api/admin/visits/[id].js
import { getServerSession } from "next-auth";
import { authOptions } from "../../auth/[...nextauth]";
import dbConnect from "@/lib/mongodb";
import User from "@/models/User";
import Audit from "@/models/Audit";

export default async function handler(req, res) {
  const session = await getServerSession(req, res, authOptions);
  if (!session?.isAdmin) return res.status(401).json({ message: "No autorizado" });
  
  if (req.method !== "PUT") {
    return res.status(405).json({ message: "Método no permitido" });
  }
  
  const { id } = req.query;
  const { userId, status, notes, date } = req.body;
  
  await dbConnect();
  
  try {
    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ message: "Usuario no encontrado" });
    
    const visitIndex = user.visits.findIndex(v => v._id.toString() === id);
    if (visitIndex === -1) return res.status(404).json({ message: "Visita no encontrada" });
    
    user.visits[visitIndex].status = status;
    user.visits[visitIndex].notes = notes;
    user.visits[visitIndex].date = date;
    user.visits[visitIndex].checkedInAt = date;
    
    await user.save();
    
    const auditEvent = await Audit.create({
      action: "edit_visit",
      userId: user._id,
      userName: user.name,
      userEmail: user.email,
      actorName: session.user.name,
      actorEmail: session.user.email,
      summary: `Visita editada: ${status}`,
      ts: new Date(),
    });
    
    res.status(200).json({ message: "Visita actualizada", auditEvent });
  } catch (error) {
    console.error("Error editing visit:", error);
    res.status(500).json({ message: "Error al editar la visita" });
  }
}