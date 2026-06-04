
import { getServerSession } from "next-auth";
import { authOptions } from "../../../auth/[...nextauth]";
import dbConnect from "@/lib/mongodb";
import mongoose from 'mongoose';

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
    
    // Definir modelos solo si no existen (para evitar errores)
    let User, MoonReservation, Audit;
    
    if (mongoose.models.User) {
      User = mongoose.models.User;
    } else {
      const userSchema = new mongoose.Schema({}, { strict: false });
      User = mongoose.model('User', userSchema);
    }
    
    if (mongoose.models.MoonReservation) {
      MoonReservation = mongoose.models.MoonReservation;
    } else {
      const moonReservationSchema = new mongoose.Schema({}, { strict: false });
      MoonReservation = mongoose.model('MoonReservation', moonReservationSchema);
    }
    
    if (mongoose.models.Audit) {
      Audit = mongoose.models.Audit;
    } else {
      const auditSchema = new mongoose.Schema({
        action: String,
        userId: String,
        userName: String,
        userEmail: String,
        actorName: String,
        actorEmail: String,
        summary: String,
        ts: Date
      }, { timestamps: true });
      Audit = mongoose.model('Audit', auditSchema);
    }
    
    // Obtener el usuario antes de eliminar para el audit log
    const userToDelete = await User.findById(id);
    
    if (!userToDelete) {
      return res.status(404).json({ message: "Usuario no encontrado" });
    }
    
    // Eliminar el usuario
    const result = await User.findByIdAndDelete(id);
    
    if (!result) {
      return res.status(404).json({ message: "Usuario no encontrado" });
    }
    
    // También eliminar sus reservas de moonboard
    await MoonReservation.deleteMany({ userId: id });
    
    // Registrar en audit log
    const auditEvent = new Audit({
      action: "delete_user",
      userId: id,
      userName: userToDelete.name || userToDelete.email,
      userEmail: userToDelete.email,
      actorName: session.user.name,
      actorEmail: session.user.email,
      summary: `Usuario eliminado: ${userToDelete.name || userToDelete.email}`,
      ts: new Date(),
    });
    
    await auditEvent.save();
    
    res.status(200).json({ 
      message: "Usuario eliminado correctamente",
      auditEvent: {
        action: auditEvent.action,
        userId: auditEvent.userId,
        userName: auditEvent.userName,
        userEmail: auditEvent.userEmail,
        summary: auditEvent.summary,
        ts: auditEvent.ts
      }
    });
  } catch (error) {
    console.error("Error deleting user:", error);
    res.status(500).json({ message: "Error al eliminar el usuario: " + error.message });
  }
}