// Operaciones de mostrador que se pueden disparar desde más de un lugar: el
// panel (/api/admin/*) y el MCP (/api/mcp). Viven acá para que los dos
// caminos corran EXACTAMENTE la misma lógica y nunca se descuadren.
//
// Cada función devuelve { status, body } con la misma forma que respondía el
// endpoint original; el endpoint solo hace res.status(status).json(body). La
// autorización NO va acá: la resuelve quien llama y pasa el `actor` ya
// verificado.
//
// `origen` (opcional, ej. "mcp") queda en meta del AuditLog para poder leer
// después desde dónde se hizo cada cosa.

import mongoose from "mongoose";
import User from "../models/User";
import { opcionesRecorte } from "./authz";
import { recortarCortesia, recortarUsuario } from "./redact";
import { logAudit } from "./audit";
import { otorgarCortesia, estadoCortesia } from "./cortesia";
import { normalizeName } from "./importExcel";
import { precioDia, precioTiquetera, precioMensualidad, pesos } from "./precios";

const conOrigen = (meta, origen) => (origen ? { ...meta, origen } : meta);

/* -------------------- CHECK-IN -------------------- */

function dayRangeBogota(dateLike) {
  const base = dateLike ? new Date(dateLike) : new Date();
  if (Number.isNaN(base.getTime())) return null;

  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Bogota",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(base);

  const y = parts.find((p) => p.type === "year")?.value;
  const m = parts.find((p) => p.type === "month")?.value;
  const d = parts.find((p) => p.type === "day")?.value;
  if (!y || !m || !d) return null;

  const start = new Date(`${y}-${m}-${d}T05:00:00.000Z`);
  const end = new Date(`${y}-${m}-${d}T04:59:59.999Z`);
  end.setUTCDate(end.getUTCDate() + 1);

  return { start, end };
}

/** Entradas que no pasan por la modalidad del socio. */
export const PASES = ["dia", "voluntario"];

export function canAccessOrFail(user) {
  if (user.accessType === "ticketera") {
    if ((user.credits ?? 0) <= 0) return { ok: false, code: "NO_CREDITS", message: "Sin créditos disponibles." };
  }
  if (user.accessType === "mensualidad") {
    const end = user.mensualidad?.endDate ? new Date(user.mensualidad.endDate) : null;
    if (!end || new Date() > end) return { ok: false, code: "MENSUALIDAD_VENCIDA", message: "Mensualidad vencida o inactiva." };
  }
  return { ok: true };
}

/**
 * Check-in del día (descuenta 1 crédito si es tiquetera). Atómico: dos
 * check-ins simultáneos no descuentan dos veces.
 *
 * @param {Object} p
 * @param {Object} p.query      - { _id } o { email } del usuario
 * @param {Object} p.actor      - actor verificado ({ email, name, rol })
 * @param {Object} [p.meta]     - datos del request que quedan en el evento (ip, userAgent)
 * @param {*}      [p.date]     - día del check-in (default hoy en Bogotá)
 * @param {boolean}[p.createIfMissing=true]
 * @param {string} [p.notes]
 * @param {string} [p.origen]
 * @param {string} [p.pase]     - "dia" (paga el día) o "voluntario" (gratis).
 *                                Ninguno de los dos gasta crédito ni exige
 *                                mensualidad vigente: es la entrada de quien
 *                                no tiene (o no quiere usar) su modalidad.
 * @param {boolean}[p.zapatos]  - solo con pase "dia": alquiló pies de gato
 */
