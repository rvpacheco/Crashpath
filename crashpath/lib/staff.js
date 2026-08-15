// Turno de voluntario: vigencia y etiquetas. Puro (sin DB) para poder testear
// el vencimiento sin levantar Mongo; el modelo está en models/StaffGrant.js.
//
// Regla de oro del rol: OLVIDARSE DE REVOCAR TIENE QUE SER EL CAMINO SEGURO.
// Por eso el turno no se "desactiva", se VENCE, y siempre al final del día en
// que se otorgó. No hay forma de otorgar un turno sin vencimiento.

import { parseDayEdge, todayBogotaDay } from "./dates";

/**
 * Hasta cuándo vale un turno otorgado hoy: 23:59:59.999 de Bogotá.
 *
 * Va por parseDayEdge y no por setHours porque el server de Vercel corre en
 * UTC: a las 7 pm de Bogotá allá ya es el día siguiente, y un setHours daría
 * un turno que vence 5 horas tarde (o que nace vencido, según la hora).
 *
 * `hoy` se inyecta para poder testear.
 */
export function finDelTurno(hoy = todayBogotaDay()) {
  return parseDayEdge(hoy, "end");
}

/**
 * ¿El turno sirve ahora mismo? Se evalúa en CADA request (ver lib/authz.js),
 * nunca desde el JWT: si se leyera del token, revocar no tendría efecto hasta
 * el próximo login y otorgar obligaría a cerrar sesión.
 */
export function turnoVigente(grant, now = new Date()) {
  if (!grant) return false;
  if (grant.revocadoEn) return false;
  const vence = grant.vence ? new Date(grant.vence) : null;
  // Sin fecha no se asume "para siempre": se asume vencido. Un documento roto
  // o migrado a medias no debe abrir el panel.
  if (!vence || Number.isNaN(vence.getTime())) return false;
  return vence >= now;
}

/** Estado para la lista de voluntarios del panel. */
export function estadoTurno(grant, now = new Date()) {
  if (!grant) return "ninguno";
  if (grant.revocadoEn) return "revocado";
  return turnoVigente(grant, now) ? "vigente" : "vencido";
}

/**
 * Texto de la banda que ve el voluntario mientras trabaja. Que tenga la hora
 * a la vista es parte del diseño: el turno se le va a caer a medianoche y no
 * queremos que lo descubra con un error en mitad de un cobro.
 */
export function etiquetaTurno(vence) {
  const d = vence ? new Date(vence) : null;
  if (!d || Number.isNaN(d.getTime())) return "Turno de voluntario";
  const hora = d.toLocaleTimeString("es-CO", {
    timeZone: "America/Bogota",
    hour: "numeric",
    minute: "2-digit",
  });
  return `Turno de voluntario · vence hoy ${hora}`;
}
