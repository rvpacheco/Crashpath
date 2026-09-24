// Quién está vigente y cómo encontrar a alguien por nombre. Puro: sin DB, para
// que el criterio se pueda testear y sea el mismo en el MCP y en los scripts.
//
// Criterio de "vigente" (docs/ideas-pendientes.md, el del conteo del 23/09/2026):
//   - Mensualidad: mensualidad.endDate >= hoy.
//   - Tiquetera:   credits > 0 y tiquetera.endDate >= hoy. Sin fecha NO cuenta
//     como vigente hasta que se le ponga una.
// "hoy" es el inicio del día en Bogotá: quien vence hoy sigue vigente hoy.

import { dayRangeBogota } from "./dates.js";

const DIA_MS = 86400000;

/** Inicio del día de hoy en Bogotá (o del día de `ahora`). */
export function inicioDeHoy(ahora = new Date()) {
  return dayRangeBogota(ahora).start;
}

const fecha = (v) => (v ? new Date(v) : null);

/** Día calendario en Bogotá ("YYYY-MM-DD") o null. */
export function diaBogota(v) {
  const d = fecha(v);
  if (!d || Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString("en-CA", { timeZone: "America/Bogota" });
}

/**
 * Estado de acceso de un usuario.
 * @returns {{ tipo, vigente, vence, creditos, motivo }}
 *   vence: Date|null · motivo: por qué no está vigente (null si lo está)
 */
export function estadoAcceso(user, ahora = new Date()) {
  const hoy = inicioDeHoy(ahora);

  if (user?.accessType === "mensualidad") {
    const vence = fecha(user.mensualidad?.endDate);
    if (!vence) return { tipo: "mensualidad", vigente: false, vence: null, creditos: null, motivo: "sin fecha de vencimiento" };
    const vigente = vence >= hoy;
    return { tipo: "mensualidad", vigente, vence, creditos: null, motivo: vigente ? null : "mensualidad vencida" };
  }

  if (user?.accessType === "ticketera") {
    const creditos = user.credits ?? 0;
    const vence = fecha(user.tiquetera?.endDate);
    let motivo = null;
    if (creditos <= 0) motivo = "sin créditos";
    else if (!vence) motivo = "tiquetera sin fecha de vencimiento";
    else if (vence < hoy) motivo = "tiquetera vencida";
    return { tipo: "tiquetera", vigente: !motivo, vence, creditos, motivo };
  }

  return { tipo: null, vigente: false, vence: null, creditos: null, motivo: "sin modalidad elegida" };
}

/**
 * ¿Está por vencer en los próximos `dias` días (hoy incluido)? Para
 * tiquetera también cuenta quedarse con `minCreditos` o menos.
 * Devuelve el motivo o null.
 */
export function porVencer(user, { dias = 7, minCreditos = 1, ahora = new Date() } = {}) {
  const estado = estadoAcceso(user, ahora);
  if (!estado.vigente) return null;

  const limite = new Date(inicioDeHoy(ahora).getTime() + (dias + 1) * DIA_MS - 1);
  const motivos = [];
  if (estado.vence && estado.vence <= limite) motivos.push(`vence el ${diaBogota(estado.vence)}`);
  if (estado.tipo === "tiquetera" && estado.creditos <= minCreditos) {
    motivos.push(`le queda${estado.creditos === 1 ? "" : "n"} ${estado.creditos} crédito${estado.creditos === 1 ? "" : "s"}`);
  }
  return motivos.length ? motivos.join(" y ") : null;
}

/* -------------------- BÚSQUEDA POR NOMBRE -------------------- */

/** Minúsculas, sin tildes ni signos: "José  Pérez-Ñ" → "jose perez n". */
export function normalizarTexto(v) {
  return String(v ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9@.+]+/g, " ")
    .trim();
}

/**
 * Qué tan bien calza `consulta` con el usuario. 0 = no calza.
 * Tolera nombres incompletos ("juan hern" → "Juan Carlos Hernández") y
 * tildes. También busca por email, teléfono y documento.
 */
export function puntajeBusqueda(user, consulta) {
  const q = normalizarTexto(consulta);
  if (!q) return 0;

  const nombre = normalizarTexto(user?.name);
  if (nombre && nombre === q) return 100;

  const palabrasNombre = nombre.split(" ").filter(Boolean);
  const palabrasQ = q.split(" ").filter(Boolean);

  // Cada palabra de la consulta tiene que ser el comienzo de alguna palabra
  // del nombre. Así "ana" no trae a "Mariana" pero "hern" sí trae "Hernández".
  const todasPorPrefijo = palabrasQ.every((pq) => palabrasNombre.some((pn) => pn.startsWith(pq)));
  if (todasPorPrefijo) {
    const exactas = palabrasQ.filter((pq) => palabrasNombre.includes(pq)).length;
    return 50 + exactas * 10 - Math.max(0, palabrasNombre.length - palabrasQ.length);
  }

  const compacto = q.replace(/\s+/g, "");
  if (compacto.length >= 4) {
    const email = String(user?.email ?? "").toLowerCase();
    const telefono = String(user?.phone ?? "").replace(/\D/g, "");
    const documento = String(user?.documentNumber ?? "").replace(/\s/g, "").toLowerCase();
    if (email.includes(compacto)) return 40;
    if (/^\d+$/.test(compacto) && (telefono.includes(compacto) || documento.includes(compacto))) return 40;
  }

  return 0;
}

/** Filtra y ordena usuarios por `consulta`, mejores primero. */
export function buscarUsuarios(usuarios, consulta, limite = 10) {
  return usuarios
    .map((u) => ({ u, p: puntajeBusqueda(u, consulta) }))
    .filter((x) => x.p > 0)
    .sort((a, b) => b.p - a.p || String(a.u.name).localeCompare(String(b.u.name)))
    .slice(0, limite)
    .map((x) => x.u);
}
