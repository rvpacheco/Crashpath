// pages/api/visits/[id].js
import { getServerSession } from "next-auth";
import { authOptions } from "../auth/[...nextauth]";
import dbConnect from "@/lib/mongodb";
import User from "@/models/User";

export default async function handler(req, res) {
  const session = await getServerSession(req, res, authOptions);
  
  if (!session) {
    return res.status(401).json({ message: "No autorizado" });
  }
  
  // Solo permitir DELETE (cancelar) para usuarios normales
  if (req.method !== "DELETE") {
    return res.status(405).json({ message: "Método no permitido" });
  }
  
  const { id } = req.query;
  
  if (!id) {
    return res.status(400).json({ message: "ID de visita requerido" });
  }
  
  await dbConnect();
  
  try {
    // Buscar el usuario que tiene esta visita Y que sea el mismo que la sesión
    const user = await User.findOne({
      email: session.user.email,
      "visits._id": id
    });
    
    if (!user) {
      return res.status(404).json({ message: "Visita no encontrada" });
    }
    
    const visit = user.visits.id(id);
    if (!visit) {
      return res.status(404).json({ message: "Visita no encontrada" });
    }
    
    // Verificar que la visita no sea de hoy o pasada
    const visitDate = new Date(visit.date || visit.checkedInAt);
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    
    if (visitDate < today) {
      return res.status(400).json({ message: "No puedes cancelar visitas pasadas" });
    }
    
    // Verificar que no esté ya cancelada
    if (visit.status === "cancelled") {
      return res.status(400).json({ message: "Esta visita ya está cancelada" });
    }
    
    // Cancelar la visita
    visit.status = "cancelled";
    await user.save();
    
    res.status(200).json({ 
      message: "Visita cancelada correctamente",
      visit: {
        id: visit._id,
        date: visit.date,
        status: visit.status
      }
    });
  } catch (error) {
    console.error("Error cancelling visit:", error);
    res.status(500).json({ message: "Error al cancelar la visita: " + error.message });
  }
}