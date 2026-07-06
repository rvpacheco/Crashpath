// POST /api/admin/import-xlsx
// Importa el Excel operativo ("Seguimiento dinero.xlsx") en dos fases:
//
//   mode: "preview" + file (base64) -> parsea las hojas MENSUALIDADES y
//     TIQUETERAS, matchea por nombre contra los usuarios del panel y devuelve
//     una vista previa. NO escribe nada.
//
//   mode: "apply" + rows (las filas que el admin confirmó en el preview) ->
//     aplica los cambios y registra IMPORT_XLSX en AuditLog.
//
// Reglas antibobos:
//  - Solo match EXACTO por nombre normalizado se marca "exact".
//  - Match parcial (un nombre contiene al otro) se marca "fuzzy" y viene
//    desmarcado por defecto en la UI.
//  - Varias filas de la misma persona: gana la más reciente por fecha.
//  - Persona en AMBAS hojas: gana la hoja con fecha más reciente; la otra
//    fila se reporta como omitida.
//  - No se crean usuarios: los no encontrados solo se reportan.
import ExcelJS from "exceljs";
import dbConnect from "../../../lib/mongodb";
import User from "../../../models/User";
import { isAdminRequest } from "../auth/[...nextauth]";
import { logAudit } from "../../../lib/audit";

export const config = {
  api: { bodyParser: { sizeLimit: "4mb" } },
};

/* ---------------- helpers de parseo ---------------- */

function normalizeName(s) {
  return String(s || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // sin tildes
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

/** exceljs puede devolver Date, número serial de Excel, string o richText. */
function cellText(v) {
  if (v == null) return "";
  if (typeof v === "object") {
    if (v.richText) return v.richText.map((r) => r.text).join("");
    if (v.result != null) return String(v.result);
    if (v instanceof Date) return v.toISOString();
    return String(v.text ?? "");
  }
  return String(v);
}

function toDate(v) {
  if (v == null || v === "") return null;
  if (v instanceof Date) return isNaN(v.getTime()) ? null : v;
  // Celdas con fórmula (ej. "=B2+30"): exceljs devuelve { formula, result }
  if (typeof v === "object" && v.result != null) return toDate(v.result);
  if (typeof v === "number") {
    // Serial de Excel (época 1899-12-30)
    if (v < 20000 || v > 60000) return null; // fuera de rango razonable
    return new Date(Date.UTC(1899, 11, 30) + v * 86400000);
  }
  const s = String(v).trim();
  // dd/mm/yyyy
  const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (m) return new Date(Date.UTC(+m[3], +m[2] - 1, +m[1]));
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
}

function toInt(v) {
  const n = Number(cellText(v));
  return Number.isFinite(n) ? Math.trunc(n) : null;
}

function findSheet(wb, wanted) {
  return wb.worksheets.find(
    (ws) => normalizeName(ws.name).toUpperCase() === wanted.toUpperCase()
  );
}

/** Lee filas de una hoja y devuelve arrays de objetos por índice de columna. */
function readRows(ws, mapRow) {
  const rows = [];
  ws.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return; // encabezado
    const r = mapRow(row);
    if (r && normalizeName(r.nombre)) rows.push({ ...r, excelRow: rowNumber });
  });
  return rows;
}

/* ---------------- fase PREVIEW ---------------- */

