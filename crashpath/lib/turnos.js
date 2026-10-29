// Otorgar y revocar turnos de voluntario. Lo comparten el panel
// (/api/admin/staff) y el MCP, igual que lib/operaciones.js con las
// operaciones de socios: misma regla, mismo AuditLog.
//
// Devuelven { status, body } para que el endpoint los pase tal cual.
// `origen` (opcional, ej. "mcp") queda en meta del AuditLog.

import mongoose from "mongoose";
import StaffGrant from "../models/StaffGrant";
import { esAdminEmail, normalizarEmail } from "./roles";
import { finDelTurno } from "./staff";
import { logAudit } from "./audit";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const conOrigen = (meta, origen) => (origen ? { ...meta, origen } : meta);

/** Turnos vigentes de un email, o de todos si no se pasa. */
export async function turnosVigentes(email, ahora = new Date()) {
  const filtro = { revocadoEn: null, vence: { $gte: ahora } };
  if (email) filtro.email = normalizarEmail(email);
  return StaffGrant.find(filtro).sort({ vence: -1 }).lean();
}

/**
 * Valida el email antes de otorgar. null si está bien; si no, { status, body }.
 * Aparte para que la vista previa del MCP rechace lo mismo que el otorgar real.
 */
export function validarEmailVoluntario(email) {
  if (email.length > 254 || !EMAIL_RE.test(email)) {
    return { status: 400, body: { message: "Email inválido", code: "EMAIL_INVALIDO" } };
  }
  // Un admin ya entra por lib/roles.js; el grant no le sumaría nada y después
  // confundiría al leer la lista ("¿este es voluntario o admin?").
  if (esAdminEmail(email)) {
    return { status: 400, body: { message: "Ese email ya es administrador permanente.", code: "YA_ES_ADMIN" } };
  }
  return null;
}

/** Otorga el turno de hoy (vence al final del día en Bogotá). */
export async function otorgarTurno({ email: crudo, name = "", nota = "", actor, origen }) {
  const email = normalizarEmail(crudo);
  name = String(name || "").trim().slice(0, 120);
  nota = String(nota || "").trim().slice(0, 300);

  const invalido = validarEmailVoluntario(email);
  if (invalido) return invalido;

  // Si ya tiene turno hoy, no se duplica: se devuelve el que hay. Dos
  // admins dándole acceso al mismo voluntario es lo normal en un sábado.
  // Se pregunta por vigencia y no por "el último" por lo mismo que en
  // lib/authz.js: todos los turnos del día vencen en el mismo instante y
  // ordenar por fecha empata.
  const existente = await StaffGrant.findOne({ email, revocadoEn: null, vence: { $gte: new Date() } });
  if (existente) {
    return {
      status: 200,
      body: {
        message: "Ese voluntario ya tenía turno hoy.",
        code: "YA_TENIA_TURNO",
        turno: {
          _id: String(existente._id),
          email: existente.email,
          name: existente.name || null,
          vence: existente.vence,
          estado: "vigente",
        },
      },
    };
  }

  const vence = finDelTurno();
  if (!vence) {
    // finDelTurno solo devuelve null si el día calendario es inválido, que
    // no debería pasar nunca; igual no se otorga un turno sin vencimiento.
    return { status: 500, body: { message: "No se pudo calcular el vencimiento del turno" } };
  }

  const grant = await StaffGrant.create({
    email,
    name: name || undefined,
    vence,
    otorgadoEn: new Date(),
    otorgadoPor: { email: actor.email, name: actor.name },
    nota: nota || undefined,
  });

  const auditEvent = await logAudit({
    action: "STAFF_GRANT",
    actor,
    user: { email, name: name || undefined },
    summary: `Turno de voluntario otorgado a ${email} (vence ${vence.toLocaleString("es-CO", {
      timeZone: "America/Bogota",
    })})`,
    meta: conOrigen({ email, vence, nota: nota || undefined }, origen),
  });

  return {
    status: 201,
    body: {
      message: "Turno otorgado. Vence al final del día.",
      turno: {
        _id: String(grant._id),
        email: grant.email,
        name: grant.name || null,
        vence: grant.vence,
        estado: "vigente",
      },
      auditEvent,
    },
  };
}

/**
 * Corta el turno antes de que venza solo. Por `id` de un turno o por `email`.
 *
 * Tiene efecto INMEDIATO: el guardia resuelve el rol en cada request, así que
 * el voluntario pierde el acceso en su siguiente click, sin esperar a que se
 * le caiga la sesión.
 */
export async function revocarTurno({ id: crudoId, email: crudoEmail, actor, origen }) {
  const id = String(crudoId || "").trim();
  const email = normalizarEmail(crudoEmail);

  if (!id && !email) return { status: 400, body: { message: "Falta id o email" } };
  if (id && !mongoose.isValidObjectId(id)) return { status: 400, body: { message: "ID inválido" } };

  // Se resuelve a QUIÉN se le revoca; después se cortan TODOS sus turnos
  // vigentes, no solo el que se clickeó. Si dos admins le dieron turno a la
  // misma persona (un sábado ocupado es exactamente eso), revocar uno solo
  // dejaba el otro vivo: el panel decía "revocado" y la persona seguía
  // entrando.
  const referencia = id ? await StaffGrant.findById(id).lean() : null;
  if (id && !referencia) {
    return { status: 404, body: { message: "Ese turno no existe", code: "NO_ENCONTRADO" } };
  }

  const objetivo = referencia?.email || email;
  const ahora = new Date();

  const resultado = await StaffGrant.updateMany(
    { email: objetivo, revocadoEn: null, vence: { $gte: ahora } },
    { $set: { revocadoEn: ahora, revocadoPor: { email: actor.email, name: actor.name } } }
  );

  // Idempotente: revocar dos veces no reescribe la fecha ni ensucia la
  // auditoría con un evento que no pasó.
  if (resultado.modifiedCount === 0) {
    const existeAlguno = referencia || (await StaffGrant.exists({ email: objetivo }));
    if (!existeAlguno) {
      return { status: 404, body: { message: "Ese voluntario no tiene turnos", code: "NO_ENCONTRADO" } };
    }
    return {
      status: 200,
      body: { message: "Ese turno ya estaba revocado o vencido.", code: "SIN_EFECTO", email: objetivo },
    };
  }

  const auditEvent = await logAudit({
    action: "STAFF_REVOKE",
    actor,
    user: { email: objetivo, name: referencia?.name || undefined },
    summary: `Turno de voluntario revocado a ${objetivo}`,
    meta: conOrigen({ email: objetivo, turnosCortados: resultado.modifiedCount }, origen),
  });

  return {
    status: 200,
    body: {
      message: "Turno revocado. El acceso se corta de inmediato.",
      email: objetivo,
      turnosCortados: resultado.modifiedCount,
      auditEvent,
    },
  };
}
