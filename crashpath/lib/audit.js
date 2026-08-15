import mongoose from "mongoose";
import AuditLog from "../models/AuditLog";

/** Devuelve el valor solo si es un ObjectId válido; si no, undefined. */
function asObjectId(v) {
  return v && mongoose.isValidObjectId(v) ? v : undefined;
}

/**
 * Registra una acción en AuditLog y devuelve el documento creado (plano),
 * listo para que el endpoint lo regrese como `auditEvent` y el front lo
 * muestre de inmediato (UI optimista).
 *
 * IMPORTANTE: nunca lanza. Si el log falla, la operación principal NO debe
 * romperse: se loguea el error y se devuelve null.
 *
 * @param {Object}   params
 * @param {string}   params.action   - Código de acción, ej "ADJUST_CREDITS"
 * @param {Object}   [params.actor]  - Quién la ejecutó: { id?, email?, name? }
 * @param {Object}   [params.user]   - Usuario afectado: { _id|id?, email?, name? }
 * @param {string}   [params.summary]- Texto para la UI
 * @param {Object}   [params.meta]   - Datos extra (antes/después, etc.)
 * @returns {Promise<Object|null>}
 */
export async function logAudit({ action, actor, user, summary, meta } = {}) {
  try {
    if (!action) return null;

    // actorId/userId son ObjectId en el schema. Si lo que llega no es un
    // ObjectId válido (ej. el sub de Google), se omite del campo tipado y se
    // conserva el identificador crudo en meta para no perderlo.
    const rawUserId = user?._id || user?.id;
    const userObjectId = asObjectId(rawUserId);
    const extraMeta = { ...(meta || {}) };
    if (rawUserId && !userObjectId) extraMeta.userIdRaw = String(rawUserId);

    const doc = await AuditLog.create({
      ts: new Date(),
      action,
      actorId: asObjectId(actor?.id),
      actorEmail: actor?.email || undefined,
      actorName: actor?.name || undefined,
      userId: userObjectId,
      userEmail: user?.email || undefined,
      userName: user?.name || undefined,
      summary,
      meta: extraMeta,
    });

    return doc.toObject();
  } catch (e) {
    console.error("logAudit error:", e?.message || e);
    return null;
  }
}