export async function hacerCheckin({
  query,
  actor,
  meta = {},
  date,
  createIfMissing = true,
  notes = "",
  origen,
  pase,
  zapatos = false,
}) {
  const range = dayRangeBogota(date);
  if (!range) return { status: 400, body: { message: "Invalid date" } };

  if (pase && !PASES.includes(pase)) {
    return { status: 400, body: { message: "Tipo de entrada inválido", code: "PASE_INVALIDO" } };
  }
  const esDia = pase === "dia";
  const conZapatos = esDia && (zapatos === true || zapatos === "true");
  const monto = esDia ? precioDia(conZapatos) : undefined;
  // Lo que distingue a la visita. Va plano en el subdocumento (ver models/User.js).
  const camposPase = esDia
    ? { esPaseDia: true, conZapatos, monto }
    : pase === "voluntario"
      ? { esVoluntario: true }
      : {};
  const etiquetaPase = esDia
    ? `Pase de día ${conZapatos ? "con" : "sin"} zapatos · ${pesos(monto)}`
    : pase === "voluntario"
      ? "Entrada de voluntario (gratis)"
      : null;
  const metaPase = pase ? { pase, ...(esDia ? { zapatos: conZapatos, monto } : {}) } : {};

  const now = new Date();

  // El rol queda en el evento de la visita: "quién abrió el muro hoy" tiene
  // que poder leerse sin cruzar contra la lista de admins de ese día.
  const actorRole = actor.rol;
  const actorEmail = actor.email;
  const actorName = actor.name;
  const eventMeta = conOrigen(meta, origen);

  const buildCheckinEvent = (extraNotes = "") => ({
    ts: now,
    action: "CHECKIN",
    actor: actorRole,
    actorEmail,
    actorName,
    meta: eventMeta,
    notes: String(extraNotes || notes || "").slice(0, 400),
  });

  const user = await User.findOne(query).lean();
  if (!user) return { status: 404, body: { message: "User not found" } };

  const visits = Array.isArray(user.visits) ? user.visits : [];
  const existingToday = visits.find((v) => {
    const vd = new Date(v.date);
    return vd >= range.start && vd <= range.end && v.status !== "cancelled";
  });

  if (existingToday?.status === "checked_in") {
    return {
      status: 200,
      body: {
        message: "Already checked in",
        code: "ALREADY_CHECKED_IN",
        visit: existingToday,
        credits: user.credits,
      },
    };
  }

  // Con pase no se mira la modalidad: no gasta crédito ni pide mes vigente.
  if (!pase) {
    const access = canAccessOrFail(user);
    if (!access.ok) return { status: 403, body: { message: access.message, code: access.code } };
  }

  const isTicketera = !pase && user.accessType === "ticketera";
  const isMensualidad = !pase && user.accessType === "mensualidad";

  // ── Caso A: existe visita hoy pero no está checked_in ──────────────────
  if (existingToday?._id) {
    const atomicQuery = {
      ...query,
      visits: {
        $elemMatch: {
          _id: existingToday._id,
          date: { $gte: range.start, $lte: range.end },
          status: { $in: ["registered", "no_show"] },
        },
      },
    };

    if (isTicketera) atomicQuery.credits = { $gt: 0 };
    if (isMensualidad) atomicQuery["mensualidad.endDate"] = { $gt: now };

    const update = {
      $set: {
        "visits.$[v].status": "checked_in",
        "visits.$[v].checkedInAt": now,
      },
      $push: {
        "visits.$[v].events": buildCheckinEvent(),
      },
    };

    if (notes) update.$set["visits.$[v].notes"] = String(notes).slice(0, 400);
    for (const [k, v] of Object.entries(camposPase)) update.$set[`visits.$[v].${k}`] = v;
    if (isTicketera) update.$inc = { credits: -1 };

    const updated = await User.findOneAndUpdate(atomicQuery, update, {
      new: true,
      arrayFilters: [{ "v._id": existingToday._id }],
    }).lean();

    if (!updated) {
      return { status: 200, body: { message: "Already processed", code: "ALREADY_CHECKED_IN" } };
    }

    const newVisit = (updated.visits || []).find((v) => String(v._id) === String(existingToday._id));
    const auditEvent = await logAudit({
      action: "CHECKIN",
      actor,
      user: updated,
      summary: etiquetaPase || `Check-in${isTicketera ? ` (-1 crédito, quedan ${updated.credits})` : ""}`,
      meta: conOrigen(
        { visitId: String(existingToday._id), accessType: user.accessType, credits: updated.credits, ...metaPase },
        origen
      ),
    });
    return {
      status: 200,
      body: {
        message: "Checked in",
        visit: newVisit,
        credits: updated.credits,
        ...metaPase,
        auditEvent,
      },
    };
  }

  // ── Caso B: no existe visita hoy => crear + check-in atómico ───────────
  if (!createIfMissing) {
    return { status: 404, body: { message: "No visit found for this day", code: "VISIT_NOT_FOUND" } };
  }

  // FIX: date usa `now` (hora real del check-in) en lugar de range.start
  // (range.start = T05:00:00Z = medianoche Bogotá, que mostraba "5:00 AM" en el admin)
  const visitDoc = {
    date: now,
    status: "checked_in",
    createdBy: actorRole,
    checkedInAt: now,
    notes: String(notes || "").slice(0, 400),
    ...camposPase,
    events: [
      {
        ts: now,
        action: "CHECKIN",
        actor: actorRole,
        actorEmail,
        actorName,
        meta: eventMeta,
        notes: "Visita creada por check-in de mostrador",
      },
    ],
  };

  const atomicCreateQuery = {
    ...query,
    visits: {
      $not: {
        $elemMatch: {
          date: { $gte: range.start, $lte: range.end },
          status: { $ne: "cancelled" },
        },
      },
    },
  };

  if (isTicketera) atomicCreateQuery.credits = { $gt: 0 };
  if (isMensualidad) atomicCreateQuery["mensualidad.endDate"] = { $gt: now };

  const createUpdate = { $push: { visits: visitDoc } };
  if (isTicketera) createUpdate.$inc = { credits: -1 };

  const updated = await User.findOneAndUpdate(atomicCreateQuery, createUpdate, { new: true }).lean();

  if (!updated) {
    return { status: 200, body: { message: "Already processed", code: "ALREADY_CHECKED_IN" } };
  }

  const lastVisit = (updated.visits || []).slice().sort((a, b) => new Date(b.date) - new Date(a.date))[0];

  const auditEvent = await logAudit({
    action: "CHECKIN",
    actor,
    user: updated,
    summary: etiquetaPase || `Check-in (visita creada)${isTicketera ? ` -1 crédito, quedan ${updated.credits}` : ""}`,
    meta: conOrigen(
      {
        visitId: lastVisit ? String(lastVisit._id) : null,
        accessType: user.accessType,
        credits: updated.credits,
        ...metaPase,
      },
      origen
    ),
  });

  return {
    status: 200,
    body: {
      message: "Checked in (visit created by admin)",
      visit: lastVisit,
      credits: updated.credits,
      ...metaPase,
      auditEvent,
    },
  };
}

