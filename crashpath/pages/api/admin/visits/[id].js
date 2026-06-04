// pages/api/visits/[id].js
import { getServerSession } from "next-auth";
import { authOptions } from "../../auth/[...nextauth]"; // ← Verifica que esta ruta existe
import dbConnect from "@/lib/mongodb";
import User from "@/models/User";

export default async function handler(req, res) {
  const session = await getServerSession(req, res, authOptions);
  
  if (!session || !session.isAdmin) {
    return res.status(401).json({ message: "No autorizado" });
  }
  
  if (req.method !== "PUT") {
    return res.status(405).json({ message: "Método no permitido" });
  }
  
  const { id } = req.query;
  const { userId, status, notes, date } = req.body;
  
  if (!id || !userId) {
    return res.status(400).json({ message: "Faltan parámetros" });
  }
  
  await dbConnect();
  
  try {
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: "Usuario no encontrado" });
    }
    
    const visitIndex = user.visits.findIndex(v => v._id.toString() === id);
    if (visitIndex === -1) {
      return res.status(404).json({ message: "Visita no encontrada" });
    }
    
    user.visits[visitIndex].status = status;
    if (notes !== undefined) user.visits[visitIndex].notes = notes;
    if (date) user.visits[visitIndex].date = date;
    if (date) user.visits[visitIndex].checkedInAt = date;
    
    await user.save();
    
    // Crear entrada de auditoría simple sin modelo Audit
    // Si no tienes modelo Audit, comenta esta parte
    // const auditEvent = await Audit.create({ ... });
    
    res.status(200).json({ 
      message: "Visita actualizada correctamente",
      auditEvent: {
        action: "edit_visit",
        userId: user._id,
        userName: user.name,
        summary: `Visita editada: ${status}`,
        ts: new Date()
      }
    });
  } catch (error) {
    console.error("Error editing visit:", error);
    res.status(500).json({ message: "Error al editar la visita: " + error.message });
  }
}