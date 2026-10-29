import { describe, it, expect, vi, beforeAll, afterAll } from "vitest";

// Las herramientas del MCP con la base simulada: User.find/AuditLog.find
// devuelven fixtures y las operaciones de escritura se espían. Hoy es el
// sábado 26/09/2026 a las 3pm en Bogotá.

const h = vi.hoisted(() => {
  const d = (s) => new Date(s);
  const usuarios = [
    {
      _id: "aaaaaaaaaaaaaaaaaaaaaaaa",
      name: "Ana Tiquetera",
      accessType: "ticketera",
      credits: 3,
      tiquetera: { endDate: d("2026-10-30T05:00:00Z") },
      waiverStatus: "signed",
      cortesia: { disponibles: 1 },
      visits: [
        { _id: "v1", date: d("2026-09-26T12:00:00Z"), checkedInAt: d("2026-09-26T13:30:00Z"), status: "checked_in" },
        { _id: "v0", date: d("2026-09-25T12:00:00Z"), checkedInAt: d("2026-09-25T12:00:00Z"), status: "checked_in" },
      ],
    },
    {
      _id: "bbbbbbbbbbbbbbbbbbbbbbbb",
      name: "Beto Mensual",
      phone: "3001112233",
      accessType: "mensualidad",
      mensualidad: { endDate: d("2026-10-20T05:00:00Z") },
      waiverStatus: "pending",
      visits: [
        { _id: "v2", date: d("2026-09-26T23:00:00Z"), status: "registered" },
        { _id: "v3", date: d("2026-08-01T15:00:00Z"), checkedInAt: d("2026-08-01T15:00:00Z"), status: "checked_in" },
      ],
    },
    {
      _id: "cccccccccccccccccccccccc",
      name: "Invitado Uno",
      accessType: null,
      waiverStatus: "signed",
      visits: [
        {
          _id: "v4",
          date: d("2026-09-26T11:00:00Z"),
          checkedInAt: d("2026-09-26T11:00:00Z"),
          status: "checked_in",
          esCortesia: true,
          cortesiaHostName: "Ana Tiquetera",
        },
      ],
    },
    {
      _id: "dddddddddddddddddddddddd",
      name: "Dora Vencida",
      phone: "3004445566",
      accessType: "mensualidad",
      mensualidad: { endDate: d("2026-09-20T05:00:00Z") },
      visits: [],
    },
    {
      _id: "eeeeeeeeeeeeeeeeeeeeeeee",
      name: "Ana Tiquetera",
      email: "import_ana@crashpath.local",
      accessType: "ticketera",
      credits: 2,
      visits: [],
    },
  ];
  const lean = (v) => ({ lean: async () => v });
  return {
    usuarios,
    User: {
      find: vi.fn(() => lean(usuarios)),
      findById: vi.fn((id) => lean(usuarios.find((u) => u._id === id) || null)),
    },
    AuditLog: {
      find: vi.fn(() => ({
        sort: () => ({ limit: () => lean([{ ts: d("2026-09-26T14:00:00Z"), action: "CHECKIN", summary: "Check-in", userName: "Ana", actorEmail: "x@y.z", meta: { origen: "mcp" } }]) }),
        lean: async () => [
          { action: "ADJUST_CREDITS", meta: { delta: 8 } },
          { action: "ADJUST_CREDITS", meta: { delta: -1 } },
          { action: "MENSUALIDAD_RENEW", meta: { months: 2 } },
        ],
      })),
    },
    cancelarVisita: vi.fn(async () => ({ status: 200, body: { credits: 4 } })),
    usarCortesia: vi.fn(async () => ({ status: 200, body: {} })),
    turnosVigentes: vi.fn(async () => []),
    otorgarTurno: vi.fn(async ({ email, name }) => ({
      status: 201,
      body: { turno: { email, name, vence: d("2026-09-27T04:59:59.999Z") } },
    })),
    revocarTurno: vi.fn(async ({ email }) => ({ status: 200, body: { email, turnosCortados: 1 } })),
    actualizarPerfil: vi.fn(async ({ datos }) => ({
      status: 200,
      body: {
        user: { name: "Beto Mensual" },
        cambios: datos.phone ? { phone: { antes: "3001112233", despues: datos.phone } } : {},
      },
    })),
  };
});

