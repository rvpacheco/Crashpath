// Herramientas del MCP de Crashpath (docs/ideas-pendientes.md §1).
//
// Lectura: buscar, estado, vigentes, por vencer.
// Escritura: check-in, renovar mensualidad, cargar tiquetera. Corren la MISMA
// lógica que el panel (lib/operaciones.js) y quedan en AuditLog con origen
// "mcp". Cada una tiene dos pasos: sin `confirmar` solo muestra qué va a pasar;
// con `confirmar: true` lo hace.
//
// Siempre por userId, nunca por nombre: si hay dos "Juan", Claude tiene que
// buscar primero y preguntar cuál es, en vez de adivinar.

import mongoose from "mongoose";
import { z } from "zod";
import User from "../models/User";
import { estadoAcceso, porVencer, buscarUsuarios, diaBogota } from "./vigencia";
import { estadoCortesia } from "./cortesia";
import {
  hacerCheckin,
  renovarMensualidad,
  ajustarCreditos,
  canAccessOrFail,
  calcularNuevoVencimiento,
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
}
