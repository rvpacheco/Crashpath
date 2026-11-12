import { requireAuth, PERMISOS, opcionesRecorte } from "../../../../lib/authz";
import { recortarUsuario } from "../../../../lib/redact";
import dbConnect from "../../../../lib/mongodb";
import User from "../../../../models/User";
import { logAudit } from "../../../../lib/audit";
import { precioMensualidad, pesos } from "../../../../lib/precios";

function makeWalkInEmail() {
  const rand = Math.random().toString(36).slice(2, 10);
  return `walkin_${Date.now()}_${rand}@crashpath.local`;
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ message: "Method not allowed" });

  // El voluntario atiende walk-ins, así que crea usuarios. Ojo con la
  // asimetría: acá ESCRIBE documento y contacto de emergencia de alguien que
  // tiene enfrente, pero no puede leer los de nadie más (ver lib/redact.js).
  let actor;
  try {
    actor = await requireAuth(req, res, PERMISOS.CREAR_USUARIO);
  } catch {
    return;
  }

  const body = req.body || {};

  const name = String(body.name || "").trim();
  let email = String(body.email || "").trim().toLowerCase();

  const phone = String(body.phone || "").trim();
  const documentType = String(body.documentType || "").trim();
  const documentNumber = String(body.documentNumber || "").trim();

  const epsName = String(body.epsName || "").trim();
  const insuranceProvider = String(body.insuranceProvider || "").trim();
  const insurancePolicyNumber = String(body.insurancePolicyNumber || "").trim();

  const emergencyContactName = String(body.emergencyContactName || "").trim();
  const emergencyContactPhone = String(body.emergencyContactPhone || "").trim();

  // "dia": alguien que viene a pagar el día. No es socio de nada: sin
  // modalidad (así no ensucia el filtro "sin créditos") y marcado como
  // `daypass`. Su check-in con el cobro lo registra el panel después del
  // waiver, por /api/admin/visits/checkin con pase "dia".
  const esPaseDia = body.accessType === "dia";
  const resolvedAccessType = esPaseDia
    ? null
    : body.accessType === "mensualidad" ? "mensualidad" : "ticketera";

  const esMinor = body.esMinor === true || body.esMinor === "true";

  const mensualidadMeses =
    resolvedAccessType === "mensualidad"
      ? Math.min(Math.max(parseInt(body.mensualidadMeses, 10) || 1, 1), 12)
      : null;

  const conZapatos = body.zapatos === true;
  const monto = mensualidadMeses ? precioMensualidad(mensualidadMeses, conZapatos) : 0;

  if (!name) return res.status(400).json({ message: "Missing name" });

  await dbConnect();

  try {
    // Menor: el correo y el celular que se teclean son los del responsable, y
    // un responsable puede tener varios hijos. Se guardan como contacto del
    // responsable (sin unicidad) y la cuenta del menor usa un correo interno
    // cuando el del responsable ya está tomado.
    let responsableEmail;
    let responsablePhone;
    let phoneCuenta = phone;
    if (esMinor) {
      responsableEmail = email || undefined;
      responsablePhone = phone || undefined;
      if (email && (await User.exists({ email }))) email = "";
      if (phone && (await User.exists({ phone }))) phoneCuenta = "";
    }

    if (!email) email = makeWalkInEmail();

    const existing = await User.findOne({ email });
    if (existing) {
      return res.status(409).json({
        message: "Email already exists",
        code: "EMAIL_EXISTS",
      });
    }

    const now = new Date();

    let mensualidadData = undefined;
    // Cortesía: la mensualidad arranca vigente, así que el socio ya tiene su
    // pase de invitado. La tiquetera se crea en 0 créditos (se cargan aparte
    // con /api/admin/adjust-credits) y es ahí donde se otorga la cortesía.
    let cortesiaData = undefined;
    if (resolvedAccessType === "mensualidad") {
      const endDate = new Date(now);
      endDate.setMonth(endDate.getMonth() + mensualidadMeses);

      cortesiaData = { disponibles: 1, otorgadaEn: now, vence: endDate, usos: [] };

      mensualidadData = {
        active: true,
        startDate: now,
        endDate,
        renewals: [
          {
            renewedAt: now,
            renewedBy: actor.rol,
            adminEmail: actor.email ?? "desconocido",
            newEndDate: endDate,
          },
        ],
      };
    }

    const user = await User.create({
      name,
      email,
      phone: phoneCuenta,
      responsableEmail,
      responsablePhone,
      documentType,
      documentNumber,
      epsName,
      insuranceProvider,
      insurancePolicyNumber,
      emergencyContactName,
      emergencyContactPhone,
      esMinor,
      accessType: resolvedAccessType,
      userType: esPaseDia ? "daypass" : undefined,
      credits: resolvedAccessType === "ticketera" ? 0 : undefined,
      mensualidad: mensualidadData,
      cortesia: cortesiaData,
      waiverStatus: "pending",
    });

    const auditEvent = await logAudit({
      action: "USER_CREATE",
      actor,
      user,
      summary: `Usuario creado: ${user.name} (${resolvedAccessType || "pase de día"})${monto ? ` · ${pesos(monto)}` : ""}`,
      // `monto` siempre presente: crear con mensualidad es una venta; crear
      // con tiquetera nace en 0 créditos y la venta se anota al cargarlos.
      meta: {
        accessType: resolvedAccessType,
        esMinor,
        months: mensualidadMeses || undefined,
        zapatos: resolvedAccessType === "mensualidad" ? conZapatos : undefined,
        monto,
      },
    });

    return res.status(200).json({
      message: "User created",
      user: recortarUsuario(user, opcionesRecorte(actor)),
      auditEvent,
    });
  } catch (error) {
    console.error("admin users create error:", error);

    if (error.code === 11000) {
      const field = Object.keys(error.keyPattern || {})[0];
      const msg =
        field === "phone"
          ? "Phone already exists"
          : "Email already exists";
      return res.status(409).json({ message: msg, code: "DUPLICATE" });
    }

    return res.status(500).json({ message: "Failed to create user" });
  }
}
