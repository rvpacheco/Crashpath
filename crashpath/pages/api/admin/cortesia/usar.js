// POST /api/admin/cortesia/usar
//
// El socio (anfitrión) gasta su cortesía para meter a un invitado. El invitado
// NO queda como un "+1" dentro de la visita del socio: se crea (o se reutiliza)
// como usuario propio walk-in, firma su waiver y le queda su propia visita con
// check-in. Es lo que exige el tema legal y lo que hace que aparezca en la
// asistencia del día como una persona más.
//
// Body:
//   {
//     hostId,
//     guestUserId?,                 // si el invitado ya existe en el panel
//     guest: { name, documentType, documentNumber, phone, epsName?,
//              emergencyContactName, emergencyContactPhone, email?, esMinor? },
//     waiver: { version, waiverTextSnapshot, signatureImageUrl?, signatureText? }
//   }
//
// El waiver solo es obligatorio si el invitado todavía no lo tiene firmado.
// La lógica vive en lib/operaciones.js (compartida con el MCP).
import dbConnect from "../../../../lib/mongodb";
import { requireAuth, PERMISOS } from "../../../../lib/authz";
import { usarCortesia } from "../../../../lib/operaciones";

function getReqMeta(req) {
  const xf = req.headers["x-forwarded-for"];
  const ip = Array.isArray(xf) ? xf[0] : String(xf || "").split(",")[0].trim();
  return { ip: ip || null, userAgent: req.headers["user-agent"] || null };
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ message: "Method not allowed" });
  }

  let actor;
  try {
    actor = await requireAuth(req, res, PERMISOS.CORTESIA_USAR);
  } catch {
    return;
  }

  await dbConnect();

  try {
    const { status, body } = await usarCortesia({
      hostId: req.body?.hostId,
      guestUserId: req.body?.guestUserId,
      guest: req.body?.guest || {},
      waiver: req.body?.waiver || {},
      actor,
      meta: getReqMeta(req),
    });
    return res.status(status).json(body);
  } catch (err) {
    console.error("cortesia usar error:", err);
    if (err?.code === 11000) {
      const field = Object.keys(err.keyPattern || {})[0];
      return res.status(409).json({
        message:
          field === "phone"
            ? "Ya existe un usuario con ese teléfono."
            : "Ya existe un usuario con ese email.",
        code: "DUPLICATE",
      });
    }
    return res.status(500).json({ message: "No se pudo registrar la cortesía" });
  }
}
