// GET /api/admin/ingresos?periodo=today|week|month
//
// La caja del gimnasio: pases de día, tiqueteras, mensualidades e inventario,
// con el período anterior para comparar. Solo admin (VER_INGRESOS): el
// voluntario no ve plata. Las cuentas viven en lib/ingresos.js.
import dbConnect from "../../../lib/mongodb";
import User from "../../../models/User";
import AuditLog from "../../../models/AuditLog";
import MovimientoInventario from "../../../models/MovimientoInventario";
import { requireAuth, PERMISOS } from "../../../lib/authz";
import { rangoPeriodo, cobrosDeAuditoria, armarResumen, ACCIONES_DE_COBRO } from "../../../lib/ingresos";

const PERIODOS = ["today", "week", "month"];

export default async function handler(req, res) {
  try {
    await requireAuth(req, res, PERMISOS.VER_INGRESOS);
  } catch {
    return;
  }

  if (req.method !== "GET") return res.status(405).json({ message: "Method not allowed" });

  const periodo = PERIODOS.includes(req.query.periodo) ? req.query.periodo : "today";

  try {
    await dbConnect();
    const rango = rangoPeriodo(periodo);
    const rangoTs = { $gte: rango.prevStart, $lte: rango.end };

    const [pasesRaw, eventos, movimientos] = await Promise.all([
      User.aggregate([
        { $match: { "visits.esPaseDia": true, "visits.date": rangoTs } },
        { $unwind: "$visits" },
        {
          $match: {
            "visits.esPaseDia": true,
            "visits.status": { $ne: "cancelled" },
            "visits.date": rangoTs,
          },
        },
        {
          $project: {
            _id: 0,
            ts: { $ifNull: ["$visits.checkedInAt", "$visits.date"] },
            monto: "$visits.monto",
            conZapatos: "$visits.conZapatos",
          },
        },
      ]),
      AuditLog.find({ action: { $in: ACCIONES_DE_COBRO }, ts: rangoTs }).lean(),
      MovimientoInventario.find({ tipo: "venta", ts: rangoTs }).lean(),
    ]);

    const resumen = armarResumen({
      rango,
      pases: pasesRaw.map((p) => ({ ...p, monto: Number(p.monto) || 0 })),
      cobros: cobrosDeAuditoria(eventos),
      ventas: movimientos.map((m) => ({ ts: m.ts, total: m.total || 0, producto: m.producto })),
    });

    res.setHeader("Cache-Control", "no-store");
    return res.status(200).json({ periodo, ...resumen });
  } catch (e) {
    console.error("ingresos error:", e?.message || e);
    return res.status(500).json({ message: "No se pudieron calcular los ingresos" });
  }
}
