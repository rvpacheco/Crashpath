import { describe, it, expect, vi, beforeEach } from "vitest";

// corregirCreditos (lib/operaciones.js) con el modelo simulado: la usa la
// herramienta ajustar_creditos del MCP.

const h = vi.hoisted(() => {
  const state = { user: null };
  return {
    state,
    User: { findById: vi.fn(async () => state.user) },
    logAudit: vi.fn(async (e) => e),
  };
});

vi.mock("../models/User", () => ({ default: h.User }));
vi.mock("../lib/audit", () => ({ logAudit: h.logAudit }));
vi.mock("../lib/mongodb", () => ({ default: async () => {} }));

import { corregirCreditos } from "../lib/operaciones";

const ID = "aaaaaaaaaaaaaaaaaaaaaaaa";
const actor = { email: "dueño@x.co", rol: "admin" };
const base = { userId: ID, modo: "restar", creditos: 8, motivo: "Carga por error", actor, origen: "mcp" };

beforeEach(() => {
  h.state.user = {
    _id: ID,
    name: "Ana",
    accessType: "ticketera",
    credits: 8,
    tiquetera: { endDate: new Date("2026-12-30T05:00:00Z"), totalUses: 8 },
    cortesia: { disponibles: 1 },
    save: vi.fn(async () => {}),
  };
  h.logAudit.mockClear();
});

describe("corregirCreditos", () => {
  it("restar nunca baja de 0 y deja el resumen pedido, sin tocar cortesía ni cobro", async () => {
    const { status, body } = await corregirCreditos({ ...base, creditos: 10 });
    expect(status).toBe(200);
    expect(h.state.user.credits).toBe(0);
    expect(h.state.user.cortesia).toEqual({ disponibles: 1 });
    const ev = h.logAudit.mock.calls[0][0];
    expect(ev.action).toBe("ADJUST_CREDITS");
    expect(ev.summary).toBe("Créditos: 8 → 0 (-8) · corrección: Carga por error");
    expect(ev.meta).toMatchObject({ before: 8, after: 0, delta: -8, venta: false, monto: 0, correccion: true, origen: "mcp" });
    expect(body.cambios.creditos).toEqual({ antes: 8, despues: 0, delta: -8 });
  });

  it("fijar deja el valor exacto y puede restaurar la vigencia", async () => {
    const { body } = await corregirCreditos({ ...base, modo: "fijar", creditos: 3, vigencia: new Date("2026-11-20T05:00:00Z") });
    expect(h.state.user.credits).toBe(3);
    expect(h.state.user.tiquetera.endDate.toISOString()).toBe("2026-11-20T05:00:00.000Z");
    expect(body.cambios.vigencia).toEqual({ antes: "2026-12-30", despues: "2026-11-20" });
    expect(h.logAudit.mock.calls[0][0].summary).toMatch(/vigencia: 2026-12-30 → 2026-11-20/);
  });

  it("simular no guarda ni audita", async () => {
    const { status, body } = await corregirCreditos({ ...base, simular: true });
    expect(status).toBe(200);
    expect(body.cambios.creditos.despues).toBe(0);
    expect(h.state.user.save).not.toHaveBeenCalled();
    expect(h.logAudit).not.toHaveBeenCalled();
    expect(h.state.user.credits).toBe(8);
  });

  it("rechaza a quien no es de tiquetera, motivo vacío y N inválido", async () => {
    h.state.user.accessType = "mensualidad";
    const r = await corregirCreditos(base);
    expect(r.status).toBe(400);
    expect(r.body.message).toMatch(/no es de tiquetera/);
    expect((await corregirCreditos({ ...base, motivo: "  " })).status).toBe(400);
    expect((await corregirCreditos({ ...base, creditos: -1 })).status).toBe(400);
    expect(h.state.user.save).not.toHaveBeenCalled();
  });
});