/* -------------------- RENOVAR MENSUALIDAD -------------------- */

/** Fecha en que quedaría la mensualidad si se renueva hoy. Pura. */
export function calcularNuevoVencimiento(endDateActual, months, now = new Date()) {
  // Si tiene mensualidad activa y no ha vencido, extender desde endDate
  // Si ya venció o no tiene, empezar desde hoy
  const base = endDateActual && new Date(endDateActual) > now ? new Date(endDateActual) : now;
  const newEndDate = new Date(base);
  newEndDate.setMonth(newEndDate.getMonth() + months);
  return newEndDate;
}

/**
 * Renovar es una venta: queda anotado cuánto entró (`monto` en el AuditLog,
 * de ahí lo suma lib/ingresos.js). `zapatos` = mensualidad con pies de gato.
 */
export async function renovarMensualidad({ userId, months = 1, zapatos = false, actor, origen }) {
  if (!userId) {
    return { status: 400, body: { message: "userId es requerido." } };
  }

  if (!Number.isInteger(months) || months < 1 || months > 12) {
    return { status: 400, body: { message: "months debe ser entre 1 y 12." } };
  }

  const user = await User.findById(userId);

  if (!user) {
    return { status: 404, body: { message: "Usuario no encontrado." } };
  }

  if (user.accessType !== "mensualidad") {
    return { status: 400, body: { message: "Este usuario es de tiquetera, no de mensualidad." } };
  }

  const now = new Date();
  const newEndDate = calcularNuevoVencimiento(user.mensualidad?.endDate, months, now);

  user.mensualidad.active = true;
  user.mensualidad.startDate = user.mensualidad.startDate ?? now;
  user.mensualidad.endDate = newEndDate;

  user.mensualidad.renewals.push({
    renewedAt: now,
    renewedBy: actor.rol,
    adminEmail: actor.email ?? "desconocido",
    newEndDate,
  });

  // Renovar el mes renueva la cortesía: vuelve a 1 (no se acumula) y vence
  // con la mensualidad.
  otorgarCortesia(user, { vence: newEndDate, ts: now });

  await user.save();

  const conZapatos = zapatos === true || zapatos === "true";
  const monto = precioMensualidad(months, conZapatos);

  const auditEvent = await logAudit({
    action: "MENSUALIDAD_RENEW",
    actor,
    user,
    summary: `Mensualidad renovada +${months} mes(es)${conZapatos ? " con zapatos" : ""} · ${pesos(monto)} (vence ${newEndDate.toLocaleDateString("en-CA")}) · cortesía renovada`,
    meta: conOrigen(
      { months, zapatos: conZapatos, monto, newEndDate, cortesia: user.cortesia?.disponibles ?? 0 },
      origen
    ),
  });

  return {
    status: 200,
    body: {
      message: "Mensualidad renovada correctamente.",
      monto,
      mensualidad: {
        active: user.mensualidad.active,
        startDate: user.mensualidad.startDate,
        endDate: user.mensualidad.endDate,
        renewals: user.mensualidad.renewals,
      },
      cortesia: recortarCortesia(user.cortesia, opcionesRecorte(actor)),
      auditEvent,
    },
  };
}

/* -------------------- AJUSTAR CRÉDITOS -------------------- */

/**
 * Suma (delta > 0, recarga de tiquetera) o resta créditos. Nunca deja saldo
 * negativo.
 *
 * `venta` separa cobrar una tiquetera de corregir un saldo: solo la venta
 * suma ingreso (`monto` en el AuditLog). Un ajuste queda con monto 0, que no
 * es lo mismo que no tener el campo: los eventos viejos, sin `monto`, son los
 * que lib/ingresos.js estima.
 */
