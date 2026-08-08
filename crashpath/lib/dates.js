// Helpers de fechas del negocio. El gym opera en Bogotá (UTC-5, sin DST);
// el servidor en Vercel corre en UTC, así que NUNCA usar setHours(0,0,0,0)
// para "hoy": eso da el día del SERVIDOR, no el de Bogotá.

/**
 * Rango [inicio, fin] de un día calendario en Bogotá.
 * Acepta: nada (hoy), string "YYYY-MM-DD" (se toma literal como día Bogotá),
 * o cualquier fecha (se convierte a su día en Bogotá).
 * Devuelve null si la fecha es inválida.
 */
export function dayRangeBogota(dateLike) {
  let ymd;
  if (typeof dateLike === "string" && /^\d{4}-\d{2}-\d{2}$/.test(dateLike.trim())) {
    // "YYYY-MM-DD" pelado: es un día calendario, no lo pasamos por new Date()
    // (new Date("2026-07-07") sería medianoche UTC = 7pm Bogotá del día 6).
    ymd = dateLike.trim();
  } else {
    const base = dateLike ? new Date(dateLike) : new Date();
    if (Number.isNaN(base.getTime())) return null;
    ymd = base.toLocaleDateString("en-CA", { timeZone: "America/Bogota" });
  }
  const start = new Date(`${ymd}T05:00:00.000Z`); // medianoche Bogotá
  if (Number.isNaN(start.getTime())) return null;
  const end = new Date(start.getTime() + 86400000 - 1);
  return { start, end };
}

/**
 * Convierte un día calendario "YYYY-MM-DD" al instante de Bogotá que le
 * corresponde según el borde pedido:
 *   - "start": medianoche      (00:00:00.000) → inicio de vigencia
 *   - "end":   fin del día     (23:59:59.999) → vencimiento INCLUSIVO
 *
 * El borde importa de verdad en mensualidad: el check-in se bloquea en el
 * servidor con `endDate <= now`, así que guardar el vencimiento a medianoche
 * dejaría al socio afuera durante todo su último día pago.
 *
 * Devuelve null si no hay valor (campo opcional) y undefined si el formato
 * o el día calendario son inválidos, para que quien llame distinga los casos.
 */
export function parseDayEdge(v, edge = "start") {
  if (v === null || v === undefined || v === "") return null;
  const s = String(v).trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return undefined;
  const range = dayRangeBogota(s);
  if (!range) return undefined;
  // new Date("2026-02-30T05:00:00Z") NO es inválida: Node la corre al 2 de
  // marzo. Un dedazo del admin aterrizaría en otro día sin avisar, así que se
  // verifica el ida y vuelta (start queda a las 05:00Z del MISMO día UTC).
  if (range.start.toISOString().slice(0, 10) !== s) return undefined;
  return edge === "end" ? range.end : range.start;
}

/** Día calendario de hoy en Bogotá, como "YYYY-MM-DD". */
export function todayBogotaDay() {
  return new Date().toLocaleDateString("en-CA", { timeZone: "America/Bogota" });
}

/**
 * Suma meses a un día "YYYY-MM-DD" y devuelve otro día "YYYY-MM-DD".
 * Usa la misma aritmética que /api/admin/mensualidad/renovar (setMonth), así
 * que desborda igual: 31/ene + 1 mes = 03/mar. Se hace en UTC puro para que
 * la zona del navegador no corra el día.
 */
export function addMonthsToDay(ymd, months) {
  const [y, m, d] = String(ymd).split("-").map(Number);
  const base = new Date(Date.UTC(y, m - 1, d));
  base.setUTCMonth(base.getUTCMonth() + months);
  return base.toISOString().slice(0, 10);
}

/**
 * Qué va a pasar si se guarda ese vencimiento de mensualidad. Como el
 * vencimiento bloquea el check-in, el admin tiene que ver el efecto ANTES de
 * guardar. `hoy` se inyecta para poder testear.
 */
export function mensualidadDayHint(ymd, hoy = todayBogotaDay()) {
  if (!ymd) return null;
  if (ymd < hoy) {
    return { ok: false, text: "⚠️ Fecha pasada: el usuario no podrá hacer check-in." };
  }
  if (ymd === hoy) {
    return { ok: true, text: "✓ Vence hoy: puede entrar hoy, mañana no." };
  }
  const days = Math.round(
    (Date.parse(`${ymd}T00:00:00Z`) - Date.parse(`${hoy}T00:00:00Z`)) / 86400000
  );
  return {
    ok: true,
    text: `✓ Activa · vence en ${days} día${days === 1 ? "" : "s"} (ese día incluido).`,
  };
}
