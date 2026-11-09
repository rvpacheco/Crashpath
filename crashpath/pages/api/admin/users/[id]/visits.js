import { requireAuth, PERMISOS } from "../../../../../lib/authz";
import dbConnect from "../../../../../lib/mongodb";
import User from "../../../../../models/User";

export default async function handler(req, res) {
  if (req.method !== "GET") return res.status(405).json({ message: "Method not allowed" });

  // Solo proyecta name/email/visits: nada sensible sale de acá.
  try {
    await requireAuth(req, res, PERMISOS.VER_SOCIOS);
  } catch {
    return;
  }

  const { id } = req.query;
  const limit = Math.min(parseInt(req.query.limit || "60", 10), 200);

  await dbConnect();

  const user = await User.findById(id, { name: 1, email: 1, visits: 1 }).lean();
  if (!user) return res.status(404).json({ message: "User not found" });

  const visits = Array.isArray(user.visits) ? user.visits : [];

  // Ordena desc y limita
  const sorted = visits
    .slice()
    .sort((a, b) => new Date(b.date) - new Date(a.date))
    .slice(0, limit);

  // Mapea a filas para UI
  const rows = sorted.map((v) => ({
    id: String(v._id),
    date: v.date,
    status: v.status,
    createdBy: v.createdBy,
    checkedInAt: v.checkedInAt || null,
    checkedOutAt: v.checkedOutAt || null,
    notes: v.notes || "",
    esCortesia: !!v.esCortesia,
    cortesiaHostName: v.cortesiaHostName || null,
    esPaseDia: !!v.esPaseDia,
    conZapatos: !!v.conZapatos,
    monto: v.monto ?? null,
    esVoluntario: !!v.esVoluntario,
  }));

  return res.status(200).json({
    user: { _id: String(user._id), name: user.name, email: user.email },
    visits: rows,
  });
}