import { requireAuth, PERMISOS } from "../../../../lib/authz";
import dbConnect from "../../../../lib/mongodb";
import { hacerCheckin } from "../../../../lib/operaciones";

function normalizeEmail(v) {
  return typeof v === "string" ? v.trim().toLowerCase() : "";
}

function getReqMeta(req) {
  const xf = req.headers["x-forwarded-for"];
  const ip = Array.isArray(xf) ? xf[0] : (xf || "").split(",")[0].trim();
  return {
    ip: ip || null,
    userAgent: req.headers["user-agent"] || null,
  };
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ message: "Method not allowed" });

  let actor;
  try {
    actor = await requireAuth(req, res, PERMISOS.CHECKIN);
  } catch {
    return;
  }

  // `pase`: "dia" (con `zapatos` true/false) o "voluntario". Sin pase es el
  // check-in normal por tiquetera o mensualidad.
  const { userId, email, date, createIfMissing = true, notes = "", pase, zapatos, acompanantes } = req.body || {};
  if (!userId && !email) return res.status(400).json({ message: "Provide userId or email" });

  await dbConnect();

  const query = userId ? { _id: userId } : { email: normalizeEmail(email) };

  try {
    // La lógica vive en lib/operaciones.js: la comparte con el MCP.
    const { status, body } = await hacerCheckin({
      query,
      actor,
      meta: getReqMeta(req),
      date,
      createIfMissing,
      notes,
      pase: pase || undefined,
      zapatos,
      acompanantes: acompanantes === undefined ? 0 : Number(acompanantes),
    });
    return res.status(status).json(body);
  } catch (error) {
    console.error("admin checkin error:", error);
    return res.status(500).json({ message: "Failed to check in" });
  }
}