export async function ajustarCreditos({ userId, delta, venta = false, actor, origen }) {
  if (!userId) {
    return { status: 400, body: { message: "Falta userId" } };
  }
  if (!Number.isInteger(delta)) {
    return { status: 400, body: { message: "credits debe ser un entero" } };
  }
  const esVenta = venta === true || venta === "true";
  if (esVenta && delta <= 0) {
    return { status: 400, body: { message: "Una venta tiene que sumar créditos.", code: "VENTA_SIN_CREDITOS" } };
  }
  const monto = esVenta ? precioTiquetera(delta) : 0;

  const user = await User.findById(userId);

  if (!user) {
    return { status: 404, body: { message: "Usuario no encontrado" } };
  }

  const before = user.credits ?? 0;
  // No permitir saldo negativo
  user.credits = Math.max(0, before + delta);

  // Recarga (delta > 0) sobre tiquetera vencida o sin fechas: inicia una
  // vigencia nueva de 60 días. Si la tiquetera está activa, un ajuste NO
  // toca sus fechas (una corrección de +1 no debe regalar 60 días).
  if (delta > 0 && user.accessType === "ticketera") {
    const end = user.tiquetera?.endDate ? new Date(user.tiquetera.endDate) : null;
    if (!end || end < new Date()) {
      const startDate = new Date();
      user.tiquetera = {
        startDate,
        endDate: new Date(startDate.getTime() + 60 * 86400000),
        totalUses: user.credits,
      };
    }

    // Cargar créditos = tiquetera nueva => cortesía renovada (vuelve a 1, no
    // se acumula). Se otorga en CUALQUIER recarga, no solo cuando arranca una
    // vigencia nueva: quien recompra antes de vencerse también compró su
    // tiquetera. Un ajuste de +1 por corrección también la renueva; el admin
    // puede quitarla a mano desde el panel si no corresponde.
    otorgarCortesia(user, { vence: user.tiquetera?.endDate || null });
  }

  await user.save();

  const auditEvent = await logAudit({
    action: "ADJUST_CREDITS",
    actor,
    user,
    summary: `${esVenta ? `Tiquetera vendida · ${pesos(monto)} · ` : ""}Créditos: ${before} → ${user.credits} (${
      delta >= 0 ? "+" : ""
    }${delta})${delta > 0 && user.accessType === "ticketera" ? " · cortesía renovada" : ""}`,
    meta: conOrigen(
      { before, after: user.credits, delta, venta: esVenta, monto, cortesia: user.cortesia?.disponibles ?? 0 },
      origen
    ),
  });

  return {
    status: 200,
    body: {
      message: "Créditos ajustados con éxito",
      monto,
      credits: user.credits,
      tiquetera: user.tiquetera,
      cortesia: recortarCortesia(user.cortesia, opcionesRecorte(actor)),
      auditEvent,
    },
  };
}

/* -------------------- CORREGIR CRÉDITOS -------------------- */

const diaCorto = (d) => (d ? new Date(d).toLocaleDateString("en-CA", { timeZone: "America/Bogota" }) : null);

/**
 * Corrige el saldo de una tiquetera para revertir errores: "restar" N (sin
 * bajar de 0) o "fijar" en exactamente N; opcionalmente restaura el
 * vencimiento (`vigencia`, un Date). NO toca la cortesía ni crea cobros
 * (`venta: false`, `monto: 0`). Con `simular` calcula y devuelve los cambios
 * sin guardar ni auditar.
 */
export async function corregirCreditos({ userId, modo, creditos, motivo, vigencia, actor, origen, simular = false }) {
  if (!userId) return { status: 400, body: { message: "Falta userId" } };
  if (!["restar", "fijar"].includes(modo)) return { status: 400, body: { message: 'modo debe ser "restar" o "fijar"' } };
  if (!Number.isInteger(creditos) || creditos < 0) {
    return { status: 400, body: { message: "creditos debe ser un entero mayor o igual a 0" } };
  }
  const razon = String(motivo || "").trim();
  if (!razon) return { status: 400, body: { message: "Falta el motivo de la corrección" } };

  const user = await User.findById(userId);
  if (!user) return { status: 404, body: { message: "Usuario no encontrado" } };
  if (user.accessType !== "ticketera") {
    return {
      status: 400,
      body: { message: `${user.name} no es de tiquetera (modalidad: ${user.accessType || "ninguna"}).`, code: "NO_ES_TIQUETERA" },
    };
  }

  const antes = Math.max(0, Number(user.credits) || 0);
  const despues = modo === "fijar" ? creditos : Math.max(0, antes - creditos);
  const delta = despues - antes;
  const vigenciaAntes = user.tiquetera?.endDate || null;
  const cambiaVigencia = vigencia instanceof Date && !Number.isNaN(vigencia.getTime());
  const cambios = {
    creditos: { antes, despues, delta },
    vigencia: { antes: diaCorto(vigenciaAntes), despues: cambiaVigencia ? diaCorto(vigencia) : diaCorto(vigenciaAntes) },
  };

  if (simular) return { status: 200, body: { cambios, user: { name: user.name } } };

  user.credits = despues;
  if (cambiaVigencia) {
    if (!user.tiquetera) user.tiquetera = {};
    user.tiquetera.endDate = vigencia;
  }
  await user.save();

  const auditEvent = await logAudit({
    action: "ADJUST_CREDITS",
    actor,
    user,
    summary:
      `Créditos: ${antes} → ${despues} (${delta >= 0 ? "+" : ""}${delta})` +
      (cambiaVigencia ? ` · vigencia: ${cambios.vigencia.antes || "sin fecha"} → ${cambios.vigencia.despues}` : "") +
      ` · corrección: ${razon}`,
    meta: conOrigen(
      {
        before: antes,
        after: despues,
        delta,
        venta: false,
        monto: 0,
        correccion: true,
        modo,
        motivo: razon,
        vigenciaAntes,
        vigenciaDespues: cambiaVigencia ? vigencia : vigenciaAntes,
      },
      origen
    ),
  });

  return { status: 200, body: { cambios, user: { name: user.name }, credits: despues, tiquetera: user.tiquetera, auditEvent } };
}