vi.mock("../models/User", () => ({ default: h.User }));
vi.mock("../models/AuditLog", () => ({ default: h.AuditLog }));
vi.mock("../lib/operaciones", () => ({
  cancelarVisita: h.cancelarVisita,
  usarCortesia: h.usarCortesia,
  actualizarPerfil: h.actualizarPerfil,
  calcularNuevoVencimiento: () => new Date(),
  canAccessOrFail: () => ({ ok: true }),
}));

vi.mock("../lib/turnos", async (original) => ({
  ...(await original()),
  turnosVigentes: h.turnosVigentes,
  otorgarTurno: h.otorgarTurno,
  revocarTurno: h.revocarTurno,
}));

import { registrarHerramientas } from "../lib/mcpHerramientas";

const tools = {};
registrarHerramientas({ registerTool: (nombre, _config, fn) => (tools[nombre] = fn) }, { email: "dueño@x.co", rol: "admin" });
const llamar = async (nombre, args = {}) => {
  const r = await tools[nombre](args);
  return r.isError ? { error: r.content[0].text } : JSON.parse(r.content[0].text);
};

beforeAll(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-09-26T20:00:00Z"));
});
afterAll(() => vi.useRealTimers());

describe("checkins_del_dia", () => {
  it("separa entradas de reservas, en hora de Bogotá y en orden", async () => {
    const r = await llamar("checkins_del_dia");
    expect(r.dia).toBe("2026-09-26");
    expect(r.totalEntraron).toBe(2);
    expect(r.entraron.map((e) => [e.nombre, e.hora])).toEqual([
      ["Invitado Uno", "06:00"],
      ["Ana Tiquetera", "08:30"],
    ]);
    expect(r.entraron[0]).toMatchObject({ modalidad: "cortesía", invitadoDe: "Ana Tiquetera" });
    expect(r.reservadosSinEntrar).toEqual([expect.objectContaining({ nombre: "Beto Mensual", hora: "18:00" })]);
  });

  it("rechaza fechas que no existen", async () => {
    expect((await llamar("checkins_del_dia", { fecha: "2026-02-30" })).error).toBe("Fecha inválida.");
  });
});

describe("inactivos", () => {
  it("trae vigentes que no vienen hace N días, sin los que vinieron ni los vencidos", async () => {
    const r = await llamar("inactivos", { dias: 14 });
    expect(r.socios.map((s) => s.nombre)).toEqual(["Beto Mensual"]);
    expect(r.socios[0]).toMatchObject({ ultimaVisita: "2026-08-01", diasSinVenir: 56 });
  });
});

describe("vencidos_recientes", () => {
  it("trae a quien venció en la ventana", async () => {
    const r = await llamar("vencidos_recientes", { dias: 15 });
    expect(r.socios.map((s) => s.nombre)).toEqual(["Dora Vencida"]);
    expect(r.socios[0]).toMatchObject({ motivo: "venció el 2026-09-20", telefono: "3004445566" });
  });
});

describe("historial", () => {
  it("marca el origen y no expone el meta crudo", async () => {
    const r = await llamar("historial");
    expect(r.eventos[0]).toMatchObject({ accion: "CHECKIN", origen: "mcp", hora: "09:00" });
    expect(r.eventos[0].meta).toBeUndefined();
  });
});

describe("resumen_periodo", () => {
  it("cuenta entradas, cargas (solo positivas) y renovaciones", async () => {
    const r = await llamar("resumen_periodo");
    expect(r.desde).toBe("2026-09-20");
    expect(r.hasta).toBe("2026-09-26");
    expect(r.entradas).toBe(3);
    expect(r.personasDistintas).toBe(2);
    expect(r.porDia["2026-09-25"]).toBe(1);
    expect(r.cortesias).toBe(1);
    expect(r).toMatchObject({ cargasTiquetera: 1, creditosCargados: 8, renovacionesMensualidad: 1, mesesRenovados: 2 });
  });
});

