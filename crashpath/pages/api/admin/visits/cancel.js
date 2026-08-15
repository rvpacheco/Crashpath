// pages/api/admin/visits/cancel.js
import { getToken } from "next-auth/jwt";
import dbConnect from "../../../../lib/mongodb";
import User from "../../../../models/User";
import { logAudit } from "../../../../lib/audit";

const secret = process.env.NEXTAUTH_SECRET;

/**
 * POST /api/admin/visits/cancel
 * Body:
 *  - userId: string (required)
 *  - visitId: string (required)  // _id del subdocumento visit
 *  - notes?: string
 *  - refund?: boolean (optional, default false) // si quieres reembolsar el crédito manualmente
 *
 * Marca la visita como cancelled.
 * Por defecto NO reembolsa crédito (mantiene tu lógica Flow B).
 */
export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ message: "Method not allowed" });

  const token = await getToken({ req, secret });
  if (!token) return res.status(401).json({ message: "Not authenticated" });
  if (!token?.isAdmin) return res.status(403).json({ message: "Forbidden" });

  const userId = String(req.body?.userId || "").trim();
  const visitId = String(req.body?.visitId || "").trim();
  const notes = String(req.body?.notes || "").trim();
  const refund = Boolean(req.body?.refund || false);

  if (!userId || !visitId) {
    return res.status(400).json({ message: "Missing userId or visitId" });
  }

  await dbConnect();

  try {
    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ message: "User not found" });

    const visit = user.visits?.id(visitId);
    if (!visit) return res.status(404).json({ message: "Visit not found" });

    // si ya está cancelada, idempotente
    if (String(visit.status).toLowerCase() === "cancelled") {
      return res.status(200).json({ message: "Visit already cancelled", user });
    }

    visit.status = "cancelled";
    if (notes) visit.notes = notes;

    if (refund) {
      user.credits = (user.credits ?? 0) + 1;
    }

    await user.save();

    const auditEvent = await logAudit({
      action: "VISIT_CANCEL",
      actor: { email: token?.email, name: token?.name, id: token?.sub },
      user,
      summary: `Visita cancelada${refund ? " + crédito reembolsado" : ""}`,
      meta: { visitId, refund, credits: user.credits },
    });

    return res.status(200).json({
      message: refund ? "Visit cancelled + refunded" : "Visit cancelled",
      user,
      auditEvent,
    });
  } catch (err) {
    console.error("admin visits cancel error:", err);
    return res.status(500).json({ message: "Failed to cancel visit" });
  }
}
