// Helpers PUROS del import/export de Excel (sin DB, sin next-auth) para
// poder testearlos aislados. Los usa /api/admin/import-xlsx.

/** Medianoche de Bogotá respecto a UTC (UTC-5, sin DST). */
export const BOGOTA_OFFSET_MS = 5 * 3600000;

/** Normaliza un nombre para comparar: sin tildes, minúsculas, espacios simples. */
export function normalizeName(s) {
  return String(s || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

/** exceljs puede devolver Date, número serial de Excel, string, richText o fórmula. */
export function cellText(v) {
  if (v == null) return "";
  if (typeof v === "object") {
    if (v.richText) return v.richText.map((r) => r.text).join("");
    if (v.result != null) return String(v.result);
    if (v instanceof Date) return v.toISOString();
    return String(v.text ?? "");
  }
  return String(v);
}

/**
 * Convierte una celda de Excel a Date en "día calendario de Bogotá"
 * (medianoche Bogotá = 05:00Z). Soporta: Date, serial de Excel, fórmula
 * ({ formula, result }), "dd/mm/yyyy" y strings parseables. null si no aplica.
 */
export function toDate(v) {
  if (v == null || v === "") return null;
  if (v instanceof Date) {
    if (isNaN(v.getTime())) return null;
    // exceljs ya la parseó como medianoche UTC: correr a medianoche Bogotá
    return new Date(v.getTime() + BOGOTA_OFFSET_MS);
  }
  // Celdas con fórmula (ej. "=B2+30"): exceljs devuelve { formula, result }
  if (typeof v === "object" && v.result != null) return toDate(v.result);
  if (typeof v === "number") {
    // Serial de Excel (época 1899-12-30)
    if (v < 20000 || v > 60000) return null; // fuera de rango razonable
    return new Date(Date.UTC(1899, 11, 30) + v * 86400000 + BOGOTA_OFFSET_MS);
  }
  const s = String(v).trim();
  // dd/mm/yyyy
  const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (m) return new Date(Date.UTC(+m[3], +m[2] - 1, +m[1], 5));
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
}

export function toInt(v) {
  const n = Number(cellText(v));
  return Number.isFinite(n) ? Math.trunc(n) : null;
}

/**
 * Distancia de edición ≤ 1 (tolera un error de dedo: Stphany/Stephany,
 * Gonzales/Gonzalez). Más de eso no, para no inventar matches.
 */
export function lev1(a, b) {
  if (a === b) return true;
  if (Math.abs(a.length - b.length) > 1) return false;
  let i = 0,
    j = 0,
    edits = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) {
      i++;
      j++;
      continue;
    }
    if (++edits > 1) return false;
    if (a.length > b.length) i++;
    else if (b.length > a.length) j++;
    else {
      i++;
      j++;
    }
  }
  return edits + (a.length - i) + (b.length - j) <= 1;
}

/**
 * Match por tokens: TODAS las palabras del nombre del Excel (≥3 letras)
 * deben aparecer en el nombre del panel, tolerando 1 letra por palabra.
 * Cubre "Jorge Ramirez" vs "Jorge Andrés Ramírez Gómez" y errores de dedo.
 */
export function tokenMatch(excelName, panelName) {
  const excelTokens = normalizeName(excelName)
    .split(" ")
    .filter((t) => t.length >= 3);
  if (excelTokens.length === 0) return false;
  const panelTokens = normalizeName(panelName).split(" ");
  return excelTokens.every((et) => panelTokens.some((pt) => lev1(et, pt)));
}