async function buildPreview(fileBase64) {
  const buffer = Buffer.from(fileBase64, "base64");
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buffer);

  const wsM = findSheet(wb, "MENSUALIDADES");
  const wsT = findSheet(wb, "TIQUETERAS");
  if (!wsM && !wsT) {
    throw Object.assign(
      new Error("El archivo no tiene hojas MENSUALIDADES ni TIQUETERAS"),
      { status: 400 }
    );
  }

  // ── Parsear hojas ──
  const mensRows = wsM
    ? readRows(wsM, (row) => ({
        nombre: cellText(row.getCell(1).value).trim(),
        startDate: toDate(row.getCell(2).value),
        endDate: toDate(row.getCell(3).value),
      }))
    : [];

  const tiqRows = wsT
    ? readRows(wsT, (row) => ({
        nombre: cellText(row.getCell(1).value).trim(),
        startDate: toDate(row.getCell(2).value),
        endDate: toDate(row.getCell(3).value),
        usos: toInt(row.getCell(4).value),
        pendientes: toInt(row.getCell(5).value),
      }))
    : [];

  // ── Quedarse con la fila más reciente por persona (por hoja) ──
  const latestBy = (rows) => {
    const map = new Map();
    for (const r of rows) {
      const key = normalizeName(r.nombre);
      const prev = map.get(key);
      const rTime = r.startDate?.getTime() ?? -1;
      const pTime = prev?.startDate?.getTime() ?? -1;
      if (!prev || rTime >= pTime) map.set(key, r);
    }
    return map;
  };
  const mensLatest = latestBy(mensRows);
  const tiqLatest = latestBy(tiqRows);

  // ── Persona en ambas hojas: gana la más reciente ──
  const omitted = [];
  for (const key of [...mensLatest.keys()]) {
    if (!tiqLatest.has(key)) continue;
    const m = mensLatest.get(key);
    const t = tiqLatest.get(key);
    const mTime = m.startDate?.getTime() ?? -1;
    const tTime = t.startDate?.getTime() ?? -1;
    if (mTime >= tTime) {
      omitted.push({ sheet: "tiqueteras", nombre: t.nombre, reason: "Tiene mensualidad más reciente" });
      tiqLatest.delete(key);
    } else {
      omitted.push({ sheet: "mensualidades", nombre: m.nombre, reason: "Tiene tiquetera más reciente" });
      mensLatest.delete(key);
    }
  }

  // ── Matching contra usuarios del panel ──
  await dbConnect();
  const users = await User.find({})
    .select("name email accessType credits tiquetera mensualidad")
    .lean();

  const byNorm = new Map();
  for (const u of users) {
    const key = normalizeName(u.name);
    if (!byNorm.has(key)) byNorm.set(key, []);
    byNorm.get(key).push(u);
  }

  // Distancia de edición ≤ 1 (tolera un error de dedo: Stphany/Stephany,
  // Gonzales/Gonzalez). Más de eso no, para no inventar matches.
  const lev1 = (a, b) => {
    if (a === b) return true;
    if (Math.abs(a.length - b.length) > 1) return false;
    let i = 0, j = 0, edits = 0;
    while (i < a.length && j < b.length) {
      if (a[i] === b[j]) { i++; j++; continue; }
      if (++edits > 1) return false;
      if (a.length > b.length) i++;
      else if (b.length > a.length) j++;
      else { i++; j++; }
    }
    return edits + (a.length - i) + (b.length - j) <= 1;
  };

  const matchUser = (nombre) => {
    const key = normalizeName(nombre);
    const exact = byNorm.get(key) || [];
    if (exact.length === 1) return { type: "exact", user: exact[0], candidates: [] };
    if (exact.length > 1) return { type: "ambiguous", user: null, candidates: exact };

    // fuzzy por tokens: TODAS las palabras del Excel deben aparecer en el
    // nombre del panel (tolerando 1 letra de diferencia por palabra). Cubre
    // "Jorge Ramirez" vs "Jorge Andrés Ramírez Gómez" y errores de dedo.
    const excelTokens = key.split(" ").filter((t) => t.length >= 3);
    if (excelTokens.length > 0) {
      const fuzzy = users.filter((u) => {
        const panelTokens = normalizeName(u.name).split(" ");
        return excelTokens.every((et) => panelTokens.some((pt) => lev1(et, pt)));
      });
      if (fuzzy.length === 1) return { type: "fuzzy", user: fuzzy[0], candidates: [] };
      if (fuzzy.length > 1) return { type: "ambiguous", user: null, candidates: fuzzy };
    }
    return { type: "none", user: null, candidates: [] };
  };

  const now = new Date();
  const rows = [];
  let id = 0;

  const pub = (u) =>
    u ? { _id: String(u._id), name: u.name, email: u.email, accessType: u.accessType } : null;

  for (const r of mensLatest.values()) {
    const m = matchUser(r.nombre);
    rows.push({
      id: `m${id++}`,
      sheet: "mensualidades",
      excelName: r.nombre,
      matchType: m.type,
      user: pub(m.user),
      candidates: m.candidates.map(pub),
      current: m.user
        ? {
            accessType: m.user.accessType,
            startDate: m.user.mensualidad?.startDate || null,
            endDate: m.user.mensualidad?.endDate || null,
          }
        : null,
      proposed: {
        accessType: "mensualidad",
        startDate: r.startDate,
        endDate: r.endDate,
        active: !!(r.endDate && r.endDate > now),
      },
    });
  }

  for (const r of tiqLatest.values()) {
    const m = matchUser(r.nombre);
    const pendientes = r.pendientes ?? 0;
    const total = (r.usos ?? 0) + pendientes || 8;
    rows.push({
      id: `t${id++}`,
      sheet: "tiqueteras",
      excelName: r.nombre,
      matchType: m.type,
      user: pub(m.user),
      candidates: m.candidates.map(pub),
      current: m.user
        ? {
            accessType: m.user.accessType,
            credits: m.user.credits ?? 0,
            startDate: m.user.tiquetera?.startDate || null,
            endDate: m.user.tiquetera?.endDate || null,
          }
        : null,
      proposed: {
        accessType: "ticketera",
        credits: pendientes,
        totalUses: total,
        startDate: r.startDate,
        endDate: r.endDate,
      },
    });
  }

  return {
    rows,
    omitted,
    summary: {
      total: rows.length,
      exact: rows.filter((r) => r.matchType === "exact").length,
      fuzzy: rows.filter((r) => r.matchType === "fuzzy").length,
      ambiguous: rows.filter((r) => r.matchType === "ambiguous").length,
      none: rows.filter((r) => r.matchType === "none").length,
    },
  };
}

