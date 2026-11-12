// Recorte de datos sensibles EN EL SERVIDOR.
//
// Ojo con la diferencia contra lib/privacy.js: aquel enmascara para la
// pantalla (el modo privacidad que oculta datos de quien pasa por atrás) y el
// API igual manda todo, así que se ve abriendo el inspector. Eso alcanza
// contra un mirón, no contra un rol. Para el voluntario el dato no puede salir
// de Mongo: acá se recorta antes de responder.
//
// Una sola lista alimenta las dos formas de recortar: la proyección (que evita
// que el dato salga de la base) y el recorte de objetos ya cargados.

/**
 * Campos del User que un voluntario NO puede ver. Documento, contacto y datos
 * médicos son obvios; la firma del waiver entra porque es la firma manuscrita
 * de la persona, y waiverMeta porque guarda IP y user agent.
 *
 * Si agregás un campo al modelo, clasificalo en test/redact.test.js — hay un
 * test que recorre el schema y falla si queda alguno sin decidir.
 */
export const CAMPOS_SENSIBLES = [
  "documentType",
  "documentNumber",
  "phone",
  "responsableEmail",
  "responsablePhone",
  "emergencyContactName",
  "emergencyContactPhone",
  "epsName",
  "insuranceProvider",
  "insurancePolicyNumber",
  "allergies",
  "medicalConditions",
  "bloodType",
  "waiverSignatureUrl",
  "waiverSignatureText",
  "waiverTextSnapshot",
  "waiverMeta",
];

/**
 * Sensibles que viven adentro de otro campo que sí se muestra. El documento
 * del invitado va dentro de cortesia.usos, y la cortesía sí la necesita el
 * voluntario para entrar invitados: se recorta el subcampo, no el padre.
 */
export const CAMPOS_SENSIBLES_ANIDADOS = ["cortesia.usos.guestDocument"];

const TODOS_LOS_SENSIBLES = [...CAMPOS_SENSIBLES, ...CAMPOS_SENSIBLES_ANIDADOS];

/**
 * Proyección de exclusión para $project de un aggregate o para .select().
 * Se le pueden sumar exclusiones propias del endpoint (ej. campos pesados).
 *
 * Mongo no deja mezclar inclusiones y exclusiones en la misma proyección, así
 * que `extra` tiene que ser también de exclusión (todo en 0).
 */
export function proyeccionSinSensibles(extra = {}) {
  const proj = { ...extra };
  for (const campo of TODOS_LOS_SENSIBLES) proj[campo] = 0;
  return proj;
}

/**
 * Recorta un usuario ya cargado. Devuelve un objeto nuevo: no muta el
 * documento, que puede seguir usándose para guardar.
 *
 * Acepta documentos de Mongoose (los pasa por toObject) y objetos planos.
 */
export function recortarUsuario(user, { verSensible = false } = {}) {
  if (!user) return user;
  if (verSensible) return user;

  const plano = typeof user.toObject === "function" ? user.toObject() : { ...user };

  for (const campo of CAMPOS_SENSIBLES) delete plano[campo];

  const usos = plano.cortesia?.usos;
  if (Array.isArray(usos)) {
    plano.cortesia = {
      ...plano.cortesia,
      usos: usos.map(({ guestDocument, ...resto }) => resto),
    };
  }

  return plano;
}

/**
 * Recorta el subdocumento de cortesía suelto, para los endpoints que lo
 * devuelven aparte del usuario (cobrar créditos, renovar el mes, usar la
 * cortesía). Parece inofensivo pero `usos` es el historial de invitados y
 * cada uso guarda el documento de la persona que entró.
 */
export function recortarCortesia(cortesia, { verSensible = false } = {}) {
  if (!cortesia) return cortesia;
  if (verSensible) return cortesia;

  const plano = typeof cortesia.toObject === "function" ? cortesia.toObject() : { ...cortesia };
  const usos = Array.isArray(plano.usos) ? plano.usos : null;
  if (!usos) return plano;

  return {
    ...plano,
    usos: usos.map((uso) => {
      const u = typeof uso?.toObject === "function" ? uso.toObject() : { ...uso };
      delete u.guestDocument;
      return u;
    }),
  };
}

/** Igual que recortarUsuario pero para una lista. */
export function recortarUsuarios(users, opciones) {
  if (!Array.isArray(users)) return users;
  if (opciones?.verSensible) return users;
  return users.map((u) => recortarUsuario(u, opciones));
}
