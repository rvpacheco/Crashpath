// Qué mostrar en la puerta de /admin. Puro, sin React, para poder testear
// cada caso: la pantalla logueada no se puede probar en local (falta
// NEXTAUTH_SECRET y las credenciales de Google), así que la única forma de
// verificar esto es como función.
//
// Existe porque antes "cargando" y "no autenticado" caían en la misma rama y
// a quien nunca había entrado le mostraba "Cargando sesión..." para siempre,
// sin botón para iniciar sesión.

export const ACCION_LOGIN = "login";
export const ACCION_REINTENTAR = "reintentar";
export const ACCION_INICIO = "inicio";

/**
 * @param {Object} params
 * @param {string} params.status   - el de useSession: loading|authenticated|unauthenticated
 * @param {Object|null} params.session
 * @param {Object|null} params.rolInfo - respuesta de /api/me/rol, o null si no llegó
 * @param {boolean} params.rolError    - no se pudo consultar el rol
 * @returns {{texto: string, accion: string|null}|null} null = mostrar el panel
 */
export function estadoGate({ status, session, rolInfo, rolError } = {}) {
  if (status === "loading") {
    return { texto: "Cargando sesión...", accion: null };
  }

  if (!session) {
    return {
      texto: "Necesitás iniciar sesión para entrar al panel.",
      accion: ACCION_LOGIN,
    };
  }

  // No se echa a nadie por un problema de red: mandar a un admin al inicio
  // cuando la base no responde es peor que dejarlo reintentar.
  if (rolError) {
    return {
      texto: "No se pudo verificar tus permisos. Puede ser la conexión.",
      accion: ACCION_REINTENTAR,
    };
  }

  if (!rolInfo) {
    return { texto: "Verificando permisos...", accion: null };
  }

  if (!rolInfo.rol) {
    return {
      texto:
        rolInfo.motivo === "TURNO_VENCIDO"
          ? "Tu turno de voluntario terminó. Pedile a un admin que te lo otorgue de nuevo."
          : "Tu cuenta no tiene acceso al panel.",
      // Con el turno recién vencido lo más probable es que el admin se lo
      // vuelva a dar ahí mismo: reintentar es un click, ir al inicio lo manda
      // a /reservas a dar la vuelta.
      accion: rolInfo.motivo === "TURNO_VENCIDO" ? ACCION_REINTENTAR : ACCION_INICIO,
    };
  }

  return null;
}
