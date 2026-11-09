import { describe, it, expect, vi, beforeEach } from "vitest";

// Pase de día y entrada de voluntario (hacerCheckin) y cobros con monto
// (ajustarCreditos, renovarMensualidad), con el modelo simulado. Lo que se
// protege: el pase NO gasta crédito ni exige mensualidad, y cada cobro deja
// su monto en el AuditLog, que es de donde sale la caja.

const h = vi.hoisted(() => {
  const state = { user: null };
  return {
    state,
    User: {
      findOne: vi.fn(() => ({ lean: async () => state.user })),
      findById: vi.fn(async () => state.user),
      findOneAndUpdate: vi.fn(),
    },
    logAudit: vi.fn(async (e) => e),
  };
});

vi.mock("../models/User", () => ({ default: h.User }));
vi.mock("../lib/audit", () => ({ logAudit: h.logAudit }));
vi.mock("../lib/mongodb", () => ({ default: async () => {} }));

import { hacerCheckin, ajustarCreditos, renovarMensualidad, cancelarVisita } from "../lib/operaciones";

const actor = { email: "caja@x.co", name: "Caja", rol: "admin" };
const query = { _id: "u1" };

/** findOneAndUpdate devuelve el usuario ya actualizado (lo que hace Mongo con new:true). */
function conVisitaCreada(extra = {}) {
  // Mongoose devuelve una query encadenable (.lean()), no una promesa pelada.
  h.User.findOneAndUpdate.mockImplementation((_q, update) => {
    const visita = update.$push?.visits || { _id: "v1" };
    const doc = { ...h.state.user, visits: [{ _id: "v1", date: new Date(), ...visita, ...extra }] };
    return { lean: async () => doc };
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  h.state.user = { _id: "u1", name: "Ana", email: "ana@x.co", accessType: "ticketera", credits: 0, visits: [] };
});

describe("hacerCheckin con pase de día", () => {
  it("entra con 0 créditos: no hace falta sumar uno y restarlo", async () => {
    conVisitaCreada();
    const { status, body } = await hacerCheckin({ query, actor, pase: "dia" });

    expect(status).toBe(200);
    expect(body.monto).toBe(20000);
    // Ni el filtro exige créditos ni el update los descuenta.
    const [filtro, update] = h.User.findOneAndUpdate.mock.calls[0];
    expect(filtro.credits).toBeUndefined();
    expect(update.$inc).toBeUndefined();
  });

  it("sin zapatos cuesta $20.000 y con zapatos $30.000, y queda en la visita", async () => {
    conVisitaCreada();
    const sin = await hacerCheckin({ query, actor, pase: "dia", zapatos: false });
    const con = await hacerCheckin({ query, actor, pase: "dia", zapatos: true });

    expect(sin.body.monto).toBe(20000);
    expect(con.body.monto).toBe(30000);
    const visita = h.User.findOneAndUpdate.mock.calls[1][1].$push.visits;
    expect(visita).toMatchObject({ esPaseDia: true, conZapatos: true, monto: 30000, status: "checked_in" });
  });

  it("un socio con mensualidad vencida también puede pagar el día", async () => {
    h.state.user = { ...h.state.user, accessType: "mensualidad", mensualidad: { endDate: new Date("2020-01-01") } };
    conVisitaCreada();
    const { status } = await hacerCheckin({ query, actor, pase: "dia" });
    expect(status).toBe(200);
  });

  it("sin pase, la tiquetera sin créditos sigue sin poder entrar", async () => {
    const { status, body } = await hacerCheckin({ query, actor });
    expect(status).toBe(403);
    expect(body.code).toBe("NO_CREDITS");
  });

  it("el cobro queda en el AuditLog con su monto", async () => {
    conVisitaCreada();
    await hacerCheckin({ query, actor, pase: "dia", zapatos: true });
    const evento = h.logAudit.mock.calls[0][0];
    expect(evento.summary).toMatch(/Pase de día con zapatos · \$30\.000/);
    expect(evento.meta).toMatchObject({ pase: "dia", zapatos: true, monto: 30000 });
  });

  it("un tipo de entrada inventado se rechaza", async () => {
    const { status, body } = await hacerCheckin({ query, actor, pase: "gratis" });
    expect(status).toBe(400);
    expect(body.code).toBe("PASE_INVALIDO");
  });
});

describe("hacerCheckin como voluntario", () => {
  it("es gratis: no gasta crédito y no lleva monto", async () => {
    conVisitaCreada();
    const { status, body } = await hacerCheckin({ query, actor, pase: "voluntario" });

    expect(status).toBe(200);
    expect(body.monto).toBeUndefined();
    const [, update] = h.User.findOneAndUpdate.mock.calls[0];
    expect(update.$inc).toBeUndefined();
    expect(update.$push.visits).toMatchObject({ esVoluntario: true });
    expect(update.$push.visits.monto).toBeUndefined();
  });
});

describe("ajustarCreditos: venta vs corrección", () => {
  const usuario = () => ({
    _id: "u1",
    name: "Ana",
    accessType: "ticketera",
    credits: 0,
    tiquetera: {},
    cortesia: {},
    save: vi.fn(async () => {}),
  });

  it("una venta de 8 créditos cobra $120.000", async () => {
    h.state.user = usuario();
    const { status, body } = await ajustarCreditos({ userId: "u1", delta: 8, venta: true, actor });
    expect(status).toBe(200);
    expect(body.monto).toBe(120000);
    expect(h.logAudit.mock.calls[0][0].meta).toMatchObject({ venta: true, monto: 120000 });
  });

  it("una corrección no suma a la caja (monto 0, pero presente)", async () => {
    h.state.user = usuario();
    await ajustarCreditos({ userId: "u1", delta: 1, actor });
    expect(h.logAudit.mock.calls[0][0].meta).toMatchObject({ venta: false, monto: 0 });
  });

  it("una 'venta' que resta créditos no tiene sentido", async () => {
    const { status, body } = await ajustarCreditos({ userId: "u1", delta: -1, venta: true, actor });
    expect(status).toBe(400);
    expect(body.code).toBe("VENTA_SIN_CREDITOS");
  });
});

describe("renovarMensualidad guarda el monto", () => {
  const socio = () => ({
    _id: "u1",
    name: "Beto",
    accessType: "mensualidad",
    mensualidad: { endDate: new Date("2020-01-01"), renewals: [] },
    cortesia: {},
    save: vi.fn(async () => {}),
  });

  it("1 mes cuesta $120.000", async () => {
    h.state.user = socio();
    const { body } = await renovarMensualidad({ userId: "u1", months: 1, actor });
    expect(body.monto).toBe(120000);
    expect(h.logAudit.mock.calls[0][0].meta).toMatchObject({ months: 1, zapatos: false, monto: 120000 });
  });

  it("2 meses con pies de gato cuestan $300.000", async () => {
    h.state.user = socio();
    const { body } = await renovarMensualidad({ userId: "u1", months: 2, zapatos: true, actor });
    expect(body.monto).toBe(300000);
  });
});

describe("cancelarVisita de un pase", () => {
  it("no devuelve crédito aunque se pida reembolso: el pase no lo gastó", async () => {
    const visita = { _id: "v1", status: "checked_in", esPaseDia: true };
    h.state.user = {
      _id: "u1",
      name: "Ana",
      credits: 3,
      visits: { id: () => visita },
      save: vi.fn(async () => {}),
      toObject() {
        return this;
      },
    };
    const { body } = await cancelarVisita({ userId: "u1", visitId: "v1", refund: true, actor });
    expect(visita.status).toBe("cancelled");
    expect(body.credits).toBe(3);
  });
});
