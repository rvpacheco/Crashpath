// ============================================
// MODO PRIVACIDAD - funciones de enmascaramiento
// ============================================
// Funciones puras, solo para presentación en pantalla.
// Nunca tocan API, base de datos ni exportaciones.
// Todas devuelven "" para valores vacíos/nulos, de modo que los
// fallbacks existentes en la UI ("Sin nombre", "—") sigan aplicando.

const BULLETS = "•••";

/**
 * "Carol giuliana cuello rodriguez" -> "C. G. C. R."
 * @param {string|null|undefined} name
 * @returns {string}
 */
export function maskName(name) {
  if (typeof name !== "string") return "";
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "";
  return parts.map((part) => `${part[0].toUpperCase()}.`).join(" ");
}

/**
 * "perika81@hotmail.com" -> "p•••@hotmail.com"
 * Sin "@": conserva solo el primer carácter ("loquesea" -> "l•••").
 * @param {string|null|undefined} email
 * @returns {string}
 */
export function maskEmail(email) {
  if (typeof email !== "string") return "";
  const value = email.trim();
  if (!value) return "";
  const at = value.indexOf("@");
  if (at < 0) return `${value[0]}${BULLETS}`;
  if (at === 0) return `${BULLETS}${value}`;
  return `${value[0]}${BULLETS}@${value.slice(at + 1)}`;
}

/**
 * "3012343563" -> "••• ••• 3563" (conserva últimos 4 dígitos).
 * Con 4 dígitos o menos se oculta todo para no revelar el número completo.
 * @param {string|number|null|undefined} phone
 * @returns {string}
 */
export function maskPhone(phone) {
  if (phone === null || phone === undefined) return "";
  const value = String(phone).trim();
  if (!value) return "";
  const digits = value.replace(/\D/g, "");
  if (digits.length <= 4) return `${BULLETS} ${BULLETS}`;
  return `${BULLETS} ${BULLETS} ${digits.slice(-4)}`;
}

/**
 * "1098794340" -> "•••••340" (conserva últimos 3 dígitos).
 * Acepta también el valor combinado "CC 1098794340" -> "CC •••••340"
 * conservando el prefijo de tipo de documento.
 * Con 3 dígitos o menos se oculta todo.
 * @param {string|number|null|undefined} doc
 * @returns {string}
 */
export function maskDocument(doc) {
  if (doc === null || doc === undefined) return "";
  const value = String(doc).trim();
  if (!value) return "";
  const withPrefix = value.match(/^([A-Za-z.]+)\s+(.+)$/);
  if (withPrefix) return `${withPrefix[1]} ${maskDocument(withPrefix[2])}`;
  const digits = value.replace(/\D/g, "") || value;
  if (digits.length <= 3) return "•••••";
  return `•••••${digits.slice(-3)}`;
}
