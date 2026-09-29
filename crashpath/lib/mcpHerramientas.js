// Herramientas del MCP de Crashpath (docs/ideas-pendientes.md §1).
//
// Lectura: buscar, estado, vigentes, por vencer, check-ins del día, inactivos,
// vencidos recientes, historial (AuditLog), resumen de un periodo, datos por limpiar.
// Escritura: check-in, deshacer check-in, renovar mensualidad, cargar
// tiquetera, usar cortesía, editar datos del socio. Corren la MISMA
// lógica que el panel (lib/operaciones.js) y quedan en AuditLog con origen
// "mcp". Cada una tiene dos pasos: sin `confirmar` solo muestra qué va a pasar;
// con `confirmar: true` lo hace.
//
// Siempre por userId, nunca por nombre: si hay dos "Juan", Claude tiene que
// buscar primero y preguntar cuál es, en vez de adivinar.

import mongoose from "mongoose";
import { z } from "zod";
import User from "../models/User";
import AuditLog from "../models/AuditLog";
import { estadoAcceso, porVencer, buscarUsuarios, diaBogota, inicioDeHoy, normalizarTexto } from "./vigencia";
import { estadoCortesia } from "./cortesia";
import { dayRangeBogota } from "./dates";
import {
  hacerCheckin,
  renovarMensualidad,
  ajustarCreditos,
  cancelarVisita,
  usarCortesia,
  canAccessOrFail,
  calcularNuevoVencimiento,
  actualizarPerfil,
} from "./operaciones";

const ORIGEN = "mcp";

// Lo justo para buscar y decir si está vigente. Nada médico ni de waiver.
const CAMPOS_RESUMEN = "name email phone documentNumber accessType credits tiquetera mensualidad.endDate userType";

const texto = (obj) => ({ content: [{ type: "text", text: JSON.stringify(obj, null, 2) }] });
const error = (mensaje) => ({ content: [{ type: "text", text: mensaje }], isError: true });

function resumen(u) {
  const e = estadoAcceso(u);
  return {
    userId: String(u._id),
    nombre: u.name,
    email: u.email,
    telefono: u.phone || null,
    modalidad: e.tipo,
    vigente: e.vigente,
    vence: diaBogota(e.vence),
    creditos: e.creditos,
    motivo: e.motivo,
  };
}

const DIA_MS = 86400000;

/** Hora "HH:mm" en Bogotá. */
const horaBogota = (v) =>
  v ? new Date(v).toLocaleTimeString("es-CO", { timeZone: "America/Bogota", hour: "2-digit", minute: "2-digit", hour12: false }) : null;

/** Rango de un día "YYYY-MM-DD" (o de hoy). null si la fecha no existe (ej. 2026-02-30). */
function rangoDia(fecha) {
  const r = dayRangeBogota(fecha || new Date());
  if (!r || (fecha && diaBogota(r.start) !== fecha)) return null;
  return r;
}

const fechaOpcional = (desc) => z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().describe(desc);

/** Cuándo entró la visita (hora real del check-in si la hay). */
const momentoVisita = (v) => new Date(v.checkedInAt || v.date);

/** Última entrada real (checked_in) del usuario, o null. */
function ultimaEntrada(u) {
  let ultima = null;
  for (const v of u.visits || []) {
    if (v.status !== "checked_in") continue;
    const d = momentoVisita(v);
    if (!Number.isNaN(d.getTime()) && (!ultima || d > ultima)) ultima = d;
  }
  return ultima;
}

const modalidadLegible = (accessType) => (accessType === "ticketera" ? "tiquetera" : accessType || null);

async function cargarUsuario(userId) {
  if (!mongoose.isValidObjectId(userId)) return null;
  return User.findById(userId).lean();
}

const idUsuario = z.string().describe("userId que devolvió buscar_usuario");
const confirmar = z
  .boolean()
  .optional()
  .describe(
    "Sin esto (o en false) solo devuelve una vista previa y no cambia nada. " +
      "Poné true SOLO después de mostrarle la vista previa al usuario y que confirme explícitamente."
  );

// Los nombres de actualizarPerfil (los del modelo) a los que ve Claude.
const CAMPO_LEGIBLE = {
  name: "nombre",
  email: "email",
  phone: "telefono",
  documentType: "tipoDocumento",
  documentNumber: "numeroDocumento",
  epsName: "eps",
  emergencyContactName: "contactoEmergenciaNombre",
  emergencyContactPhone: "contactoEmergenciaTelefono",
};

const AVISO_PREVIA =
  "VISTA PREVIA: no se cambió nada. Mostrale esto al usuario y pedile confirmación; si confirma, llamá de nuevo con confirmar=true.";