/* ---------------- fase APPLY ---------------- */

async function applyRows(rows, actor) {
  await dbConnect();
  const results = { updated: [], failed: [] };

  for (const row of rows) {
    try {
      const userId = row?.userId;
      const p = row?.proposed || {};
      if (!userId || !row?.sheet) throw new Error("Fila incompleta");

      const user = await User.findById(userId);
      if (!user) throw new Error("Usuario no existe");

      if (row.sheet === "mensualidades") {
        user.accessType = "mensualidad";
        user.mensualidad = {
          ...(user.mensualidad || {}),
          active: !!p.active,
          startDate: p.startDate ? new Date(p.startDate) : user.mensualidad?.startDate,
          endDate: p.endDate ? new Date(p.endDate) : user.mensualidad?.endDate,
        };
      } else if (row.sheet === "tiqueteras") {
        user.accessType = "ticketera";
        const credits = Number(p.credits);
        if (Number.isFinite(credits)) user.credits = Math.max(0, Math.trunc(credits));
        user.tiquetera = {
          startDate: p.startDate ? new Date(p.startDate) : user.tiquetera?.startDate,
          endDate: p.endDate ? new Date(p.endDate) : user.tiquetera?.endDate,
          totalUses: Number(p.totalUses) || user.tiquetera?.totalUses || 8,
        };
      } else {
        throw new Error(`Hoja desconocida: ${row.sheet}`);
      }

      await user.save();
      results.updated.push({ userId: String(user._id), name: user.name, sheet: row.sheet });
    } catch (e) {
      results.failed.push({ userId: row?.userId || null, excelName: row?.excelName || "", error: e.message });
    }
  }

  const auditEvent = await logAudit({
    action: "IMPORT_XLSX",
    actor,
    summary: `Import Excel: ${results.updated.length} usuario(s) actualizados${
      results.failed.length ? `, ${results.failed.length} fallidos` : ""
    }`,
    meta: {
      updated: results.updated,
      failed: results.failed,
    },
  });

  return { ...results, auditEvent };
}

/* ---------------- handler ---------------- */

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

  const { mode } = req.body || {};

  try {
    if (mode === "preview") {
      const file = req.body?.file;
      if (!file) return res.status(400).json({ message: "Falta el archivo (base64)" });
      const preview = await buildPreview(file);
      return res.status(200).json(preview);
    }

    if (mode === "apply") {
      const rows = req.body?.rows;
      if (!Array.isArray(rows) || rows.length === 0) {
        return res.status(400).json({ message: "No hay filas confirmadas para aplicar" });
      }
      const result = await applyRows(rows, actor);
      return res.status(200).json(result);
    }

    return res.status(400).json({ message: "mode debe ser 'preview' o 'apply'" });
  } catch (err) {
    console.error("import-xlsx error:", err);
    return res
      .status(err.status || 500)
      .json({ message: err.status ? err.message : "Error procesando el Excel" });
  }
}