/* -------------------- CANCELAR VISITA -------------------- */

/**
 * Marca una visita como cancelada. Por defecto NO devuelve el crédito; con
 * `refund` suma 1. Idempotente: cancelar dos veces no hace nada la segunda.
 */
export async function cancelarVisita({ userId, visitId, notes = "", refund = false, actor, origen }) {
  if (!userId || !visitId) {
    return { status: 400, body: { message: "Missing userId or visitId" } };
  }

  const user = await User.findById(userId);
  if (!user) return { status: 404, body: { message: "User not found" } };

  const visit = user.visits?.id(visitId);
  if (!visit) return { status: 404, body: { message: "Visit not found" } };

  // si ya está cancelada, idempotente
  if (String(visit.status).toLowerCase() === "cancelled") {
    return {
      status: 200,
      body: {
        message: "Visit already cancelled",
        code: "ALREADY_CANCELLED",
        user: recortarUsuario(user, opcionesRecorte(actor)),
      },
    };
  }

  visit.status = "cancelled";
  if (notes) visit.notes = notes;
  // Un pase de día o una entrada de voluntario no gastaron crédito: no hay
  // nada que devolver. (El pase cancelado sale solo de la caja, porque el
  // dashboard no cuenta visitas canceladas.)
  if (visit.esPaseDia || visit.esVoluntario) refund = false;
  if (refund) user.credits = (user.credits ?? 0) + 1;

  await user.save();

  const auditEvent = await logAudit({
    action: "VISIT_CANCEL",
    actor,
    user,
    summary: `Visita cancelada${refund ? " + crédito reembolsado" : ""}`,
    meta: conOrigen({ visitId, refund, credits: user.credits }, origen),
  });

  return {
    status: 200,
    body: {
      message: refund ? "Visit cancelled + refunded" : "Visit cancelled",
      credits: user.credits,
      user: recortarUsuario(user, opcionesRecorte(actor)),
      auditEvent,
    },
  };
}

/* -------------------- USAR CORTESÍA -------------------- */

const DOC_TYPES = ["CC", "CE", "TI", "PP", "NIT", "OTRO"];

const clean = (v) => String(v ?? "").trim();

/** Email placeholder: el invitado no necesita cuenta de Google para entrar.
 *  Mismo formato que los creados por el import de Excel; editable después
 *  desde el perfil si el invitado se vuelve socio. */
function makeGuestEmail(nombre) {
  const slug =
    normalizeName(nombre).replace(/[^a-z0-9]+/g, ".").replace(/^\.+|\.+$/g, "").slice(0, 24) ||
    "invitado";
  const rand = Math.random().toString(36).slice(2, 8);
  return `invitado_${slug}_${rand}@crashpath.local`;
}

/**
 * El socio (anfitrión) gasta su cortesía para meter a un invitado. El
 * invitado NO queda como un "+1" dentro de la visita del socio: se crea (o se
 * reutiliza) como usuario propio walk-in, firma su waiver y le queda su
 * propia visita con check-in.
 *
 * @param {Object} p
 * @param {string} p.hostId
 * @param {string} [p.guestUserId] - si el invitado ya existe en el panel
 * @param {Object} [p.guest]       - datos crudos del invitado nuevo
 * @param {Object} [p.waiver]      - solo obligatorio si el invitado no lo tiene firmado
 * @param {Object} p.actor
 * @param {Object} [p.meta]        - { ip, userAgent } del request
 * @param {string} [p.origen]
 */
