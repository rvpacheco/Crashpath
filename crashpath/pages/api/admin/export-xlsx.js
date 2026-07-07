// GET /api/admin/export-xlsx
// Genera un .xlsx con las hojas MENSUALIDADES y TIQUETERAS en el mismo
// formato del Excel "Seguimiento dinero.xlsx" que maneja el equipo.
// El flujo de caja NO sale de aquí: el panel no maneja dinero (a propósito).
import ExcelJS from "exceljs";
import dbConnect from "../../../lib/mongodb";
import User from "../../../models/User";
import { isAdminRequest } from "../auth/[...nextauth]";

const DATE_FMT = "dd/mm/yyyy";

/**
 * Convierte una fecha al "día calendario de Bogotá" como Date UTC-medianoche,
 * que es lo que exceljs escribe tal cual. Sin esto, una renovación hecha a las
 * 9pm de Bogotá (02:00Z del día siguiente) saldría en el Excel con un día más.
 */
function bogotaDay(dateLike) {
  if (!dateLike) return null;
  const d = new Date(dateLike);
  if (isNaN(d.getTime())) return null;
  const ymd = d.toLocaleDateString("en-CA", { timeZone: "America/Bogota" });
  return new Date(`${ymd}T00:00:00.000Z`);
}

function estadoMensualidad(m) {
  if (!m?.endDate) return "Vencido";
  return new Date(m.endDate) > new Date() ? "Disponible" : "Vencido";
}

function estadoTiquetera(u) {
  // Con fecha de vencimiento manda la fecha; sin fecha, los créditos.
  if (u.tiquetera?.endDate) {
    return new Date(u.tiquetera.endDate) > new Date() ? "Activa" : "Vencida";
  }
  return (u.credits ?? 0) > 0 ? "Activa" : "Vencida";
}

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ message: "Method not allowed" });
  }

  try {
    await isAdminRequest(req, res);
  } catch {
    return;
  }

  try {
    await dbConnect();
    const users = await User.find({ accessType: { $ne: null } })
      .select("name accessType credits tiquetera mensualidad")
      .lean();

    const wb = new ExcelJS.Workbook();

    // ── Hoja MENSUALIDADES ──────────────────────────────────────────
    const wsM = wb.addWorksheet("MENSUALIDADES");
    wsM.columns = [
      { header: "Nombre", key: "nombre", width: 26 },
      { header: "Fecha de Mensualidad", key: "inicio", width: 20, style: { numFmt: DATE_FMT } },
      { header: "Fecha maxima de uso", key: "fin", width: 20, style: { numFmt: DATE_FMT } },
      { header: "Uso", key: "uso", width: 14 },
    ];
    users
      .filter((u) => u.accessType === "mensualidad")
      .sort((a, b) => new Date(a.mensualidad?.startDate || 0) - new Date(b.mensualidad?.startDate || 0))
      .forEach((u) => {
        wsM.addRow({
          nombre: u.name || "",
          inicio: bogotaDay(u.mensualidad?.startDate),
          fin: bogotaDay(u.mensualidad?.endDate),
          uso: estadoMensualidad(u.mensualidad),
        });
      });

    // ── Hoja TIQUETERAS ─────────────────────────────────────────────
    const wsT = wb.addWorksheet("TIQUETERAS");
    wsT.columns = [
      { header: "Nombre", key: "nombre", width: 26 },
      { header: "Fecha de tiquetera", key: "inicio", width: 18, style: { numFmt: DATE_FMT } },
      { header: "Fecha maxima de uso", key: "fin", width: 20, style: { numFmt: DATE_FMT } },
      { header: "Usos", key: "usos", width: 8 },
      { header: "Usos pendientes", key: "pendientes", width: 16 },
      { header: "Pago", key: "pago", width: 12 },
      { header: "Activa o Vencida", key: "estado", width: 16 },
    ];
    users
      .filter((u) => u.accessType === "ticketera")
      .sort((a, b) => new Date(a.tiquetera?.startDate || 0) - new Date(b.tiquetera?.startDate || 0))
      .forEach((u) => {
        const total = u.tiquetera?.totalUses ?? 8;
        const pendientes = Math.max(0, u.credits ?? 0);
        wsT.addRow({
          nombre: u.name || "",
          inicio: bogotaDay(u.tiquetera?.startDate),
          fin: bogotaDay(u.tiquetera?.endDate),
          usos: Math.max(0, total - pendientes),
          pendientes,
          // En el panel la tiquetera solo existe si ya se pagó.
          pago: "Realizado",
          estado: estadoTiquetera(u),
        });
      });

    // Encabezados en negrita
    [wsM, wsT].forEach((ws) => {
      ws.getRow(1).font = { bold: true };
    });

    const buffer = await wb.xlsx.writeBuffer();
    const fecha = new Date().toISOString().slice(0, 10);

    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="crashpath-operativo-${fecha}.xlsx"`
    );
    res.setHeader("Cache-Control", "no-store");
    return res.status(200).send(Buffer.from(buffer));
  } catch (err) {
    console.error("export-xlsx error:", err);
    return res.status(500).json({ message: "Error generando el Excel" });
  }
}
