import { describe, it, expect, vi, beforeEach } from "vitest";

// Acompañantes: un socio de tiquetera entra con otras personas y se descuentan
// de su saldo (hacerCheckin con `acompanantes`, o descontarCreditos después).

const h = vi.hoisted(() => {
  const state = { user: null, updated: null };
  const lean = (v) => ({ lean: async () => v });
  return {
    state,
    User: {
      findOne: vi.fn(() => lean(state.user)),
      findById: vi.fn(() => lean(state.user)),
      findOneAndUpdate: vi.fn(() => lean(state.updated)),
    },
    logAudit: vi.fn(async (e) => e),
  };
});

vi.mock("../models/User", () => ({ default: h.User }));
vi.mock("../lib/audit", () => ({ logAudit: h.logAudit }));
vi.mock("../lib/mongodb", () => ({ default: async () => {} }));

import { hacerCheckin, descontarCreditos } from "../lib/operaciones";

const ID = "aaaaaaaaaaaaaaaaaaaaaaaa";
const actor = { email: "fabian@x.co", rol: "admin" };

const tiquetera = (credits) => ({ _id: ID, name: "Laura", accessType: "ticketera", credits, visits: [] });

beforeEach(() => {
  h.state.user = tiquetera(8);
  h.state.updated = { ...tiquetera(3), visits: [{ _id: "v1", date: new Date() }] };
  h.User.findOneAndUpdate.mockClear();
  h.logAudit.mockClear();
});

describe("hacerCheckin con acompañantes", () => {
  it("descuenta 1 + acompañantes en un solo golpe atómico", async () => {
    const { status, body } = await hacerCheckin({ query: { _id: ID }, actor, acompanantes: 4 });
    expect(status).toBe(200);
    expect(body.credits).toBe(3);
    const [filtro, update] = h.User.findOneAndUpdate.mock.calls[0];
    expect(update.$inc).toEqual({ credits: -5 });
    expect(filtro.credits).toEqual({ $gte: 5 });
    expect(h.logAudit.mock.calls[0][0].summary).toMatch(/\+ 4 acompañantes \(-5 créditos/);
    expect(h.logAudit.mock.calls[0][0].meta.acompanantes).toBe(4);
  });

  it("sin acompañantes sigue descontando 1", async () => {
    await hacerCheckin({ query: { _id: ID }, actor });
    expect(h.User.findOneAndUpdate.mock.calls[0][1].$inc).toEqual({ credits: -1 });
  });

  it("rechaza si el saldo no alcanza, sin tocar la base", async () => {
    h.state.user = tiquetera(3);
    const { status, body } = await hacerCheckin({ query: { _id: ID }, actor, acompanantes: 4 });
    expect(status).toBe(409);
    expect(body.code).toBe("CREDITOS_INSUFICIENTES");
    expect(h.User.findOneAndUpdate).not.toHaveBeenCalled();
  });

  it("rechaza cantidades inválidas", async () => {
    for (const n of [-1, 1.5, 11, "x"]) {
      const { status, body } = await hacerCheckin({ query: { _id: ID }, actor, acompanantes: n });
      expect(status, String(n)).toBe(400);
      expect(body.code).toBe("ACOMPANANTES_INVALIDOS");
    }
  });

  it("no aplica a mensualidad ni a pase de día", async () => {
    h.state.user = { _id: ID, name: "Ana", accessType: "mensualidad", mensualidad: { endDate: new Date(Date.now() + 86400000) }, visits: [] };
    const m = await hacerCheckin({ query: { _id: ID }, actor, acompanantes: 2 });
    expect(m.status).toBe(400);
    expect(m.body.code).toBe("ACOMPANANTES_SIN_TIQUETERA");

    h.state.user = tiquetera(8);
    const d = await hacerCheckin({ query: { _id: ID }, actor, pase: "dia", acompanantes: 2 });
    expect(d.status).toBe(400);
  });
});

describe("descontarCreditos", () => {
  it("descuenta, no suma a la caja y deja el motivo en el historial", async () => {
    h.state.updated = tiquetera(3);
    const { status, body } = await descontarCreditos({ userId: ID, cantidad: 4, motivo: "hijos", actor });
    expect(status).toBe(200);
    expect(body.credits).toBe(3);
    const [filtro, update] = h.User.findOneAndUpdate.mock.calls[0];
    expect(update.$inc).toEqual({ credits: -4 });
    expect(filtro.credits).toEqual({ $gte: 4 });
    const ev = h.logAudit.mock.calls[0][0];
    expect(ev.action).toBe("ADJUST_CREDITS");
    expect(ev.meta).toMatchObject({ before: 8, after: 3, delta: -4, venta: false, monto: 0, acompanantes: true, motivo: "hijos" });
  });

  it("no baja de 0: si no alcanza responde 409 y no escribe", async () => {
    h.state.user = tiquetera(2);
    const { status, body } = await descontarCreditos({ userId: ID, cantidad: 3, actor });
    expect(status).toBe(409);
    expect(body.code).toBe("CREDITOS_INSUFICIENTES");
    expect(h.User.findOneAndUpdate).not.toHaveBeenCalled();
  });

  it("si el saldo cambió entre la lectura y la escritura, no descuenta", async () => {
    h.state.updated = null;
    const { status } = await descontarCreditos({ userId: ID, cantidad: 2, actor });
    expect(status).toBe(409);
    expect(h.logAudit).not.toHaveBeenCalled();
  });

  it("valida cantidad y modalidad", async () => {
    for (const n of [0, -1, 1.5, 11, NaN]) {
      expect((await descontarCreditos({ userId: ID, cantidad: n, actor })).status, String(n)).toBe(400);
    }
    h.state.user = { _id: ID, name: "Ana", accessType: "mensualidad" };
    const r = await descontarCreditos({ userId: ID, cantidad: 1, actor });
    expect(r.status).toBe(400);
    expect(r.body.code).toBe("NO_ES_TIQUETERA");
  });
});
