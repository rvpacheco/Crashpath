// Lista de admins. Vive en código a propósito: es la red de seguridad para no
// quedarnos afuera del panel si la base de datos falla o si alguien revoca de
// más. Somos 9 y cambia una vez al año; el costo de un deploy para editarla es
// menor que el de depender de Mongo para poder entrar.
//
// El rol de voluntario (staff) va ENCIMA de esto, en la base: se otorga y se
// vence solo. Ver models/StaffGrant.js y lib/authz.js.
//
// Módulo aparte de [...nextauth].js para que lo pueda importar el guardia sin
// arrastrar next-auth ni el handler de NextAuth a cada endpoint.

export const ADMIN_EMAILS = [
  "santistebanfabi@gmail.com",
  "jeevanobando97@gmail.com",
  "rvpacheco17@gmail.com",
  "jdba.94@gmail.com",
  "miguelvarbla@gmail.com",
  "dmp702@gmail.com",
].map((e) => e.trim().toLowerCase());

/** Normaliza un email para comparar (los emails se guardan en minúscula). */
export function normalizarEmail(v) {
  return String(v ?? "").trim().toLowerCase();
}

/** ¿Este email es admin permanente? */
export function esAdminEmail(email) {
  const e = normalizarEmail(email);
  return !!e && ADMIN_EMAILS.includes(e);
}
