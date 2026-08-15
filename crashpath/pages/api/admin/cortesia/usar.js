// POST /api/admin/cortesia/usar
//
// El socio (anfitrión) gasta su cortesía para meter a un invitado. El invitado
// NO queda como un "+1" dentro de la visita del socio: se crea (o se reutiliza)
// como usuario propio walk-in, firma su waiver y le queda su propia visita con
// check-in. Es lo que exige el tema legal y lo que hace que aparezca en la
// asistencia del día como una persona más.
//
// Body:
//   {
//     hostId,
//     guestUserId?,                 // si el invitado ya existe en el panel
//     guest: { name, documentType, documentNumber, phone, epsName?,
//              emergencyContactName, emergencyContactPhone, email?, esMinor? },
//     waiver: { version, waiverTextSnapshot, signatureImageUrl?, signatureText? }
//   }
//
// El waiver solo es obligatorio si el invitado todavía no lo tiene firmado.
import mongoose from "mongoose";
import dbConnect from "../../../../lib/mongodb";
import User from "../../../../models/User";
import { requireAuth, PERMISOS, opcionesRecorte } from "../../../../lib/authz";
import { recortarCortesia } from "../../../../lib/redact";
import { logAudit } from "../../../../lib/audit";
import { dayRangeBogota } from "../../../../lib/dates";
import { estadoCortesia } from "../../../../lib/cortesia";
import { normalizeName } from "../../../../lib/importExcel";

const DOC_TYPES = ["CC", "CE", "TI", "PP", "NIT", "OTRO"];

function clean(v) {
  return String(v ?? "").trim();
}

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