export async function usarCortesia({ hostId, guestUserId, guest: g = {}, waiver: w = {}, actor, meta = {}, origen }) {
  hostId = clean(hostId);
  if (!hostId) return { status: 400, body: { message: "Falta hostId" } };

  const guestName = clean(g.name);
  const guestDocType = clean(g.documentType).toUpperCase() || "CC";
  const guestDocNumber = clean(g.documentNumber);
  const guestPhone = clean(g.phone);
  const guestEps = clean(g.epsName);
  const guestEcName = clean(g.emergencyContactName);
  const guestEcPhone = clean(g.emergencyContactPhone);
  const guestEmail = clean(g.email).toLowerCase();
  const guestEsMinor = g.esMinor === true || g.esMinor === "true";
  guestUserId = clean(guestUserId);

  if (!guestUserId) {
    if (!guestName) return { status: 400, body: { message: "El nombre del invitado es obligatorio" } };
    if (!DOC_TYPES.includes(guestDocType)) {
      return { status: 400, body: { message: "Tipo de documento inválido" } };
    }
    if (!guestDocNumber) return { status: 400, body: { message: "El documento del invitado es obligatorio" } };
    if (!guestPhone) return { status: 400, body: { message: "El teléfono del invitado es obligatorio" } };
    if (!guestEcName || !guestEcPhone) {
      return { status: 400, body: { message: "El contacto de emergencia del invitado es obligatorio" } };
    }
  }

  const now = new Date();
  const { start: startOfDay, end: endOfDay } = dayRangeBogota();

  /* ── 1. El anfitrión y su cortesía ────────────────────────────────── */
  const host = await User.findById(hostId);
  if (!host) return { status: 404, body: { message: "Anfitrión no encontrado" } };

  const st = estadoCortesia(host, now);
  if (!st.disponible) {
    return {
      status: 409,
      body: {
        message: st.vencida
          ? "La cortesía venció con su tiquetera/mensualidad."
          : "Este usuario no tiene cortesía disponible.",
        code: st.vencida ? "CORTESIA_VENCIDA" : "CORTESIA_NO_DISPONIBLE",
      },
    };
  }

  /* ── 2. El invitado: reutilizar si ya existe, si no crearlo ───────── */
  let guest = null;
  if (guestUserId) {
    guest = await User.findById(guestUserId);
    if (!guest) return { status: 404, body: { message: "Invitado no encontrado" } };
  } else {
    // Buscar por documento / email / teléfono antes de crear: `phone` y
    // `email` son únicos y un duplicado reventaría el save con E11000.
    const or = [];
    if (guestDocNumber) or.push({ documentType: guestDocType, documentNumber: guestDocNumber });
    if (guestEmail) or.push({ email: guestEmail });
    if (guestPhone) or.push({ phone: guestPhone });
    guest = or.length ? await User.findOne({ $or: or }) : null;
  }

  if (String(guest?._id || "") === String(host._id)) {
    return { status: 400, body: { message: "El invitado no puede ser el mismo socio.", code: "GUEST_IS_HOST" } };
  }

  let guestIsNew = false;
  if (!guest) {
    guest = new User({
      name: guestName,
      email: guestEmail || makeGuestEmail(guestName),
      userType: "walkin",
      // Sin accessType: el invitado no es de tiquetera ni de mensualidad, y
      // así no ensucia los KPIs ni el filtro "sin créditos".
      accessType: null,
      credits: 0,
      waiverStatus: "pending",
    });
    guestIsNew = true;
  }

  // Datos del invitado: solo se COMPLETA lo que falte. El match es por
  // documento/teléfono y puede caer sobre un socio ya registrado (alguien
  // que hoy viene de invitado en vez de gastar su crédito); lo que teclee el
  // admin en el mostrador no debe pisarle la ficha.
  const fill = (campo, valor) => {
    if (!valor) return;
    if (guestIsNew || !String(guest[campo] || "").trim()) guest[campo] = valor;
  };

  fill("name", guestName);
  if (guestDocNumber && (guestIsNew || !String(guest.documentNumber || "").trim())) {
    guest.documentType = guestDocType;
    guest.documentNumber = guestDocNumber;
  }
  fill("phone", guestPhone);
  fill("epsName", guestEps);
  fill("emergencyContactName", guestEcName);
  fill("emergencyContactPhone", guestEcPhone);
  if (guestEsMinor) guest.esMinor = true;

  /* ── 3. Waiver del invitado ───────────────────────────────────────── */
  const signatureUrl = clean(w.signatureImageUrl || w.signatureUrl || w.signatureDataUrl);
  const signatureText = clean(w.signatureText);
  const waiverTextSnapshot = clean(w.waiverTextSnapshot);
  const waiverVersion = clean(w.version) || "v1";

  if (guest.waiverStatus !== "signed") {
    if (!waiverTextSnapshot) {
      return { status: 400, body: { message: "Falta el texto del waiver del invitado", code: "WAIVER_REQUIRED" } };
    }
    if (!signatureUrl && !signatureText) {
      return {
        status: 400,
        body: { message: "El invitado debe firmar el waiver antes de entrar", code: "SIGNATURE_REQUIRED" },
      };
    }

    guest.waiverStatus = "signed";
    guest.waiverSignedAt = now;
    guest.waiverVersion = waiverVersion;
    guest.waiverMethod = "signature";
    guest.waiverTextSnapshot = waiverTextSnapshot;
    if (signatureUrl) guest.waiverSignatureUrl = signatureUrl;
    if (signatureText) guest.waiverSignatureText = signatureText;
    guest.waiverMeta = {
      ...(guest.waiverMeta || {}),
      ip: meta.ip || "",
      userAgent: meta.userAgent || "",
      signedBy: actor.rol,
      adminEmail: actor?.email || "",
    };
  }

  /* ── 4. ¿El invitado ya entró hoy? ────────────────────────────────── */
  // Se valida ANTES de gastar la cortesía: si ya entró, no se cobra nada.
  const yaEntroHoy = (guest.visits || []).some((v) => {
    const d = v?.date ? new Date(v.date) : null;
    if (!d || Number.isNaN(d.getTime())) return false;
    return d >= startOfDay && d <= endOfDay && v.status !== "cancelled";
  });
  if (yaEntroHoy) {
    return { status: 409, body: { message: "Ese invitado ya tiene una visita hoy.", code: "VISIT_ALREADY_EXISTS" } };
  }

  /* ── 5. Gastar la cortesía (atómico) ──────────────────────────────── */
  // El $gte:1 en el filtro es el candado: si dos admins la usan a la vez,
  // solo uno matchea y el otro recibe 409.
  const usoId = new mongoose.Types.ObjectId();
  const consumed = await User.findOneAndUpdate(
    { _id: host._id, "cortesia.disponibles": { $gte: 1 } },
    {
      $inc: { "cortesia.disponibles": -1 },
      $push: {
        "cortesia.usos": {
          _id: usoId,
          ts: now,
          guestUserId: guest._id,
          guestName: guest.name,
          guestDocument: guest.documentNumber || "",
          adminEmail: actor?.email || "",
        },
      },
    },
    { new: true }
  );

  if (!consumed) {
    return { status: 409, body: { message: "La cortesía ya fue usada.", code: "CORTESIA_NO_DISPONIBLE" } };
  }

  /* ── 6. Guardar al invitado con su visita y su check-in ───────────── */
  // Va DESPUÉS de gastar la cortesía y con rollback: si el guardado falla
  // (ej. teléfono duplicado), la cortesía no se puede quedar gastada — y si
  // fallara al revés, quedaría un invitado creado que nunca entró.
  try {
    const visitDoc = {
      date: now,
      status: "checked_in",
      createdBy: actor.rol,
      checkedInAt: now,
      esCortesia: true,
      cortesiaHostId: host._id,
      cortesiaHostName: host.name,
      notes: `Cortesía de ${host.name}`,
      events: [
        {
          ts: now,
          action: "CHECKIN",
          actor: actor.rol,
          actorEmail: actor?.email || null,
          actorName: actor?.name || null,
          meta: conOrigen({ ...meta, esCortesia: true, hostId: String(host._id) }, origen),
        },
      ],
    };

    guest.visits.push(visitDoc);
    await guest.save();

    const visit = guest.visits[guest.visits.length - 1];
    if (visit?._id) {
      await User.updateOne(
        { _id: host._id, "cortesia.usos._id": usoId },
        { $set: { "cortesia.usos.$.visitId": visit._id } }
      );
    }

    const auditEvent = await logAudit({
      action: "CORTESIA_USADA",
      actor,
      user: host,
      summary: `Cortesía usada: entró ${guest.name}${guestIsNew ? " (invitado nuevo)" : ""}`,
      meta: conOrigen(
        {
          guestId: String(guest._id),
          guestName: guest.name,
          guestDocument: guest.documentNumber || "",
          guestIsNew,
          visitId: visit?._id ? String(visit._id) : null,
          cortesiasRestantes: consumed.cortesia?.disponibles ?? 0,
        },
        origen
      ),
    });

    // El documento del invitado vuelve solo para quien puede ver datos
    // sensibles. Ojo: no alcanza con que el voluntario lo acabe de teclear
    // —si el invitado ya existía, `fill` no pisa lo que había, así que lo
    // que sale de acá es el dato guardado, no el que escribió. Y `cortesia`
    // arrastra el historial de usos, con el documento de invitados viejos.
    const { verSensible } = opcionesRecorte(actor);

    // El registro de auditoría SÍ guarda el documento del invitado (es el
    // rastro legal y solo lo leen los admins), pero el mismo evento vuelve
    // en esta respuesta para que el panel lo pinte al instante. Recortar
    // `guest` y `cortesia` no alcanzaba: el dato se colaba por acá.
    const auditVisible =
      verSensible || !auditEvent
        ? auditEvent
        : { ...auditEvent, meta: { ...(auditEvent.meta || {}), guestDocument: undefined } };

    return {
      status: 200,
      body: {
        message: "Cortesía registrada: el invitado quedó con check-in.",
        guest: {
          _id: guest._id,
          name: guest.name,
          email: guest.email,
          ...(verSensible ? { documentType: guest.documentType, documentNumber: guest.documentNumber } : {}),
          isNew: guestIsNew,
        },
        visit,
        cortesia: recortarCortesia(consumed.cortesia, { verSensible }),
        auditEvent: auditVisible,
      },
    };
  } catch (err) {
    // Si falla el check-in, la cortesía no se puede quedar gastada.
    await User.updateOne(
      { _id: host._id, "cortesia.usos._id": usoId },
      { $inc: { "cortesia.disponibles": 1 }, $pull: { "cortesia.usos": { _id: usoId } } }
    ).catch(() => {});
    throw err;
  }
}

