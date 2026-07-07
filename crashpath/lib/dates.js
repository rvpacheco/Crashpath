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