function getReqMeta(req) {
  const xf = req.headers["x-forwarded-for"];
  const ip = Array.isArray(xf) ? xf[0] : String(xf || "").split(",")[0].trim();
  return { ip: ip || null, userAgent: req.headers["user-agent"] || null };
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ message: "Method not allowed" });
  }

  let actor;
  try {
    actor = await requireAuth(req, res, PERMISOS.CORTESIA_USAR);
  } catch {
    return;
  }

  const hostId = clean(req.body?.hostId);
  if (!hostId) return res.status(400).json({ message: "Falta hostId" });

  const g = req.body?.guest || {};
  const guestName = clean(g.name);
  const guestDocType = clean(g.documentType).toUpperCase() || "CC";
  const guestDocNumber = clean(g.documentNumber);
  const guestPhone = clean(g.phone);
  const guestEps = clean(g.epsName);
  const guestEcName = clean(g.emergencyContactName);
  const guestEcPhone = clean(g.emergencyContactPhone);
  const guestEmail = clean(g.email).toLowerCase();
  const guestEsMinor = g.esMinor === true || g.esMinor === "true";
  const guestUserId = clean(req.body?.guestUserId);

  if (!guestUserId) {
    if (!guestName) return res.status(400).json({ message: "El nombre del invitado es obligatorio" });
    if (!DOC_TYPES.includes(guestDocType)) {
      return res.status(400).json({ message: "Tipo de documento inválido" });
    }
    if (!guestDocNumber) return res.status(400).json({ message: "El documento del invitado es obligatorio" });
    if (!guestPhone) return res.status(400).json({ message: "El teléfono del invitado es obligatorio" });
    if (!guestEcName || !guestEcPhone) {
      return res.status(400).json({ message: "El contacto de emergencia del invitado es obligatorio" });
    }
  }

  await dbConnect();

  const now = new Date();
  const { start: startOfDay, end: endOfDay } = dayRangeBogota();
  const meta = getReqMeta(req);

  try {
    /* ── 1. El anfitrión y su cortesía ────────────────────────────────── */
    const host = await User.findById(hostId);
    if (!host) return res.status(404).json({ message: "Anfitrión no encontrado" });

    const st = estadoCortesia(host, now);
    if (!st.disponible) {
      return res.status(409).json({
        message: st.vencida
          ? "La cortesía venció con su tiquetera/mensualidad."
          : "Este usuario no tiene cortesía disponible.",
        code: st.vencida ? "CORTESIA_VENCIDA" : "CORTESIA_NO_DISPONIBLE",
      });
    }

    /* ── 2. El invitado: reutilizar si ya existe, si no crearlo ───────── */
    let guest = null;
    if (guestUserId) {
      guest = await User.findById(guestUserId);
      if (!guest) return res.status(404).json({ message: "Invitado no encontrado" });
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
      return res.status(400).json({
        message: "El invitado no puede ser el mismo socio.",
        code: "GUEST_IS_HOST",
      });
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
    const w = req.body?.waiver || {};
    const signatureUrl = clean(w.signatureImageUrl || w.signatureUrl || w.signatureDataUrl);
    const signatureText = clean(w.signatureText);
    const waiverTextSnapshot = clean(w.waiverTextSnapshot);
    const waiverVersion = clean(w.version) || "v1";

    if (guest.waiverStatus !== "signed") {
      if (!waiverTextSnapshot) {
        return res.status(400).json({
          message: "Falta el texto del waiver del invitado",
          code: "WAIVER_REQUIRED",
        });
      }
      if (!signatureUrl && !signatureText) {
        return res.status(400).json({
          message: "El invitado debe firmar el waiver antes de entrar",
          code: "SIGNATURE_REQUIRED",
        });
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
        signedBy: "admin",
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
      return res.status(409).json({
        message: "Ese invitado ya tiene una visita hoy.",
        code: "VISIT_ALREADY_EXISTS",
      });
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
      return res.status(409).json({
        message: "La cortesía ya fue usada.",
        code: "CORTESIA_NO_DISPONIBLE",
      });
    }

    /* ── 6. Guardar al invitado con su visita y su check-in ───────────── */
    // Va DESPUÉS de gastar la cortesía y con rollback: si el guardado falla
    // (ej. teléfono duplicado), la cortesía no se puede quedar gastada — y si
    // fallara al revés, quedaría un invitado creado que nunca entró.
    try {
      const visitDoc = {
        date: now,
        status: "checked_in",
        createdBy: "admin",
        checkedInAt: now,
        esCortesia: true,
        cortesiaHostId: host._id,
        cortesiaHostName: host.name,
        notes: `Cortesía de ${host.name}`,
        events: [
          {
            ts: now,
            action: "CHECKIN",
            actor: "admin",
            actorEmail: actor?.email || null,
            actorName: actor?.name || null,
            meta: { ...meta, esCortesia: true, hostId: String(host._id) },
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
        meta: {
          guestId: String(guest._id),
          guestName: guest.name,
          guestDocument: guest.documentNumber || "",
          guestIsNew,
          visitId: visit?._id ? String(visit._id) : null,
          cortesiasRestantes: consumed.cortesia?.disponibles ?? 0,
        },
      });

      // El documento del invitado vuelve solo para quien puede ver datos
      // sensibles. Ojo: no alcanza con que el voluntario lo acabe de teclear
      // —si el invitado ya existía, `fill` no pisa lo que había, así que lo
      // que sale de acá es el dato guardado, no el que escribió. Y `cortesia`
      // arrastra el historial de usos, con el documento de invitados viejos.
      const { verSensible } = opcionesRecorte(actor);

      return res.status(200).json({
        message: "Cortesía registrada: el invitado quedó con check-in.",
        guest: {
          _id: guest._id,
          name: guest.name,
          email: guest.email,
          ...(verSensible
            ? { documentType: guest.documentType, documentNumber: guest.documentNumber }
            : {}),
          isNew: guestIsNew,
        },
        visit,
        cortesia: recortarCortesia(consumed.cortesia, { verSensible }),
        auditEvent,
      });
    } catch (err) {
      // Si falla el check-in, la cortesía no se puede quedar gastada.
      await User.updateOne(
        { _id: host._id, "cortesia.usos._id": usoId },
        { $inc: { "cortesia.disponibles": 1 }, $pull: { "cortesia.usos": { _id: usoId } } }
      ).catch(() => {});
      throw err;
    }
  } catch (err) {
    console.error("cortesia usar error:", err);
    if (err?.code === 11000) {
      const field = Object.keys(err.keyPattern || {})[0];
      return res.status(409).json({
        message:
          field === "phone"
            ? "Ya existe un usuario con ese teléfono."
            : "Ya existe un usuario con ese email.",
        code: "DUPLICATE",
      });
    }
    return res.status(500).json({ message: "No se pudo registrar la cortesía" });
  }
}