describe("datos_pendientes", () => {
  it("encuentra waivers pendientes y cuentas con el mismo nombre", async () => {
    const r = await llamar("datos_pendientes");
    expect(r.vigentesSinWaiver.socios.map((s) => s.nombre)).toEqual(["Beto Mensual"]);
    expect(r.tiqueterasConCreditosSinFecha.socios.map((s) => s.email)).toEqual(["import_ana@crashpath.local"]);
    expect(r.posiblesDuplicados.total).toBe(1);
    expect(r.posiblesDuplicados.grupos[0].cuentas).toHaveLength(2);
  });
});

describe("deshacer_checkin", () => {
  it("sin confirmar no toca nada y avisa que devuelve el crédito", async () => {
    const r = await llamar("deshacer_checkin", { userId: "aaaaaaaaaaaaaaaaaaaaaaaa" });
    expect(r.efecto).toMatch(/devuelve 1 crédito: 3 → 4/);
    expect(h.cancelarVisita).not.toHaveBeenCalled();
  });

  it("confirmado cancela la visita de hoy con reembolso", async () => {
    await llamar("deshacer_checkin", { userId: "aaaaaaaaaaaaaaaaaaaaaaaa", confirmar: true });
    expect(h.cancelarVisita).toHaveBeenCalledWith(expect.objectContaining({ visitId: "v1", refund: true, origen: "mcp" }));
  });

  it("a un invitado de cortesía no le devuelve crédito", async () => {
    h.cancelarVisita.mockClear();
    await llamar("deshacer_checkin", { userId: "cccccccccccccccccccccccc", confirmar: true });
    expect(h.cancelarVisita).toHaveBeenCalledWith(expect.objectContaining({ visitId: "v4", refund: false }));
  });

  it("sin check-in hoy da error", async () => {
    expect((await llamar("deshacer_checkin", { userId: "dddddddddddddddddddddddd" })).error).toMatch(/no tiene check-in hoy/);
  });
});

describe("usar_cortesia", () => {
  it("exige waiver firmado del invitado", async () => {
    const r = await llamar("usar_cortesia", { socioId: "aaaaaaaaaaaaaaaaaaaaaaaa", invitadoId: "bbbbbbbbbbbbbbbbbbbbbbbb" });
    expect(r.error).toMatch(/waiver/);
  });

  it("confirmado llama la operación compartida con origen mcp", async () => {
    const previa = await llamar("usar_cortesia", { socioId: "aaaaaaaaaaaaaaaaaaaaaaaa", invitadoId: "cccccccccccccccccccccccc" });
    expect(previa.cortesiaDisponible).toBe(true);
    expect(h.usarCortesia).not.toHaveBeenCalled();
    await llamar("usar_cortesia", { socioId: "aaaaaaaaaaaaaaaaaaaaaaaa", invitadoId: "cccccccccccccccccccccccc", confirmar: true });
    expect(h.usarCortesia).toHaveBeenCalledWith(
      expect.objectContaining({ hostId: "aaaaaaaaaaaaaaaaaaaaaaaa", guestUserId: "cccccccccccccccccccccccc", origen: "mcp" })
    );
  });
});

describe("editar_usuario", () => {
  const beto = "bbbbbbbbbbbbbbbbbbbbbbbb";

  it("sin confirmar simula y muestra antes → después con nombres legibles", async () => {
    h.actualizarPerfil.mockClear();
    const r = await llamar("editar_usuario", { userId: beto, telefono: "3009998877" });
    expect(r.aviso).toMatch(/VISTA PREVIA/);
    expect(r.cambios).toEqual({ telefono: { antes: "3001112233", despues: "3009998877" } });
    expect(h.actualizarPerfil).toHaveBeenCalledWith(
      expect.objectContaining({ userId: beto, simular: true, origen: "mcp", datos: expect.objectContaining({ phone: "3009998877" }) })
    );
  });

  it("con confirmar guarda de verdad", async () => {
    h.actualizarPerfil.mockClear();
    const r = await llamar("editar_usuario", { userId: beto, telefono: "3009998877", confirmar: true });
    expect(r.hecho).toBe("Datos actualizados.");
    expect(h.actualizarPerfil).toHaveBeenCalledWith(expect.objectContaining({ simular: false }));
  });

  it("avisa si no hay nada que cambiar", async () => {
    const r = await llamar("editar_usuario", { userId: beto, nombre: "Beto Mensual" });
    expect(r.nota).toMatch(/Nada que cambiar/);
  });

  it("pasa el error de la operación (ej. email repetido)", async () => {
    h.actualizarPerfil.mockResolvedValueOnce({ status: 409, body: { message: "Ese email ya está en uso por otra cuenta." } });
    expect((await llamar("editar_usuario", { userId: beto, email: "otro@x.co" })).error).toMatch(/ya está en uso/);
  });

  it("rechaza un userId que no es ObjectId sin tocar la base", async () => {
    h.actualizarPerfil.mockClear();
    expect((await llamar("editar_usuario", { userId: "juan" })).error).toMatch(/no encontrado/);
    expect(h.actualizarPerfil).not.toHaveBeenCalled();
  });
});

