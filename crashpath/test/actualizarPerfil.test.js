import { describe, it, expect, vi, beforeEach } from "vitest";

// actualizarPerfil (lib/operaciones.js) con el modelo simulado: la comparten
// el formulario del panel y la herramienta editar_usuario del MCP.

const h = vi.hoisted(() => {
  const state = { user: null, existe: {} };
  return {
    state,
    User: {
      findById: vi.fn(async () => state.user),
      exists: vi.fn(async (q) => (q.email ? state.existe.email === q.email : state.existe.phone === q.phone)),
    },
    logAudit: vi.fn(async (e) => e),
  };
});

vi.mock("../models/User", () => ({ default: h.User }));
vi.mock("../lib/audit", () => ({ logAudit: h.logAudit }));
vi.mock("../lib/mongodb", () => ({ default: async () => {} }));

import { actualizarPerfil } from "../lib/operaciones";

const ID = "bbbbbbbbbbbbbbbbbbbbbbbb";
const actor = { email: "dueño@x.co", rol: "admin" };

beforeEach(() => {
  h.state.existe = {};
  h.state.user = {
    _id: ID,
    name: "Beto",
    email: "import_beto@crashpath.local",
    phone: "3001112233",
    save: vi.fn(async () => {}),
  };
  h.logAudit.mockClear();
});

describe("actualizarPerfil", () => {
  it("guarda solo lo que cambia y no borra campos vacíos", async () => {
    const { status, body } = await actualizarPerfil({
      userId: ID,
      datos: { name: "Beto", email: "  Beto@Gmail.com ", phone: "" },
      actor,
      origen: "mcp",
    });
    expect(status).toBe(200);
    expect(body.cambios).toEqual({ email: { antes: "import_beto@crashpath.local", despues: "beto@gmail.com" } });
    expect(h.state.user.email).toBe("beto@gmail.com");
    expect(h.state.user.phone).toBe("3001112233");
    expect(h.state.user.save).toHaveBeenCalled();
    expect(h.logAudit).toHaveBeenCalledWith(
      expect.objectContaining({ action: "UPDATE_PROFILE", meta: { fields: ["email"], origen: "mcp" } })
    );
  });

  it("simular no guarda ni audita", async () => {
    const { body } = await actualizarPerfil({ userId: ID, datos: { phone: "3009998877" }, actor, simular: true });
    expect(body.cambios.phone).toEqual({ antes: "3001112233", despues: "3009998877" });
    expect(h.state.user.phone).toBe("3001112233");
    expect(h.state.user.save).not.toHaveBeenCalled();
    expect(h.logAudit).not.toHaveBeenCalled();
  });

  it("sin cambios no guarda", async () => {
    const { body } = await actualizarPerfil({ userId: ID, datos: { name: "Beto" }, actor });
    expect(body.code).toBe("SIN_CAMBIOS");
    expect(h.state.user.save).not.toHaveBeenCalled();
  });

  it("rechaza email o teléfono de otra cuenta, también al simular", async () => {
    h.state.existe = { email: "ana@x.co", phone: "3000000000" };
    expect((await actualizarPerfil({ userId: ID, datos: { email: "ana@x.co" }, actor, simular: true })).status).toBe(409);
    expect((await actualizarPerfil({ userId: ID, datos: { phone: "3000000000" }, actor })).body.code).toBe("PHONE_IN_USE");
    expect(h.state.user.save).not.toHaveBeenCalled();
  });

  it("valida email y tipo de documento", async () => {
    expect((await actualizarPerfil({ userId: ID, datos: { email: "nope" }, actor })).body.message).toMatch(/Email inválido/);
    expect((await actualizarPerfil({ userId: ID, datos: { documentType: "dni" }, actor })).body.message).toMatch(/documento/);
  });

  it("404 si el socio no existe", async () => {
    h.state.user = null;
    expect((await actualizarPerfil({ userId: ID, datos: { name: "X" }, actor })).status).toBe(404);
  });
});
