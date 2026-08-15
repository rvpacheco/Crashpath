// pages/api/admin/visits/[id].js
import { requireAuth, PERMISOS } from "@/lib/authz";
import dbConnect from "@/lib/mongodb";
import User from "@/models/User";
import { logAudit } from "@/lib/audit";

export default async function handler(req, res) {
  let actor;
  try {
    actor = await requireAuth(req, res, PERMISOS.CHECKIN);
  } catch {
    return;
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
    
    // Admin puede editar cualquier campo
    if (status) user.visits[visitIndex].status = status;
    if (notes !== undefined) user.visits[visitIndex].notes = notes;
    if (date) {
      user.visits[visitIndex].date = date;
      user.visits[visitIndex].checkedInAt = date;
    }
    
    await user.save();

    const auditEvent = await logAudit({
      action: "VISIT_EDIT",
      actor,
      user,
      summary: `Visita editada${status ? `: ${status}` : ""}`,
      meta: { visitId: id, status, notes, date },
    });

    res.status(200).json({
      message: "Visita actualizada correctamente",
      auditEvent,
    });
  } catch (error) {
    console.error("Error editing visit:", error);
    res.status(500).json({ message: "Error al editar la visita: " + error.message });
  }
}