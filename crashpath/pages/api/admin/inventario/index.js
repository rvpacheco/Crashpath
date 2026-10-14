// GET  /api/admin/inventario -> stock actual + últimos movimientos
// POST /api/admin/inventario -> registra una venta, una llegada o un ajuste
//
// Ver y vender: quien puede cobrar (admin o voluntario de turno). Quién vendió
// sale de la sesión, no del formulario: no se puede anotar una venta a nombre
// de otro. Llegadas y ajustes de conteo: solo admin.
import dbConnect from "../../../../lib/mongodb";
import MovimientoInventario from "../../../../models/MovimientoInventario";
import { requireAuth, PERMISOS, puede } from "../../../../lib/authz";
import { logAudit } from "../../../../lib/audit";
import {
  PRODUCTOS,
  TIPOS,
  productoPorClave,
  precioDeVenta,
  validarMovimiento,
  resumenMovimiento,
} from "../../../../lib/inventario";

const MOVIMIENTOS_RECIENTES = 50;

async function stockActual() {
  const filas = await MovimientoInventario.aggregate([
    { $group: { _id: "$producto", stock: { $sum: "$delta" } } },
  ]);
  const stock = Object.fromEntries(PRODUCTOS.map((p) => [p.clave, 0]));
  for (const f of filas) if (f._id in stock) stock[f._id] = f.stock;
  return stock;
}

function plano(m) {
  return {
    _id: String(m._id),
    ts: m.ts,
    producto: m.producto,
    tipo: m.tipo,
    cantidad: m.cantidad,
    delta: m.delta,
    conteo: m.conteo ?? null,
    total: m.total ?? null,
    tarifa: m.tarifa || null,
    por: m.por?.name || m.por?.email || null,
    porEmail: m.por?.email || null,
    nota: m.nota || null,
  };
}

export default async function handler(req, res) {
  let actor;
  try {
    actor = await requireAuth(req, res, PERMISOS.COBRAR);
  } catch {
    return;
  }

  await dbConnect();

  if (req.method === "GET") {
    try {
      const [stock, movimientos] = await Promise.all([
        stockActual(),
        MovimientoInventario.find().sort({ ts: -1 }).limit(MOVIMIENTOS_RECIENTES).lean(),
      ]);
      res.setHeader("Cache-Control", "no-store");
      return res.status(200).json({ stock, movimientos: movimientos.map(plano) });
    } catch (e) {
      console.error("inventario list error:", e?.message || e);
      return res.status(500).json({ message: "No se pudo cargar el inventario" });
    }
  }

  if (req.method === "POST") {
    const { tipo, producto } = req.body || {};
    const nota = String(req.body?.nota || "").trim().slice(0, 300);

    if (tipo !== TIPOS.VENTA && !puede(actor.rol, PERMISOS.INVENTARIO_GESTIONAR)) {
      return res.status(403).json({
        message: "Solo un admin puede cargar mercancía o ajustar el conteo.",
        code: "FORBIDDEN",
      });
    }

    try {
      const stock = await stockActual();
      const v = validarMovimiento(req.body || {}, stock[producto] ?? 0);
      if (!v.ok) return res.status(400).json({ message: v.message, code: v.code });

      const prod = productoPorClave(producto);
      const esVenta = tipo === TIPOS.VENTA;

      let precio;
      if (esVenta) {
        precio = precioDeVenta({ producto, tarifa: req.body?.tarifa, nota });
        if (!precio.ok) return res.status(400).json({ message: precio.message, code: precio.code });
      }

      const mov = await MovimientoInventario.create({
        ts: new Date(),
        producto,
        tipo,
        cantidad: v.cantidad,
        delta: v.delta,
        conteo: tipo === TIPOS.AJUSTE ? Number(req.body.conteo) : undefined,
        precioUnitario: esVenta ? precio.precio : undefined,
        tarifa: esVenta ? precio.tarifa : undefined,
        total: esVenta ? precio.precio * v.cantidad : undefined,
        por: { email: actor.email, name: actor.name, rol: actor.rol },
        nota: nota || undefined,
      });

      const nuevoStock = { ...stock, [producto]: (stock[producto] ?? 0) + v.delta };
      const resumen = resumenMovimiento(mov);

      const auditEvent = await logAudit({
        action: tipo === TIPOS.VENTA ? "VENTA_PRODUCTO" : tipo === TIPOS.ENTRADA ? "ENTRADA_INVENTARIO" : "AJUSTE_INVENTARIO",
        actor,
        summary: `${resumen} · quedan ${nuevoStock[producto]}`,
        meta: {
          movimientoId: String(mov._id),
          producto,
          tipo,
          cantidad: v.cantidad,
          delta: v.delta,
          total: mov.total,
          tarifa: mov.tarifa,
          stockAntes: stock[producto] ?? 0,
          stockDespues: nuevoStock[producto],
          nota: nota || undefined,
        },
      });

      return res.status(201).json({
        message: `${resumen}. Quedan ${nuevoStock[producto]} ${nuevoStock[producto] === 1 ? prod.nombre.toLowerCase() : prod.plural}.`,
        stock: nuevoStock,
        movimiento: plano(mov),
        auditEvent,
      });
    } catch (e) {
      console.error("inventario post error:", e?.message || e);
      return res.status(500).json({ message: "No se pudo registrar el movimiento" });
    }
  }

  return res.status(405).json({ message: "Method not allowed" });
}
