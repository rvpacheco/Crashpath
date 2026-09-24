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

import User from "../models/User";
import { opcionesRecorte } from "./authz";
import { recortarCortesia } from "./redact";
import { logAudit } from "./audit";
import { otorgarCortesia } from "./cortesia";

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
 */
export async function hacerCheckin({ query, actor, meta = {}, date, createIfMissing = true, notes = "", origen }) {
  const range = dayRangeBogota(date);
  if (!range) return { status: 400, body: { message: "Invalid date" } };

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

  const access = canAccessOrFail(user);
  if (!access.ok) return { status: 403, body: { message: access.message, code: access.code } };

  const isTicketera = user.accessType === "ticketera";
  const isMensualidad = user.accessType === "mensualidad";

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
      summary: `Check-in${isTicketera ? ` (-1 crédito, quedan ${updated.credits})` : ""}`,
      meta: conOrigen(
        { visitId: String(existingToday._id), accessType: user.accessType, credits: updated.credits },
        origen
      ),
    });
    return {
      status: 200,
      body: {
        message: "Checked in",
        visit: newVisit,
        credits: updated.credits,
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
    summary: `Check-in (visita creada)${isTicketera ? ` -1 crédito, quedan ${updated.credits}` : ""}`,
    meta: conOrigen(
      { visitId: lastVisit ? String(lastVisit._id) : null, accessType: user.accessType, credits: updated.credits },
      origen
    ),
  });

  return {
    status: 200,
    body: {
      message: "Checked in (visit created by admin)",
      visit: lastVisit,
      credits: updated.credits,
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

export async function renovarMensualidad({ userId, months = 1, actor, origen }) {
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

  const auditEvent = await logAudit({
    action: "MENSUALIDAD_RENEW",
    actor,
    user,
    summary: `Mensualidad renovada +${months} mes(es) (vence ${newEndDate.toLocaleDateString("en-CA")}) · cortesía renovada`,
    meta: conOrigen({ months, newEndDate, cortesia: user.cortesia?.disponibles ?? 0 }, origen),
  });

  return {
    status: 200,
    body: {
      message: "Mensualidad renovada correctamente.",
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
 */
export async function ajustarCreditos({ userId, delta, actor, origen }) {
  if (!userId) {
    return { status: 400, body: { message: "Falta userId" } };
  }
  if (!Number.isInteger(delta)) {
    return { status: 400, body: { message: "credits debe ser un entero" } };
  }

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
    summary: `Créditos: ${before} → ${user.credits} (${delta >= 0 ? "+" : ""}${delta})${
      delta > 0 && user.accessType === "ticketera" ? " · cortesía renovada" : ""
    }`,
    meta: conOrigen({ before, after: user.credits, delta, cortesia: user.cortesia?.disponibles ?? 0 }, origen),
  });

  return {
    status: 200,
    body: {
      message: "Créditos ajustados con éxito",
      credits: user.credits,
      tiquetera: user.tiquetera,
      cortesia: recortarCortesia(user.cortesia, opcionesRecorte(actor)),
      auditEvent,
    },
  };
}
