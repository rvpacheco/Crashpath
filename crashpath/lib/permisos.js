// Qué puede hacer cada rol. Se declara como capacidades y no como `if (rol ===
// "staff")` regado por los endpoints: cuando cambie lo que puede un voluntario
// se edita una sola tabla, y el panel esconde exactamente los mismos botones
// que el servidor bloquea (los dos importan este módulo).
//
// Puro: sin DB, sin next-auth. Quién es quién lo resuelve lib/authz.js.

export const PERMISOS = {
  // ── Operación de mostrador ────────────────────────────────────────
  VER_SOCIOS: "ver_socios",         // lista de usuarios (recortada si no hay VER_SENSIBLE)
  CHECKIN: "checkin",               // registrar visita, check-in, cancelar
  COBRAR: "cobrar",                 // créditos, renovar mensualidad, fijar modalidad
  CORTESIA_USAR: "cortesia_usar",   // entrar al invitado con el pase del socio
  CREAR_USUARIO: "crear_usuario",   // walk-in nuevo en el mostrador
  WAIVER_FIRMAR: "waiver_firmar",
  MOON: "moon",                     // reservas de MoonBoard

  // ── Solo admin ────────────────────────────────────────────────────
  VER_SENSIBLE: "ver_sensible",         // documento, teléfono, EPS, datos médicos, firma
  VER_INGRESOS: "ver_ingresos",         // KPIs de plata del panel
  VER_AUDITORIA: "ver_auditoria",
  EDITAR_PERFIL: "editar_perfil",       // update-profile: escribe datos sensibles ajenos
  EDITAR_FECHAS: "editar_fechas",       // editores manuales de vigencia
  CORTESIA_CORREGIR: "cortesia_corregir", // dar/quitar cortesía por fuera del ciclo
  EXPORTAR: "exportar",
  IMPORTAR: "importar",
  BORRAR_USUARIO: "borrar_usuario",
  GESTIONAR_STAFF: "gestionar_staff",   // otorgar y revocar turnos de voluntario
};

export const ROL_ADMIN = "admin";
export const ROL_STAFF = "staff";

/**
 * Lo que puede el voluntario durante su turno: atender y cobrar, nada más.
 *
 * Esta lista es la definición del rol; todo lo que NO esté acá queda en admin.
 * El orden importa para el fail-safe: un permiso nuevo que se agregue arriba
 * nace siendo solo de admin y hay que sumarlo acá a propósito, en vez de
 * filtrarse al voluntario por descuido.
 */
const PERMISOS_STAFF = [
  PERMISOS.VER_SOCIOS,
  PERMISOS.CHECKIN,
  PERMISOS.COBRAR,
  PERMISOS.CORTESIA_USAR,
  PERMISOS.CREAR_USUARIO,
  PERMISOS.WAIVER_FIRMAR,
  PERMISOS.MOON,
];

const TODOS = Object.values(PERMISOS);

const POR_ROL = {
  [ROL_ADMIN]: TODOS,
  [ROL_STAFF]: PERMISOS_STAFF,
};

/** Permisos de un rol. Rol desconocido o nulo => ninguno. */
export function permisosDe(rol) {
  return POR_ROL[rol] ? [...POR_ROL[rol]] : [];
}

/** ¿El rol tiene ese permiso? Sin rol o permiso inválido => false. */
export function puede(rol, permiso) {
  if (!rol || !permiso) return false;
  return (POR_ROL[rol] || []).includes(permiso);
}

/** Etiqueta para la UI. */
export function nombreRol(rol) {
  if (rol === ROL_ADMIN) return "Administrador";
  if (rol === ROL_STAFF) return "Voluntario";
  return null;
}
