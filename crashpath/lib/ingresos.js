// Caja del gimnasio: cuánta plata entró, de dónde y en qué día. Puro (sin DB);
// el endpoint /api/admin/ingresos trae las filas y esto las suma.
//
// De dónde sale cada peso:
//   - Pases de día ........ la visita (`monto`, ver models/User.js). Cancelar la
//                           visita la saca de la caja.
//   - Tiqueteras y meses .. el AuditLog: cada venta deja `meta.monto`.
//   - Inventario .......... MovimientoInventario (`total` de cada venta).
//
// Los cobros hechos ANTES de que existiera `monto` no lo traen. Se estiman con
// las tarifas de lib/precios.js y quedan marcados (`estimado`) para que el
// dashboard avise que esa parte es aproximada. Lo que no se pudo reconstruir
// (tiqueteras vendidas por "Cambiar modalidad", sin créditos en el evento) se
// omite en vez de inventarlo.

import { dayRangeBogota } from "./dates";
import { precioMensualidad, precioTiquetera } from "./precios";

export const CATEGORIAS = ["dia", "tiquetera", "mensualidad", "inventario"];

export const ACCIONES_DE_COBRO = ["ADJUST_CREDITS", "MENSUALIDAD_RENEW", "ACCESS_TYPE_CHANGED", "USER_CREATE"];

const DIA_MS = 86400000;

/** "YYYY-MM-DD" de un instante, en Bogotá. */
function ymdBogota(d) {
  return new Date(d).toLocaleDateString("en-CA", { timeZone: "America/Bogota" });
}

function sumarDias(ymd, n) {
  const d = new Date(`${ymd}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/**
 * Ventana del período y la inmediatamente anterior de igual duración, en horas
 * de Bogotá (el servidor corre en UTC). "week" arranca el domingo, igual que
 * el panel.
 */
export function rangoPeriodo(periodo, now = new Date()) {
  const hoy = ymdBogota(now);
  let desde = hoy;
  if (periodo === "week") {
    const dow = new Date(`${hoy}T00:00:00Z`).getUTCDay();
    desde = sumarDias(hoy, -dow);
  } else if (periodo === "month") {
    desde = `${hoy.slice(0, 8)}01`;
  }
  const start = dayRangeBogota(desde).start;
  const end = now;
  const duracion = end.getTime() - start.getTime();
  return {
    desde,
    hoy,
    start,
    end,
    prevStart: new Date(start.getTime() - duracion - 1),
    prevEnd: new Date(start.getTime() - 1),
  };
}

const esNumero = (v) => typeof v === "number" && Number.isFinite(v);

/**
 * Convierte los eventos del AuditLog en cobros. Un evento sin `meta.monto` es
 * de antes de que se guardara: se estima. Un evento con `monto` 0 es un cambio
 * sin cobro (corrección de saldo, cambio de modalidad): no suma.
 */
export function cobrosDeAuditoria(eventos = []) {
  const cobros = [];
  for (const e of eventos) {
    const m = e?.meta || {};
    let tipo = null;
    let monto = null;
    let estimado = false;

    switch (e?.action) {
      case "ADJUST_CREDITS":
        tipo = "tiquetera";
        if (esNumero(m.monto)) monto = m.monto;
        else if (esNumero(m.delta) && m.delta > 0) {
          monto = precioTiquetera(m.delta);
          estimado = true;
        }
        break;
      case "MENSUALIDAD_RENEW":
        tipo = "mensualidad";
        if (esNumero(m.monto)) monto = m.monto;
        else {
          monto = precioMensualidad(m.months || 1);
          estimado = true;
        }
        break;
      case "ACCESS_TYPE_CHANGED":
        if (esNumero(m.monto)) {
          monto = m.monto;
          tipo = m.creditos ? "tiquetera" : "mensualidad";
        } else if (m.to === "mensualidad" && m.months > 0) {
          tipo = "mensualidad";
          monto = precioMensualidad(m.months);
          estimado = true;
        }
        break;
      case "USER_CREATE":
        if (esNumero(m.monto)) {
          monto = m.monto;
          tipo = "mensualidad";
        } else if (m.accessType === "mensualidad") {
          tipo = "mensualidad";
          monto = precioMensualidad(1);
          estimado = true;
        }
        break;
      default:
        break;
    }

    if (tipo && monto > 0) {
      cobros.push({ ts: e.ts, tipo, monto, estimado, quien: e.userName || e.userEmail || null });
    }
  }
  return cobros;
}

const vacio = () => ({ total: 0, estimado: 0, porTipo: { dia: 0, tiquetera: 0, mensualidad: 0, inventario: 0 } });

function sumar(acc, tipo, monto, estimado) {
  acc.total += monto;
  acc.porTipo[tipo] += monto;
  if (estimado) acc.estimado += monto;
}

/**
 * Arma el resumen del período.
 *
 * @param {Object} p
 * @param {Object} p.rango  - lo que devuelve rangoPeriodo()
 * @param {Array}  p.pases  - [{ ts, monto, conZapatos, quien }] pases de día (no cancelados)
 * @param {Array}  p.cobros - lo que devuelve cobrosDeAuditoria()
 * @param {Array}  p.ventas - [{ ts, total, producto }] ventas de inventario
 */
export function armarResumen({ rango, pases = [], cobros = [], ventas = [] }) {
  const actual = vacio();
  const previo = vacio();
  const porDia = new Map();
  const pasesDelPeriodo = { sinZapatos: 0, conZapatos: 0 };

  const dentro = (ts, a, b) => {
    const t = new Date(ts).getTime();
    return t >= a.getTime() && t <= b.getTime();
  };

  const registrar = (ts, tipo, monto, estimado = false) => {
    if (!(monto > 0)) return;
    if (dentro(ts, rango.start, rango.end)) {
      sumar(actual, tipo, monto, estimado);
      const dia = ymdBogota(ts);
      const fila = porDia.get(dia) || { dia, total: 0, dia_: 0, tiquetera: 0, mensualidad: 0, inventario: 0 };
      fila.total += monto;
      fila[tipo === "dia" ? "dia_" : tipo] += monto;
      porDia.set(dia, fila);
    } else if (dentro(ts, rango.prevStart, rango.prevEnd)) {
      sumar(previo, tipo, monto, estimado);
    }
  };

  for (const p of pases) {
    registrar(p.ts, "dia", p.monto);
    if (dentro(p.ts, rango.start, rango.end)) pasesDelPeriodo[p.conZapatos ? "conZapatos" : "sinZapatos"] += 1;
  }
  for (const c of cobros) registrar(c.ts, c.tipo, c.monto, c.estimado);
  for (const v of ventas) registrar(v.ts, "inventario", v.total);

  // Todos los días del período, aunque estén en cero: una barra vacía también
  // dice algo (ese día no se vendió nada).
  const dias = [];
  for (let d = rango.desde; d <= rango.hoy; d = sumarDias(d, 1)) {
    const f = porDia.get(d);
    dias.push({
      dia: d,
      total: f?.total || 0,
      porTipo: {
        dia: f?.dia_ || 0,
        tiquetera: f?.tiquetera || 0,
        mensualidad: f?.mensualidad || 0,
        inventario: f?.inventario || 0,
      },
    });
  }

  const cambio = previo.total === 0 ? null : ((actual.total - previo.total) / previo.total) * 100;

  return {
    desde: rango.desde,
    hasta: rango.hoy,
    total: actual.total,
    porTipo: actual.porTipo,
    estimado: actual.estimado,
    previo: previo.total,
    cambio,
    pases: pasesDelPeriodo,
    dias,
  };
}

export { DIA_MS };
