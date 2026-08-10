// POST /api/admin/users/tiquetera-dates
// Editor manual de fechas de la tiquetera (inicio / vencimiento).
// Body: { userId, startDate?: "YYYY-MM-DD", endDate?: "YYYY-MM-DD" }
// Las fechas llegan como día calendario y se guardan como medianoche de
// Bogotá (05:00Z), la misma convención del import y del sistema moon.
import dbConnect from "../../../../lib/mongodb";
import User from "../../../../models/User";
import { isAdminRequest } from "../../auth/[...nextauth]";
import { logAudit } from "../../../../lib/audit";
import { sincronizarVencimiento } from "../../../../lib/cortesia";

function parseDay(v) {
  if (!v) return null;
  const m = String(v).trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return undefined; // formato inválido
  const d = new Date(`${m[0]}T05:00:00.000Z`);
  return isNaN(d.getTime()) ? undefined : d;
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ message: "Method not allowed" });
  }

  let actor;
  try {
    actor = await isAdminRequest(req, res);
  } catch {
    return;
  }

  const userId = String(req.body?.userId || "").trim();
  if (!userId) return res.status(400).json({ message: "Falta userId" });

  const startDate = parseDay(req.body?.startDate);
  const endDate = parseDay(req.body?.endDate);
  if (startDate === undefined || endDate === undefined) {
    return res.status(400).json({ message: "Fecha inválida (usa YYYY-MM-DD)" });
  }
  if (!startDate && !endDate) {
    return res.status(400).json({ message: "Debes enviar al menos una fecha" });
  }
  if (startDate && endDate && endDate < startDate) {
    return res.status(400).json({ message: "El vencimiento no puede ser antes del inicio" });
  }

  await dbConnect();

  try {
    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ message: "Usuario no encontrado" });

    if (user.accessType !== "ticketera") {
      return res.status(400).json({
        message: "Este usuario no es de tiquetera",
        code: "NOT_TICKETERA",
      });
    }

    const before = {
      startDate: user.tiquetera?.startDate || null,
      endDate: user.tiquetera?.endDate || null,
    };

    user.tiquetera = {
      ...(user.tiquetera?.toObject?.() || user.tiquetera || {}),
      startDate: startDate || user.tiquetera?.startDate,
      endDate: endDate || user.tiquetera?.endDate,
      totalUses: user.tiquetera?.totalUses || 8,
    };

    // La cortesía vence con la tiquetera: si se corre el vencimiento, se corre
    // con él. Solo si todavía tiene saldo (no revive una cortesía ya usada).
    sincronizarVencimiento(user, user.tiquetera.endDate);

    await user.save();

    const fmt = (d) =>
      d ? new Date(d).toLocaleDateString("en-CA", { timeZone: "America/Bogota" }) : "—";

    const auditEvent = await logAudit({
      action: "TIQUETERA_DATES",
      actor,
      user,
      summary: `Fechas de tiquetera: ${fmt(before.endDate)} → vence ${fmt(user.tiquetera.endDate)}`,
      meta: { before, after: { startDate: user.tiquetera.startDate, endDate: user.tiquetera.endDate } },
    });

    return res.status(200).json({
      message: "Fechas actualizadas",
      tiquetera: user.tiquetera,
      auditEvent,
    });
  } catch (err) {
    console.error("tiquetera-dates error:", err);
    return res.status(500).json({ message: "Error actualizando fechas" });
  }
}