describe("turnos de voluntario", () => {
  const turnoHoy = { email: "vol@gmail.com", name: "Vol", vence: new Date("2026-09-27T04:59:59.999Z") };

  it("otorgar sin confirmar es vista previa con el vencimiento de hoy", async () => {
    h.otorgarTurno.mockClear();
    const r = await llamar("otorgar_turno_voluntario", { email: " Vol@Gmail.com " });
    expect(r.aviso).toMatch(/VISTA PREVIA/);
    expect(r.email).toBe("vol@gmail.com");
    expect(r.efecto).toBe("Turno de voluntario hasta hoy 2026-09-26 a las 23:59");
    expect(h.otorgarTurno).not.toHaveBeenCalled();
  });

  it("la vista previa avisa si ya tiene turno", async () => {
    h.turnosVigentes.mockResolvedValueOnce([turnoHoy]);
    const r = await llamar("otorgar_turno_voluntario", { email: "vol@gmail.com" });
    expect(r.efecto).toMatch(/Ya tiene turno hoy/);
  });

  it("con confirmar otorga con origen mcp", async () => {
    const r = await llamar("otorgar_turno_voluntario", { email: "vol@gmail.com", nombre: "Vol", confirmar: true });
    expect(r).toMatchObject({ hecho: "Turno otorgado.", email: "vol@gmail.com", vence: "2026-09-26 23:59" });
    expect(h.otorgarTurno).toHaveBeenCalledWith(expect.objectContaining({ email: "vol@gmail.com", name: "Vol", origen: "mcp" }));
  });

  it("rechaza emails inválidos y de admins sin tocar la base", async () => {
    h.otorgarTurno.mockClear();
    expect((await llamar("otorgar_turno_voluntario", { email: "no-es-email", confirmar: true })).error).toBe("Email inválido");
    expect((await llamar("otorgar_turno_voluntario", { email: "rvpacheco17@gmail.com", confirmar: true })).error).toMatch(/administrador/);
    expect(h.otorgarTurno).not.toHaveBeenCalled();
  });

  it("revocar sin turno vigente es error; con turno muestra la vista previa", async () => {
    expect((await llamar("revocar_turno_voluntario", { email: "vol@gmail.com" })).error).toMatch(/no tiene turno vigente/);
    h.turnosVigentes.mockResolvedValueOnce([turnoHoy]);
    const r = await llamar("revocar_turno_voluntario", { email: "vol@gmail.com" });
    expect(r.aviso).toMatch(/VISTA PREVIA/);
    expect(h.revocarTurno).not.toHaveBeenCalled();
  });

  it("revocar con confirmar corta el turno", async () => {
    const r = await llamar("revocar_turno_voluntario", { email: "vol@gmail.com", confirmar: true });
    expect(r).toEqual({ hecho: "Turno revocado.", email: "vol@gmail.com", turnosCortados: 1 });
    expect(h.revocarTurno).toHaveBeenCalledWith(expect.objectContaining({ email: "vol@gmail.com", origen: "mcp" }));
  });

  it("turnos_voluntario lista los vigentes en hora de Bogotá", async () => {
    h.turnosVigentes.mockResolvedValueOnce([turnoHoy]);
    expect(await llamar("turnos_voluntario")).toEqual({
      total: 1,
      turnos: [{ email: "vol@gmail.com", nombre: "Vol", vence: "2026-09-26 23:59" }],
    });
  });
});