/** Registra todas las herramientas en `server` actuando como `actor`. */
export function registrarHerramientas(server, actor) {
  /* ---------------- LECTURA ---------------- */

  server.registerTool(
    "buscar_usuario",
    {
      title: "Buscar socio",
      description:
        "Busca socios por nombre (tolera nombres incompletos y sin tildes), email, teléfono o documento. " +
        "Devuelve hasta 10 candidatos con su estado. Si hay más de uno parecido, preguntale al usuario cuál es antes de actuar.",
      inputSchema: { texto: z.string().min(2).describe("Nombre, parte del nombre, email, teléfono o documento") },
      annotations: { readOnlyHint: true },
    },
    async ({ texto: consulta }) => {
      const usuarios = await User.find({}, CAMPOS_RESUMEN).lean();
      const encontrados = buscarUsuarios(usuarios, consulta, 10);
      if (!encontrados.length) return texto({ resultados: [], nota: `Nadie coincide con "${consulta}".` });
      return texto({ resultados: encontrados.map(resumen) });
    }
  );

  server.registerTool(
    "estado_usuario",
    {
      title: "Estado de un socio",
      description:
        "Estado completo de acceso de un socio: modalidad, créditos, vencimiento, si está vigente, cortesía, waiver y últimas visitas.",
      inputSchema: { userId: idUsuario },
      annotations: { readOnlyHint: true },
    },
    async ({ userId }) => {
      const u = await cargarUsuario(userId);
      if (!u) return error("Usuario no encontrado.");

      const visitas = (u.visits || [])
        .filter((v) => v.status !== "cancelled")
        .sort((a, b) => new Date(b.date) - new Date(a.date))
        .slice(0, 5)
        .map((v) => ({ dia: diaBogota(v.date), estado: v.status, cortesia: !!v.esCortesia }));

      const renovaciones = u.mensualidad?.renewals || [];
      const ultimaRenovacion = renovaciones.length ? renovaciones[renovaciones.length - 1] : null;
      // Sin `usos`: traen el documento de los invitados.
      const c = estadoCortesia(u);
      const cortesia = { disponible: c.disponible, disponibles: c.disponibles, vence: diaBogota(c.vence), usosTotales: c.usos.length };

      return texto({
        ...resumen(u),
        tiquetera:
          u.accessType === "ticketera"
            ? { inicio: diaBogota(u.tiquetera?.startDate), vence: diaBogota(u.tiquetera?.endDate), totalUsos: u.tiquetera?.totalUses ?? null }
            : undefined,
        mensualidad:
          u.accessType === "mensualidad"
            ? {
                inicio: diaBogota(u.mensualidad?.startDate),
                vence: diaBogota(u.mensualidad?.endDate),
                ultimaRenovacion: ultimaRenovacion
                  ? { dia: diaBogota(ultimaRenovacion.renewedAt), por: ultimaRenovacion.adminEmail }
                  : null,
              }
            : undefined,
        cortesia,
        waiver: u.waiverStatus,
        tipoUsuario: u.userType,
        ultimasVisitas: visitas,
      });
    }
  );

  server.registerTool(
    "listar_vigentes",
    {
      title: "Socios vigentes",
      description:
        "Lista y cuenta los socios vigentes. Mensualidad: vence hoy o después. Tiquetera: tiene créditos y fecha de vencimiento de hoy en adelante " +
        "(las tiqueteras sin fecha NO cuentan).",
      inputSchema: {
        modalidad: z.enum(["todas", "mensualidad", "tiquetera"]).optional().describe("Filtro; por defecto todas"),
      },
      annotations: { readOnlyHint: true },
    },
    async ({ modalidad = "todas" }) => {
      const usuarios = await User.find({ accessType: { $in: ["mensualidad", "ticketera"] } }, CAMPOS_RESUMEN).lean();
      const vigentes = usuarios
        .map(resumen)
        .filter((r) => r.vigente && (modalidad === "todas" || r.modalidad === modalidad))
        .sort((a, b) => String(a.vence).localeCompare(String(b.vence)));

      return texto({
        total: vigentes.length,
        mensualidad: vigentes.filter((r) => r.modalidad === "mensualidad").length,
        tiquetera: vigentes.filter((r) => r.modalidad === "tiquetera").length,
        socios: vigentes.map(({ userId, nombre, modalidad: m, vence, creditos }) => ({ userId, nombre, modalidad: m, vence, creditos })),
      });
    }
  );

  server.registerTool(
    "listar_por_vencer",
    {
      title: "Socios por vencer",
      description:
        "Socios vigentes cuya mensualidad o tiquetera vence en los próximos N días (hoy incluido), o a los que les queda 1 crédito o menos.",
      inputSchema: {
        dias: z.number().int().min(0).max(60).optional().describe("Ventana en días; por defecto 7"),
      },
      annotations: { readOnlyHint: true },
    },
    async ({ dias = 7 }) => {
      const usuarios = await User.find({ accessType: { $in: ["mensualidad", "ticketera"] } }, CAMPOS_RESUMEN).lean();
      const lista = usuarios
        .map((u) => ({ u, motivo: porVencer(u, { dias }) }))
        .filter((x) => x.motivo)
        .map(({ u, motivo }) => {
          const r = resumen(u);
          return { userId: r.userId, nombre: r.nombre, telefono: r.telefono, modalidad: r.modalidad, vence: r.vence, creditos: r.creditos, motivo };
        })
        .sort((a, b) => String(a.vence).localeCompare(String(b.vence)));

      return texto({ dias, total: lista.length, socios: lista });
    }
  );

  server.registerTool(
    "checkins_del_dia",
    {
      title: "Check-ins del día",
      description:
        "Quién entró un día (por defecto hoy, hora Bogotá), en orden de llegada, y quién tenía reserva pero todavía no entró. " +
        "Marca los invitados que entraron con la cortesía de un socio.",
      inputSchema: { fecha: fechaOpcional("Día en formato YYYY-MM-DD; por defecto hoy") },
      annotations: { readOnlyHint: true },
    },
    async ({ fecha }) => {
      const rango = rangoDia(fecha);
      if (!rango) return error("Fecha inválida.");
      const { start, end } = rango;

      // Misma consulta que /api/admin/checkins, para que cuadre con el panel.
      const usuarios = await User.find(
        { "visits.date": { $gte: start, $lte: end }, "visits.status": { $in: ["checked_in", "registered"] } },
        "name accessType visits"
      ).lean();

      const entraron = [];
      const reservados = [];
      for (const u of usuarios) {
        for (const v of u.visits || []) {
          const d = new Date(v.date || v.checkedInAt);
          if (d < start || d > end) continue;
          const fila = {
            userId: String(u._id),
            nombre: u.name,
            modalidad: v.esCortesia ? "cortesía" : modalidadLegible(u.accessType),
            invitadoDe: v.esCortesia ? v.cortesiaHostName || null : undefined,
          };
          if (v.status === "checked_in") entraron.push({ ...fila, hora: horaBogota(momentoVisita(v)), _t: momentoVisita(v) });
          else if (v.status === "registered") reservados.push({ ...fila, hora: horaBogota(v.date), _t: v.date });
        }
      }
      const ordenar = (l) => l.sort((a, b) => new Date(a._t) - new Date(b._t)).map(({ _t, ...r }) => r);

      const porModalidad = {};
      for (const e of entraron) porModalidad[e.modalidad || "sin modalidad"] = (porModalidad[e.modalidad || "sin modalidad"] || 0) + 1;

      return texto({
        dia: diaBogota(start),
        totalEntraron: entraron.length,
        porModalidad,
        entraron: ordenar(entraron),
        reservadosSinEntrar: ordenar(reservados),
      });
    }
  );

  server.registerTool(
    "inactivos",
    {
      title: "Socios vigentes que no vienen",
      description:
        "Socios vigentes (mensualidad o tiquetera) que no han entrado en los últimos N días, o que nunca han entrado. " +
        "Sirve para escribirles antes de que se pierdan. Ordenados de más a menos tiempo sin venir.",
      inputSchema: {
        dias: z.number().int().min(1).max(180).optional().describe("Días sin venir; por defecto 14"),
      },
      annotations: { readOnlyHint: true },
    },
    async ({ dias = 14 }) => {
      const usuarios = await User.find(
        { accessType: { $in: ["mensualidad", "ticketera"] } },
        `${CAMPOS_RESUMEN} visits.date visits.status visits.checkedInAt`
      ).lean();

      const hoy = inicioDeHoy();
      const limite = new Date(hoy.getTime() - (dias - 1) * DIA_MS);
      const lista = usuarios
        .filter((u) => estadoAcceso(u).vigente)
        .map((u) => ({ u, ultima: ultimaEntrada(u) }))
        .filter(({ ultima }) => !ultima || ultima < limite)
        .map(({ u, ultima }) => {
          const r = resumen(u);
          return {
            userId: r.userId,
            nombre: r.nombre,
            telefono: r.telefono,
            modalidad: r.modalidad,
            vence: r.vence,
            creditos: r.creditos,
            ultimaVisita: diaBogota(ultima),
            diasSinVenir: ultima ? Math.floor((hoy - inicioDeHoy(ultima)) / DIA_MS) : null,
          };
        })
        .sort((a, b) => (b.diasSinVenir ?? Infinity) - (a.diasSinVenir ?? Infinity));

      return texto({ dias, total: lista.length, nota: "diasSinVenir null = nunca ha entrado", socios: lista });
    }
  );

  server.registerTool(
    "vencidos_recientes",
    {
      title: "Vencidos recientes sin renovar",
      description:
        "Socios que dejaron de estar vigentes en los últimos N días y no han renovado: mensualidad o tiquetera que venció, " +
        "o tiquetera que se quedó sin créditos (con última visita en esa ventana). Con teléfono para llamarlos.",
      inputSchema: {
        dias: z.number().int().min(1).max(90).optional().describe("Ventana en días hacia atrás; por defecto 15"),
      },
      annotations: { readOnlyHint: true },
    },
    async ({ dias = 15 }) => {
      const usuarios = await User.find(
        { accessType: { $in: ["mensualidad", "ticketera"] } },
        `${CAMPOS_RESUMEN} visits.date visits.status visits.checkedInAt`
      ).lean();

      const hoy = inicioDeHoy();
      const desde = new Date(hoy.getTime() - dias * DIA_MS);
      const lista = [];
      for (const u of usuarios) {
        const e = estadoAcceso(u);
        if (e.vigente) continue;
        const ultima = ultimaEntrada(u);
        const vencioEnVentana = e.vence && e.vence >= desde && e.vence < hoy;
        // Sin créditos: la fecha de vencimiento puede seguir vigente, así que
        // lo que dice "reciente" es la última vez que vino.
        const seQuedoSinCreditos = e.motivo === "sin créditos" && ultima && ultima >= desde;
        if (!vencioEnVentana && !seQuedoSinCreditos) continue;

        const r = resumen(u);
        lista.push({
          userId: r.userId,
          nombre: r.nombre,
          telefono: r.telefono,
          modalidad: r.modalidad,
          motivo: vencioEnVentana ? `venció el ${r.vence}` : "se quedó sin créditos",
          vence: r.vence,
          ultimaVisita: diaBogota(ultima),
        });
      }
      lista.sort((a, b) => String(b.vence || b.ultimaVisita).localeCompare(String(a.vence || a.ultimaVisita)));

      return texto({ dias, total: lista.length, socios: lista });
    }
  );

  server.registerTool(
    "historial",
    {
      title: "Historial de cambios (auditoría)",
      description:
        "Lo que se ha hecho en el panel y por MCP: check-ins, cargas de créditos, renovaciones, cortesías, cancelaciones, etc. " +
        "Filtrable por socio y por acción. Sirve para '¿quién le cargó créditos a X?' o '¿qué se hizo hoy?'.",
      inputSchema: {
        userId: z.string().optional().describe("Solo lo de este socio (userId de buscar_usuario)"),
        dias: z.number().int().min(1).max(365).optional().describe("Cuántos días hacia atrás, hoy incluido; por defecto 1 (hoy), o 90 si hay userId"),
        accion: z
          .string()
          .optional()
          .describe("Código de acción, ej. CHECKIN, ADJUST_CREDITS, MENSUALIDAD_RENEW, CORTESIA_USADA, VISIT_CANCEL"),
        limite: z.number().int().min(1).max(200).optional().describe("Máximo de registros; por defecto 50"),
      },
      annotations: { readOnlyHint: true },
    },
    async ({ userId, dias, accion, limite = 50 }) => {
      if (userId && !mongoose.isValidObjectId(userId)) return error("userId inválido.");
      const ventana = dias ?? (userId ? 90 : 1);
      const desde = new Date(inicioDeHoy().getTime() - (ventana - 1) * DIA_MS);

      const filtro = { ts: { $gte: desde } };
      if (userId) filtro.userId = userId;
      if (accion) filtro.action = accion.trim().toUpperCase();

      const eventos = await AuditLog.find(filtro).sort({ ts: -1 }).limit(limite).lean();
      return texto({
        desde: diaBogota(desde),
        total: eventos.length,
        eventos: eventos.map((ev) => ({
          dia: diaBogota(ev.ts),
          hora: horaBogota(ev.ts),
          accion: ev.action,
          resumen: ev.summary || null,
          socio: ev.userName || ev.userEmail || null,
          userId: ev.userId ? String(ev.userId) : null,
          por: ev.actorName || ev.actorEmail || null,
          rol: ev.actorRol || null,
          origen: ev.meta?.origen || "panel",
        })),
      });
    }
  );

  server.registerTool(
    "resumen_periodo",
    {
      title: "Resumen de un periodo",
      description:
        "Números de un rango de días (por defecto los últimos 7): entradas por día, personas distintas, horas pico, " +
        "cortesías, renovaciones de mensualidad y cargas de tiquetera.",
      inputSchema: {
        desde: fechaOpcional("Primer día YYYY-MM-DD; por defecto hace 6 días"),
        hasta: fechaOpcional("Último día YYYY-MM-DD; por defecto hoy"),
      },
      annotations: { readOnlyHint: true },
    },
    async ({ desde, hasta }) => {
      const rHasta = rangoDia(hasta);
      if (!rHasta) return error("Fecha 'hasta' inválida.");
      const rDesde = desde ? rangoDia(desde) : { start: new Date(rHasta.start.getTime() - 6 * DIA_MS) };
      if (!rDesde) return error("Fecha 'desde' inválida.");
      const start = rDesde.start;
      const end = rHasta.end;
      if (start > end) return error("'desde' es después de 'hasta'.");
      if (end - start > 92 * DIA_MS) return error("Máximo 92 días por consulta.");

      const usuarios = await User.find(
        { visits: { $elemMatch: { date: { $gte: start, $lte: end }, status: "checked_in" } } },
        "accessType visits.date visits.status visits.checkedInAt visits.esCortesia"
      ).lean();

      const porDia = {};
      for (let t = start.getTime(); t <= end.getTime(); t += DIA_MS) porDia[diaBogota(new Date(t))] = 0;
      const porHora = {};
      const personas = new Set();
      let entradas = 0;
      let cortesias = 0;
      const porModalidad = {};
      for (const u of usuarios) {
        for (const v of u.visits || []) {
          if (v.status !== "checked_in") continue;
          const d = new Date(v.date);
          if (d < start || d > end) continue;
          entradas++;
          personas.add(String(u._id));
          porDia[diaBogota(d)] = (porDia[diaBogota(d)] || 0) + 1;
          const h = `${horaBogota(momentoVisita(v)).slice(0, 2)}:00`;
          porHora[h] = (porHora[h] || 0) + 1;
          const m = v.esCortesia ? "cortesía" : modalidadLegible(u.accessType) || "sin modalidad";
          porModalidad[m] = (porModalidad[m] || 0) + 1;
          if (v.esCortesia) cortesias++;
        }
      }

      const eventos = await AuditLog.find(
        { ts: { $gte: start, $lte: end }, action: { $in: ["MENSUALIDAD_RENEW", "ADJUST_CREDITS", "VISIT_CANCEL"] } },
        "action meta.delta meta.months"
      ).lean();
      const renovaciones = eventos.filter((e) => e.action === "MENSUALIDAD_RENEW");
      const cargas = eventos.filter((e) => e.action === "ADJUST_CREDITS" && (e.meta?.delta ?? 0) > 0);

      const dias = Object.keys(porDia).length;
      return texto({
        desde: diaBogota(start),
        hasta: diaBogota(end),
        entradas,
        personasDistintas: personas.size,
        promedioPorDia: Math.round((entradas / dias) * 10) / 10,
        porModalidad,
        cortesias,
        porDia,
        horasPico: Object.entries(porHora)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 5)
          .map(([hora, n]) => ({ hora, entradas: n })),
        renovacionesMensualidad: renovaciones.length,
        mesesRenovados: renovaciones.reduce((s, e) => s + (e.meta?.months ?? 0), 0),
        cargasTiquetera: cargas.length,
        creditosCargados: cargas.reduce((s, e) => s + (e.meta?.delta ?? 0), 0),
        visitasCanceladas: eventos.filter((e) => e.action === "VISIT_CANCEL").length,
        nota: "Renovaciones y cargas salen de la auditoría; las cargas incluyen correcciones de +N hechas a mano.",
      });
    }
  );

  server.registerTool(
    "datos_pendientes",
    {
      title: "Datos por limpiar",
      description:
        "Lo que está mal cargado o incompleto: socios vigentes sin waiver firmado, tiqueteras con créditos pero sin fecha " +
        "de vencimiento, mensualidades sin fecha y posibles cuentas duplicadas (mismo nombre o documento, ej. las del import).",
      inputSchema: {},
      annotations: { readOnlyHint: true },
    },
    async () => {
      const usuarios = await User.find({}, `${CAMPOS_RESUMEN} waiverStatus`).lean();
      const ficha = (u) => ({ userId: String(u._id), nombre: u.name, email: u.email });

      const sinWaiver = usuarios.filter((u) => estadoAcceso(u).vigente && u.waiverStatus !== "signed").map(ficha);
      const tiqueterasSinFecha = usuarios
        .filter((u) => u.accessType === "ticketera" && (u.credits ?? 0) > 0 && !u.tiquetera?.endDate)
        .map((u) => ({ ...ficha(u), creditos: u.credits }));
      const mensualidadesSinFecha = usuarios.filter((u) => u.accessType === "mensualidad" && !u.mensualidad?.endDate).map(ficha);

      // Duplicados: mismo nombre normalizado o mismo documento.
      const grupos = new Map();
      const agrupar = (clave, u) => {
        if (!clave) return;
        if (!grupos.has(clave)) grupos.set(clave, new Map());
        grupos.get(clave).set(String(u._id), u);
      };
      for (const u of usuarios) {
        agrupar(normalizarTexto(u.name) && `nombre:${normalizarTexto(u.name)}`, u);
        const doc = String(u.documentNumber || "").replace(/\s/g, "");
        agrupar(doc && `documento:${doc}`, u);
      }
      const vistos = new Set();
      const posiblesDuplicados = [];
      for (const [clave, miembros] of grupos) {
        if (miembros.size < 2) continue;
        const ids = [...miembros.keys()].sort().join(",");
        if (vistos.has(ids)) continue;
        vistos.add(ids);
        posiblesDuplicados.push({
          coinciden: clave.startsWith("nombre:") ? "nombre" : "documento",
          cuentas: [...miembros.values()].map((u) => {
            const r = resumen(u);
            return { ...ficha(u), modalidad: r.modalidad, vigente: r.vigente, creditos: r.creditos, vence: r.vence };
          }),
        });
      }

      return texto({
        vigentesSinWaiver: { total: sinWaiver.length, socios: sinWaiver },
        tiqueterasConCreditosSinFecha: { total: tiqueterasSinFecha.length, socios: tiqueterasSinFecha },
        mensualidadesSinFecha: { total: mensualidadesSinFecha.length, socios: mensualidadesSinFecha },
        posiblesDuplicados: { total: posiblesDuplicados.length, grupos: posiblesDuplicados },
      });
    }
  );

  /* ---------------- ESCRITURA ---------------- */

  server.registerTool(
    "hacer_checkin",
    {
      title: "Check-in (descuenta crédito)",
      description:
        "Registra la entrada de hoy de un socio. Si es de tiquetera descuenta 1 crédito. No hace nada si ya entró hoy. " +
        "Primero llamá sin confirmar para ver la vista previa.",
      inputSchema: { userId: idUsuario, confirmar },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true },
    },
    async ({ userId, confirmar: ok }) => {
      const u = await cargarUsuario(userId);
      if (!u) return error("Usuario no encontrado.");

      if (!ok) {
        const acceso = canAccessOrFail(u);
        return texto({
          aviso: AVISO_PREVIA,
          socio: u.name,
          email: u.email,
          modalidad: u.accessType,
          puedeEntrar: acceso.ok,
          motivo: acceso.ok ? null : acceso.message,
          efecto:
            u.accessType === "ticketera"
              ? `Descuenta 1 crédito: ${u.credits ?? 0} → ${Math.max(0, (u.credits ?? 0) - 1)}`
              : "Registra la visita de hoy (mensualidad, no descuenta nada)",
        });
      }

      const { status, body } = await hacerCheckin({ query: { _id: u._id }, actor, meta: {}, origen: ORIGEN });
      if (status >= 400) return error(body.message || "No se pudo hacer el check-in.");
      return texto({
        hecho: body.code === "ALREADY_CHECKED_IN" ? "Ya había entrado hoy; no se descontó nada." : "Check-in registrado.",
        socio: u.name,
        creditos: body.credits ?? null,
      });
    }
  );

  server.registerTool(
    "renovar_mensualidad",
    {
      title: "Renovar mensualidad",
      description:
        "Renueva la mensualidad N meses. Si está vigente extiende desde el vencimiento actual; si venció, desde hoy. " +
        "También renueva la cortesía. Primero llamá sin confirmar para ver la vista previa.",
      inputSchema: {
        userId: idUsuario,
        meses: z.number().int().min(1).max(12).optional().describe("Meses a renovar; por defecto 1"),
        confirmar,
      },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false },
    },
    async ({ userId, meses = 1, confirmar: ok }) => {
      const u = await cargarUsuario(userId);
      if (!u) return error("Usuario no encontrado.");
      if (u.accessType !== "mensualidad") {
        return error(`${u.name} no es de mensualidad (modalidad: ${u.accessType || "ninguna"}).`);
      }

      if (!ok) {
        return texto({
          aviso: AVISO_PREVIA,
          socio: u.name,
          email: u.email,
          venceActual: diaBogota(u.mensualidad?.endDate),
          meses,
          venceriaEl: diaBogota(calcularNuevoVencimiento(u.mensualidad?.endDate, meses)),
        });
      }

      const { status, body } = await renovarMensualidad({ userId: String(u._id), months: meses, actor, origen: ORIGEN });
      if (status >= 400) return error(body.message || "No se pudo renovar.");
      return texto({ hecho: "Mensualidad renovada.", socio: u.name, vence: diaBogota(body.mensualidad?.endDate) });
    }
  );

  server.registerTool(
    "cargar_tiquetera",
    {
      title: "Cargar créditos de tiquetera",
      description:
        "Suma créditos a un socio de tiquetera. Si la tiquetera estaba vencida o sin fecha, arranca una vigencia nueva de 60 días. " +
        "Renueva la cortesía. Primero llamá sin confirmar para ver la vista previa.",
      inputSchema: {
        userId: idUsuario,
        creditos: z.number().int().min(1).max(50).describe("Créditos a sumar (ej. 8 para una tiquetera nueva)"),
        confirmar,
      },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false },
    },
    async ({ userId, creditos, confirmar: ok }) => {
      const u = await cargarUsuario(userId);
      if (!u) return error("Usuario no encontrado.");
      if (u.accessType !== "ticketera") {
        return error(`${u.name} no es de tiquetera (modalidad: ${u.accessType || "ninguna"}).`);
      }

      if (!ok) {
        const vence = u.tiquetera?.endDate ? new Date(u.tiquetera.endDate) : null;
        const nuevaVigencia = !vence || vence < new Date();
        return texto({
          aviso: AVISO_PREVIA,
          socio: u.name,
          email: u.email,
          creditos: `${u.credits ?? 0} → ${(u.credits ?? 0) + creditos}`,
          vencimiento: nuevaVigencia
            ? `nueva vigencia de 60 días (hasta ${diaBogota(new Date(Date.now() + 60 * 86400000))})`
            : `sin cambios (${diaBogota(vence)})`,
        });
      }

      const { status, body } = await ajustarCreditos({ userId: String(u._id), delta: creditos, actor, origen: ORIGEN });
      if (status >= 400) return error(body.message || "No se pudieron cargar los créditos.");
      return texto({
        hecho: "Créditos cargados.",
        socio: u.name,
        creditos: body.credits,
        vence: diaBogota(body.tiquetera?.endDate),
      });
    }
  );

  server.registerTool(
    "deshacer_checkin",
    {
      title: "Deshacer check-in de hoy",
      description:
        "Cancela el check-in de HOY de un socio (por ejemplo, si se hizo al socio equivocado). Si es de tiquetera le devuelve " +
        "el crédito. Si era un invitado de cortesía, la cortesía NO se le devuelve al anfitrión. " +
        "Primero llamá sin confirmar para ver la vista previa.",
      inputSchema: { userId: idUsuario, confirmar },
      annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true },
    },
    async ({ userId, confirmar: ok }) => {
      const u = await cargarUsuario(userId);
      if (!u) return error("Usuario no encontrado.");

      const { start, end } = rangoDia();
      const visita = (u.visits || []).find((v) => {
        const d = new Date(v.date);
        return v.status === "checked_in" && d >= start && d <= end;
      });
      if (!visita) return error(`${u.name} no tiene check-in hoy.`);

      // Devolver el crédito solo si el check-in lo descontó: tiquetera y no
      // entró como invitado de cortesía.
      const devolver = u.accessType === "ticketera" && !visita.esCortesia;

      if (!ok) {
        return texto({
          aviso: AVISO_PREVIA,
          socio: u.name,
          email: u.email,
          checkin: `hoy a las ${horaBogota(momentoVisita(visita))}`,
          efecto: devolver
            ? `Cancela la visita y devuelve 1 crédito: ${u.credits ?? 0} → ${(u.credits ?? 0) + 1}`
            : visita.esCortesia
              ? `Cancela la visita de invitado (cortesía de ${visita.cortesiaHostName || "otro socio"}); la cortesía no se devuelve`
              : "Cancela la visita (mensualidad, no hay crédito que devolver)",
        });
      }

      const { status, body } = await cancelarVisita({
        userId: String(u._id),
        visitId: String(visita._id),
        refund: devolver,
        actor,
        origen: ORIGEN,
      });
      if (status >= 400) return error(body.message || "No se pudo deshacer el check-in.");
      return texto({
        hecho: body.code === "ALREADY_CANCELLED" ? "Esa visita ya estaba cancelada." : "Check-in deshecho.",
        socio: u.name,
        creditos: devolver ? body.credits : undefined,
      });
    }
  );

  server.registerTool(
    "usar_cortesia",
    {
      title: "Usar cortesía (entra un invitado)",
      description:
        "Un socio gasta su cortesía para que entre un invitado, que queda con check-in de hoy. Solo para invitados que ya " +
        "existen en el sistema y tienen el waiver firmado (buscalo con buscar_usuario); uno nuevo tiene que registrarse y " +
        "firmar en el mostrador. Primero llamá sin confirmar para ver la vista previa.",
      inputSchema: {
        socioId: idUsuario.describe("userId del socio que invita (el anfitrión)"),
        invitadoId: idUsuario.describe("userId del invitado"),
        confirmar,
      },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false },
    },
    async ({ socioId, invitadoId, confirmar: ok }) => {
      const [host, guest] = await Promise.all([cargarUsuario(socioId), cargarUsuario(invitadoId)]);
      if (!host) return error("Socio no encontrado.");
      if (!guest) return error("Invitado no encontrado.");
      if (String(host._id) === String(guest._id)) return error("El invitado no puede ser el mismo socio.");
      if (guest.waiverStatus !== "signed") {
        return error(`${guest.name} no tiene el waiver firmado: tiene que firmarlo en el mostrador antes de entrar.`);
      }

      if (!ok) {
        const c = estadoCortesia(host);
        return texto({
          aviso: AVISO_PREVIA,
          socio: host.name,
          invitado: guest.name,
          cortesiaDisponible: c.disponible,
          motivo: c.disponible ? null : c.vencida ? "la cortesía venció" : "no le quedan cortesías",
          efecto: c.disponible
            ? `${host.name} gasta su cortesía (${c.disponibles} → ${c.disponibles - 1}) y ${guest.name} queda con check-in de hoy`
            : "No se puede usar",
        });
      }

      const { status, body } = await usarCortesia({ hostId: String(host._id), guestUserId: String(guest._id), actor, origen: ORIGEN });
      if (status >= 400) return error(body.message || "No se pudo usar la cortesía.");
      return texto({ hecho: "Cortesía usada: el invitado quedó con check-in.", socio: host.name, invitado: guest.name });
    }
  );

  server.registerTool(
    "editar_usuario",
    {
      title: "Editar datos de un socio",
      description:
        "Corrige los datos de contacto e identificación de un socio: nombre, email, teléfono, documento, EPS y contacto " +
        "de emergencia. Mandá solo los campos que cambian; los que no mandes quedan igual (esto no borra datos). " +
        "Poner el email real a un socio importado (@crashpath.local) lo conecta con su login de Google. " +
        "Primero llamá sin confirmar para ver la vista previa.",
      inputSchema: {
        userId: idUsuario,
        nombre: z.string().min(1).optional().describe("Nombre completo"),
        email: z.string().optional().describe("Email (el de Google si va a entrar con su cuenta)"),
        telefono: z.string().optional(),
        tipoDocumento: z.enum(["CC", "CE", "TI", "PP", "NIT", "OTRO"]).optional(),
        numeroDocumento: z.string().optional(),
        eps: z.string().optional(),
        contactoEmergenciaNombre: z.string().optional(),
        contactoEmergenciaTelefono: z.string().optional(),
        confirmar,
      },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true },
    },
    async ({ userId, confirmar: ok, ...campos }) => {
      if (!mongoose.isValidObjectId(userId)) return error("Usuario no encontrado.");

      const datos = {
        name: campos.nombre,
        email: campos.email,
        phone: campos.telefono,
        documentType: campos.tipoDocumento,
        documentNumber: campos.numeroDocumento,
        epsName: campos.eps,
        emergencyContactName: campos.contactoEmergenciaNombre,
        emergencyContactPhone: campos.contactoEmergenciaTelefono,
      };

      const { status, body } = await actualizarPerfil({ userId, datos, actor, origen: ORIGEN, simular: !ok });
      if (status >= 400) return error(body.message || "No se pudo editar el socio.");

      const cambios = Object.fromEntries(
        Object.entries(body.cambios).map(([k, { antes, despues }]) => [CAMPO_LEGIBLE[k], { antes, despues }])
      );
      if (!Object.keys(cambios).length) {
        return texto({ nota: "Nada que cambiar: los datos que mandaste son iguales a los que ya tiene.", socio: body.user.name });
      }

      if (!ok) return texto({ aviso: AVISO_PREVIA, socio: body.user.name, cambios });
      return texto({ hecho: "Datos actualizados.", socio: body.user.name, cambios });
    }
  );
}
