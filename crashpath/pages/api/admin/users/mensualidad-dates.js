// POST /api/admin/users/mensualidad-dates
// Editor manual de fechas de la mensualidad (inicio / vencimiento).
// Body: { userId, startDate?: "YYYY-MM-DD", endDate?: "YYYY-MM-DD" }
//
// Es la contraparte de tiquetera-dates, con dos diferencias que importan:
//
//  1. El vencimiento se guarda al FIN del día de Bogotá (23:59:59.999), no a
//     medianoche. La mensualidad bloquea el check-in en el servidor
//     (visits/register.js -> MENSUALIDAD_INACTIVE), así que guardarla a
//     medianoche dejaría al socio afuera durante todo su último día pago.
//
//  2. Se mutan los campos uno por uno en vez de reemplazar el subdocumento.
//     `mensualidad` contiene `renewals` (el historial de ventas) y asignarle
//     un objeto plano borra todo lo que ese objeto no traiga. Ojo con el
//     atajo `{ ...user.mensualidad }`: en Mongoose 8 un subdocumento solo
//     expone $__parent/$__/_doc como props propias, así que el spread NO
//     copia los datos y no sirve de red de seguridad.
//
// Esto es CORRECCIÓN manual. Las ventas y renovaciones van por
// /api/admin/mensualidad/renovar, que es lo único que escribe en `renewals`.
import dbConnect from "../../../../lib/mongodb";
import User from "../../../../models/User";
import { isAdminRequest } from "../../auth/[...nextauth]";
import { logAudit } from "../../../../lib/audit";
import { parseDayEdge } from "../../../../lib/dates";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ message: "Method not allowed" });
  }

  let actor;
  try {
    actor = await isAdminRequest(req, res);
  } catch {
    return;
  }

  const userId = String(req.body?.userId || "").trim();
  if (!userId) return res.status(400).json({ message: "Falta userId" });

  const startDate = parseDayEdge(req.body?.startDate, "start");
  const endDate = parseDayEdge(req.body?.endDate, "end");
  if (startDate === undefined || endDate === undefined) {
    return res.status(400).json({ message: "Fecha inválida (usa YYYY-MM-DD)" });
  }
  if (!startDate && !endDate) {
    return res.status(400).json({ message: "Debes enviar al menos una fecha" });
  }

  await dbConnect();

  try {
    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ message: "Usuario no encontrado" });

    if (user.accessType !== "mensualidad") {
      return res.status(400).json({
        message: "Este usuario no es de mensualidad",
        code: "NOT_MENSUALIDAD",
      });
    }

    if (!user.mensualidad) user.mensualidad = {};

    const before = {
      active: !!user.mensualidad.active,
      startDate: user.mensualidad.startDate || null,
      endDate: user.mensualidad.endDate || null,
    };

    // Se valida contra el valor EFECTIVO (el nuevo si vino, el guardado si no)
    // para no dejar el registro incoherente al editar una sola de las fechas.
    const nextStart = startDate || before.startDate;
    const nextEnd = endDate || before.endDate;
    if (nextStart && nextEnd && new Date(nextEnd) < new Date(nextStart)) {
      return res
        .status(400)
        .json({ message: "El vencimiento no puede ser antes del inicio" });
    }

    // Mutación campo a campo: NO reasignar user.mensualidad (borraría renewals).
    if (startDate) user.mensualidad.startDate = startDate;
    if (endDate) user.mensualidad.endDate = endDate;

    // El hook pre("save") del modelo solo apaga la mensualidad cuando la fecha
    // ya pasó, nunca la vuelve a prender. Al corregir una fecha a futuro hay
    // que reactivarla acá o el flag queda desfasado del vencimiento real.
    user.mensualidad.active = !!nextEnd && new Date(nextEnd) > new Date();

    await user.save();

    const fmt = (d) =>
      d ? new Date(d).toLocaleDateString("en-CA", { timeZone: "America/Bogota" }) : "—";

    const auditEvent = await logAudit({
      action: "MENSUALIDAD_DATES",
      actor,
      user,
      summary: `Fechas de mensualidad: ${fmt(before.endDate)} → vence ${fmt(
        user.mensualidad.endDate
      )}`,
      meta: {
        before,
        after: {
          active: user.mensualidad.active,
          startDate: user.mensualidad.startDate,
          endDate: user.mensualidad.endDate,
        },
      },
    });

    return res.status(200).json({
      message: "Fechas actualizadas",
      mensualidad: {
        active: user.mensualidad.active,
        startDate: user.mensualidad.startDate,
        endDate: user.mensualidad.endDate,
      },
      auditEvent,
    });
  } catch (err) {
    console.error("mensualidad-dates error:", err);
    return res.status(500).json({ message: "Error actualizando fechas" });
  }
}