/* -------------------- EDITAR PERFIL -------------------- */

/** Campos del perfil que se pueden editar (el formulario del panel y el MCP). */
export const CAMPOS_PERFIL = [
  "name",
  "email",
  "phone",
  "documentType",
  "documentNumber",
  "epsName",
  "emergencyContactName",
  "emergencyContactPhone",
];

/**
 * Actualiza los datos de contacto/identificación de un socio. Un campo vacío
 * o ausente NO borra lo que había: se deja como estaba.
 *
 * Con `simular` valida y calcula el antes → después sin guardar nada (la
 * vista previa del MCP), así la vista previa ya avisa de un email o teléfono
 * repetido en vez de fallar recién al confirmar.
 */
export async function actualizarPerfil({ userId, datos = {}, actor, origen, simular = false }) {
  if (!userId || !mongoose.isValidObjectId(userId)) {
    return { status: 400, body: { message: "Missing userId" } };
  }

  const nuevos = {};
  for (const k of CAMPOS_PERFIL) {
    let v = clean(datos[k]);
    if (k === "email") v = v.toLowerCase();
    if (k === "documentType") v = v.toUpperCase();
    if (v) nuevos[k] = v;
  }

  if (nuevos.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(nuevos.email)) {
    return { status: 400, body: { message: "Email inválido." } };
  }
  if (nuevos.documentType && !DOC_TYPES.includes(nuevos.documentType)) {
    return { status: 400, body: { message: "Tipo de documento inválido." } };
  }

  const user = await User.findById(userId);
  if (!user) return { status: 404, body: { message: "Usuario no encontrado." } };

  // Solo lo que de verdad cambia: así el audit no dice "cambió el email"
  // cuando se reenvió el mismo.
  const cambios = {};
  for (const [k, v] of Object.entries(nuevos)) {
    if ((user[k] ?? "") !== v) cambios[k] = { antes: user[k] ?? null, despues: v };
  }

  // Email: importante para usuarios importados/walk-in con placeholder
  // @crashpath.local — al ponerles su email real de Google, el login los
  // conecta con esta misma cuenta (login busca por email).
  if (cambios.email && (await User.exists({ email: cambios.email.despues, _id: { $ne: user._id } }))) {
    return { status: 409, body: { message: "Ese email ya está en uso por otra cuenta.", code: "EMAIL_IN_USE" } };
  }
  // El teléfono es único en el schema: sin esto el save revienta con E11000.
  if (cambios.phone && (await User.exists({ phone: cambios.phone.despues, _id: { $ne: user._id } }))) {
    return { status: 409, body: { message: "Ese teléfono ya está en uso por otra cuenta.", code: "PHONE_IN_USE" } };
  }

  if (simular) return { status: 200, body: { cambios, user } };

  if (!Object.keys(cambios).length) {
    return { status: 200, body: { message: "No había nada que cambiar.", code: "SIN_CAMBIOS", cambios, user } };
  }

  for (const [k, { despues }] of Object.entries(cambios)) user[k] = despues;
  await user.save();

  // Solo los nombres de los campos, no los valores: el feed lo lee todo el
  // panel y acá hay documento y teléfonos.
  const auditEvent = await logAudit({
    action: "UPDATE_PROFILE",
    actor,
    user,
    summary: `Perfil actualizado: ${user.name}`,
    meta: conOrigen({ fields: Object.keys(cambios) }, origen),
  });

  return { status: 200, body: { message: "Perfil actualizado correctamente.", cambios, user, auditEvent } };
}
