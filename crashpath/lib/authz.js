// Guardia único de todos los endpoints de /api/admin.
//
// Reemplaza a los tres mecanismos que convivían antes: isAdminRequest,
// getServerSession().isAdmin y getToken().isAdmin. Los dos últimos leían el
// flag CACHEADO en el JWT al momento del login, así que sacar a alguien de la
// lista de admins no le quitaba el acceso hasta que expirara su token.
//
// Acá el rol se resuelve EN CADA REQUEST. Es lo que hace que el turno de
// voluntario se pueda revocar en el acto y otorgar sin pedir re-login.

import { getToken } from "next-auth/jwt";
import dbConnect from "./mongodb";
import StaffGrant from "../models/StaffGrant";
import StaffPermanente from "../models/StaffPermanente";
import { esAdminEmail, normalizarEmail } from "./roles";
import { ROL_ADMIN, ROL_STAFF, PERMISOS, puede, permisosDe } from "./permisos";

/**
 * Quién es quien manda el request. Devuelve siempre un objeto con `rol`:
 * null si no tiene ninguno. `motivo` sirve para que la UI diga "tu turno
 * terminó" en vez de un "no autorizado" seco.
 *
 * Un admin no toca la base: si Mongo está caído, la lista de lib/roles.js
 * sigue dejándonos entrar. Esa es toda la gracia de tenerla en código.
 */
export async function resolverActor(req) {
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
  const email = normalizarEmail(token?.user?.email || token?.email);
  const name = token?.user?.name || token?.name || null;
  const sub = token?.sub || null;

  if (!email) return { email: null, name: null, sub: null, rol: null, motivo: "SIN_SESION" };

  if (esAdminEmail(email)) {
    return { email, name, sub, rol: ROL_ADMIN, vence: null, motivo: null };
  }

  await dbConnect();

  // Se pregunta por un turno VIGENTE, no por "el último". Todos los turnos de
  // un mismo día vencen en el mismo milisegundo (fin del día en Bogotá), así
  // que ordenar por `vence` empata y Mongo desempata como quiere: revocarle el
  // turno a alguien y volver a otorgárselo el mismo día —el caso normal de una
  // confusión en el mostrador— dejaba dos documentos idénticos en fecha y el
  // guardia podía leer el revocado, negándole el acceso a un voluntario que sí
  // tenía turno. Filtrando por vigencia el empate deja de importar.
  const ahora = new Date();
  const vigente = await StaffGrant.findOne({
    email,
    revocadoEn: null, // en Mongo también matchea los documentos sin el campo
    vence: { $gte: ahora },
  }).lean();

  if (vigente) {
    return {
      email,
      name: name || vigente.name || null,
      sub,
      rol: ROL_STAFF,
      vence: vigente.vence,
      motivo: null,
    };
  }

  // Voluntario permanente: sin vencimiento, vale mientras no lo quiten de la
  // lista. Va DESPUÉS del turno diario para que el camino de siempre no pague
  // esta consulta de más.
  const permanente = await StaffPermanente.findOne({ email, quitadoEn: null }).lean();
  if (permanente) {
    return {
      email,
      name: name || permanente.name || null,
      sub,
      rol: ROL_STAFF,
      vence: null,
      permanente: true,
      motivo: null,
    };
  }

  // Sin turno vigente. Se busca el último solo para poder decir "tu turno
  // terminó" en vez de un "no autorizado" seco; acá el orden ya no decide
  // acceso, solo el mensaje.
  const ultimo = await StaffGrant.findOne({ email }).sort({ vence: -1, otorgadoEn: -1 }).lean();

  if (!ultimo) {
    return { email, name, sub, rol: null, motivo: "SIN_ROL" };
  }

  return { email, name, sub, rol: null, motivo: "TURNO_VENCIDO", vence: ultimo.vence };
}

/**
 * Exige un permiso. Mantiene el contrato del viejo isAdminRequest —responde y
 * LANZA— para que los `try { ... } catch { return }` que ya existen en los
 * endpoints sigan funcionando igual.
 *
 * Devuelve el actor listo para pasárselo a logAudit.
 */
export async function requireAuth(req, res, permiso) {
  let actor;
  try {
    actor = await resolverActor(req);
  } catch (e) {
    // Falla al consultar la base: se DENIEGA. Un guardia que abre cuando no
    // puede verificar no es un guardia.
    console.error("authz: no se pudo resolver el actor:", e?.message || e);
    res.status(503).json({ message: "No se pudo verificar la sesión", code: "AUTH_NO_DISPONIBLE" });
    throw new Error("Auth unavailable");
  }

  if (!actor.rol) {
    const vencido = actor.motivo === "TURNO_VENCIDO";
    res.status(401).json({
      message: vencido ? "Tu turno de voluntario terminó" : "No autorizado",
      code: vencido ? "TURNO_VENCIDO" : "NO_AUTORIZADO",
    });
    throw new Error("Not authorized");
  }

  if (permiso && !puede(actor.rol, permiso)) {
    res.status(403).json({
      message: "Tu rol no permite esta acción",
      code: "SIN_PERMISO",
      permiso,
    });
    throw new Error("Forbidden");
  }

  return actor;
}

/** ¿Este actor puede ver documento, teléfono, EPS y datos médicos? */
export function verSensible(actor) {
  return puede(actor?.rol, PERMISOS.VER_SENSIBLE);
}

/** Opciones listas para lib/redact.js a partir del actor. */
export function opcionesRecorte(actor) {
  return { verSensible: verSensible(actor) };
}

export { PERMISOS, puede, permisosDe, ROL_ADMIN, ROL_STAFF };
