// pages/api/admin/users/set-access-type.js
import { requireAuth, PERMISOS, opcionesRecorte } from "../../../../lib/authz";
import { recortarUsuario } from "../../../../lib/redact";
import dbConnect from "../../../../lib/mongodb";
import User from "../../../../models/User";
import { logAudit } from "../../../../lib/audit";
import { otorgarCortesia } from "../../../../lib/cortesia";
import { precioMensualidad, precioTiquetera, pesos } from "../../../../lib/precios";

function addMonths(date, months) {
  const d = new Date(date);
  const m = d.getMonth();
  d.setMonth(m + months);
  return d;
}

function nowISO() {
  return new Date();
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ message: "Method not allowed" });

  // Elegir modalidad es parte de la venta (con quién arranca la tiquetera o
  // el mes), así que va con COBRAR.
  let actor;
  try {
    actor = await requireAuth(req, res, PERMISOS.COBRAR);
  } catch {
    return;
  }

  const userId = String(req.body?.userId || "").trim();
  const accessType = String(req.body?.accessType || "").trim().toLowerCase();
  const months = Number(req.body?.months || 0);
  const credits = req.body?.credits;

  if (!userId) return res.status(400).json({ message: "Missing userId" });
  if (!["ticketera", "mensualidad"].includes(accessType)) {
    return res.status(400).json({ message: "Invalid accessType" });
  }

  await dbConnect();

  try {
    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ message: "User not found" });

    const prevType = user.accessType || "ticketera";
    user.accessType = accessType;

    // Lo que se cobra con este cambio: los meses de la mensualidad o los
    // créditos con los que arranca la tiquetera.
    const conZapatos = req.body?.zapatos === true;
    let creditosVendidos = 0;
    let monto = 0;
    const creditosAntes = Math.max(0, Number(user.credits) || 0);

    // --- Switch to mensualidad ---
    if (accessType === "mensualidad") {
      if (!Number.isFinite(months) || months <= 0) {
        return res.status(400).json({ message: "Missing/invalid months for mensualidad" });
      }

      const now = nowISO();

      // si ya tenía mensualidad activa, extiende desde endDate; si no, desde ahora
      const currentEnd = user?.mensualidad?.endDate ? new Date(user.mensualidad.endDate) : null;
      const base = currentEnd && currentEnd > now ? currentEnd : now;

      const startDate = currentEnd && currentEnd > now
        ? (user.mensualidad?.startDate || now)
        : now;

      const endDate = addMonths(base, months);

      user.mensualidad = {
        ...(user.mensualidad || {}),
        active: true,
        startDate,
        endDate,
        renewals: [
          ...(user.mensualidad?.renewals || []),
          {
            renewedAt: now,
            renewedBy: actor.rol,
            adminEmail: actor.email || "admin",
            monthsAdded: months,
            previousAccessType: prevType,
          },
        ],
      };

      // Vender/activar mensualidad renueva la cortesía (vuelve a 1, vence con el mes)
      otorgarCortesia(user, { vence: endDate, ts: now });
      monto = precioMensualidad(months, conZapatos);

      // ojo: NO tocamos créditos aquí (los de ticketera los puedes dejar como saldo guardado)
    }

    // --- Switch to ticketera ---
    if (accessType === "ticketera") {
      // apaga mensualidad (si quieres conservar fechas como historial, no las borres)
      if (user.mensualidad) {
        user.mensualidad.active = false;
      }

      // si te mandan credits, los seteas; si no, los dejas como están
      if (credits !== undefined) {
        const n = Number(credits);
        if (!Number.isFinite(n)) {
          return res.status(400).json({ message: "Invalid credits" });
        }
        user.credits = Math.max(0, Math.trunc(n));

        // Venta de tiquetera: vigencia de 60 días desde hoy.
        // (El vencimiento se muestra en el panel pero no bloquea check-in.)
        if (user.credits > 0) {
          const startDate = new Date();
          const endDate = new Date(startDate.getTime() + 60 * 86400000);
          user.tiquetera = { startDate, endDate, totalUses: user.credits };

          // Tiquetera nueva => cortesía nueva (vence con la tiquetera)
          otorgarCortesia(user, { vence: endDate, ts: startDate });
          // Este endpoint FIJA el saldo, no lo suma. Solo es venta lo que
          // queda por encima de lo que ya tenía: reescribir los mismos 5
          // créditos al cambiar de modalidad no es plata nueva.
          creditosVendidos = Math.max(0, user.credits - creditosAntes);
          monto = precioTiquetera(creditosVendidos);
        }
      }

      // si el user no tiene credits field, asegúrate:
      if (user.credits == null) user.credits = 0;
    }

    await user.save();

    const auditEvent = await logAudit({
      action: "ACCESS_TYPE_CHANGED",
      actor,
      user,
      summary: `Acceso: ${prevType} → ${accessType}${monto ? ` · ${pesos(monto)}` : ""}`,
      // `monto` siempre presente (0 si solo cambió la modalidad sin cobrar):
      // lib/ingresos.js suma de acá y estima los eventos viejos que no lo traen.
      meta: {
        from: prevType,
        to: accessType,
        months: accessType === "mensualidad" ? months : undefined,
        zapatos: accessType === "mensualidad" ? conZapatos : undefined,
        creditos: creditosVendidos || undefined,
        monto,
      },
    });

    return res.status(200).json({
      message: "Access type updated",
      user: recortarUsuario(user, opcionesRecorte(actor)),
      auditEvent,
    });
  } catch (err) {
    console.error("set-access-type error:", err);
    return res.status(500).json({ message: "Failed to update access type" });
  }
}