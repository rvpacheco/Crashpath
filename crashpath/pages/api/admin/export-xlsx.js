// GET /api/admin/export-xlsx
// Genera un .xlsx con las hojas MENSUALIDADES y TIQUETERAS en el mismo
// formato del Excel "Seguimiento dinero.xlsx" que maneja el equipo.
// El flujo de caja NO sale de aquí: el panel no maneja dinero (a propósito).
import ExcelJS from "exceljs";
import dbConnect from "../../../lib/mongodb";
import User from "../../../models/User";
import { isAdminRequest } from "../auth/[...nextauth]";

const DATE_FMT = "dd/mm/yyyy";

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
          inicio: u.mensualidad?.startDate ? new Date(u.mensualidad.startDate) : null,
          fin: u.mensualidad?.endDate ? new Date(u.mensualidad.endDate) : null,
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
          inicio: u.tiquetera?.startDate ? new Date(u.tiquetera.startDate) : null,
          fin: u.tiquetera?.endDate ? new Date(u.tiquetera.endDate) : null,
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
