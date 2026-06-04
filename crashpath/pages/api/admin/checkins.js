// pages/api/admin/checkins.js
import { getServerSession } from "next-auth";
import { authOptions } from "../auth/[...nextauth]";
import dbConnect from "@/lib/mongodb";
import User from "@/models/User";

export default async function handler(req, res) {
  const session = await getServerSession(req, res, authOptions);
  if (!session?.isAdmin) {
    return res.status(401).json({ message: "No autorizado" });
  }
  
  if (req.method !== "GET") {
    return res.status(405).json({ message: "Método no permitido" });
  }
  
  const { date } = req.query;
  if (!date) {
    return res.status(400).json({ message: "Se requiere una fecha" });
  }
  
  await dbConnect();
  
  try {
    const startDate = new Date(date);
    startDate.setHours(0, 0, 0, 0);
    const endDate = new Date(date);
    endDate.setHours(23, 59, 59, 999);
    
    const users = await User.find({
      "visits.date": { $gte: startDate, $lte: endDate },
      "visits.status": { $in: ["checked_in", "registered"] }
    }).select("name email accessType visits");
    
    const checkins = [];
    users.forEach(user => {
      user.visits.forEach(visit => {
        const visitDate = new Date(visit.date || visit.checkedInAt);
        if (visitDate >= startDate && visitDate <= endDate) {
          if (visit.status === "checked_in" || visit.status === "registered") {
            checkins.push({
              userId: user._id,
              userName: user.name,
              userEmail: user.email,
              accessType: user.accessType,
              time: visit.checkedInAt || visit.date,
              status: visit.status
            });
          }
        }
      });
    });
    
    // Ordenar por hora
    checkins.sort((a, b) => new Date(a.time) - new Date(b.time));
    
    res.status(200).json({ checkins });
  } catch (error) {
    console.error("Error fetching checkins by date:", error);
    res.status(500).json({ message: "Error al obtener los check-ins" });
  }
}