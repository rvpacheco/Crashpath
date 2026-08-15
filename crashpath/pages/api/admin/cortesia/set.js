// POST /api/admin/cortesia/set
// Corrección manual de la cortesía. Body: { userId, accion: "otorgar" | "quitar" }
//
// El camino normal es automático: renovar la mensualidad o cargar créditos ya
// renueva la cortesía. Esto es para los casos que el automático no cubre:
//  - socios que ya venían con tiquetera vigente antes de que existiera la
//    cortesía (no van a tener una hasta su próxima compra),
//  - un ajuste de créditos que era una corrección y no una venta,
//  - devolverle la cortesía a alguien que no alcanzó a usarla.
import dbConnect from "../../../../lib/mongodb";
import User from "../../../../models/User";
import { requireAuth, PERMISOS } from "../../../../lib/authz";
import { logAudit } from "../../../../lib/audit";
import { accesoEndDate, otorgarCortesia, quitarCortesia } from "../../../../lib/cortesia";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ message: "Method not allowed" });
  }

  let actor;
  try {
    // Solo admin: dar una cortesía por fuera del ciclo de compra es regalar
    // una entrada. Usarla en un check-in sí es del turno (ver usar.js).
    actor = await requireAuth(req, res, PERMISOS.CORTESIA_CORREGIR);
  } catch {
    return;
  }

  const userId = String(req.body?.userId || "").trim();
  const accion = String(req.body?.accion || "").trim().toLowerCase();

  if (!userId) return res.status(400).json({ message: "Falta userId" });
  if (!["otorgar", "quitar"].includes(accion)) {
    return res.status(400).json({ message: "accion debe ser 'otorgar' o 'quitar'" });
  }

  await dbConnect();

  try {
    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ message: "Usuario no encontrado" });

    const antes = user.cortesia?.disponibles ?? 0;

    if (accion === "otorgar") {
      if (!user.accessType) {
        return res.status(400).json({
          message: "El usuario no tiene modalidad (tiquetera o mensualidad).",
          code: "ACCESS_TYPE_REQUIRED",
        });
      }
      // Vence con el acceso vigente. Si no hay fecha (tiquetera sin vigencia
      // cargada) queda sin vencimiento: el panel avisa, el admin decide.
      otorgarCortesia(user, { vence: accesoEndDate(user) });
    } else {
      quitarCortesia(user);
    }

    await user.save();

    const auditEvent = await logAudit({
      action: "CORTESIA_AJUSTE",
      actor,
      user,
      summary:
        accion === "otorgar"
          ? `Cortesía otorgada manualmente (antes: ${antes})`
          : `Cortesía retirada manualmente (antes: ${antes})`,
      meta: { accion, antes, despues: user.cortesia?.disponibles ?? 0 },
    });

    return res.status(200).json({
      message: accion === "otorgar" ? "Cortesía otorgada" : "Cortesía retirada",
      cortesia: user.cortesia,
      auditEvent,
    });
  } catch (err) {
    console.error("cortesia set error:", err);
    return res.status(500).json({ message: "No se pudo actualizar la cortesía" });
  }
}
