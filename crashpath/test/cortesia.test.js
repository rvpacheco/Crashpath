import { describe, it, expect } from "vitest";
import {
  CORTESIAS_POR_CICLO,
  accesoEndDate,
  clasificarCheckin,
  esElegibleParaCortesia,
  estadoCortesia,
  labelCortesia,
  otorgarCortesia,
  quitarCortesia,
  sincronizarVencimiento,
} from "../lib/cortesia.js";

const AYER = new Date("2026-03-14T12:00:00.000Z");
const HOY = new Date("2026-03-15T12:00:00.000Z");
const MANANA = new Date("2026-03-16T12:00:00.000Z");

describe("accesoEndDate", () => {
  it("de mensualidad lee mensualidad.endDate", () => {
    const u = { accessType: "mensualidad", mensualidad: { endDate: MANANA }, tiquetera: { endDate: AYER } };
    expect(accesoEndDate(u)).toEqual(MANANA);
  });

  it("de tiquetera lee tiquetera.endDate", () => {
    const u = { accessType: "ticketera", tiquetera: { endDate: MANANA }, mensualidad: { endDate: AYER } };
    expect(accesoEndDate(u)).toEqual(MANANA);
  });

  it("sin fecha devuelve null (no rompe ni inventa)", () => {
    expect(accesoEndDate({ accessType: "ticketera" })).toBeNull();
    expect(accesoEndDate(null)).toBeNull();
  });
});

describe("estadoCortesia", () => {
  it("sin cortesía no está disponible", () => {
    expect(estadoCortesia({}, HOY).disponible).toBe(false);
    expect(estadoCortesia(null, HOY).disponible).toBe(false);
  });

  it("con saldo y sin vencer está disponible", () => {
    const u = { cortesia: { disponibles: 1, vence: MANANA } };
    expect(estadoCortesia(u, HOY).disponible).toBe(true);
  });

  it("vencida no se puede usar", () => {
    const u = { cortesia: { disponibles: 1, vence: AYER } };
    const st = estadoCortesia(u, HOY);
    expect(st.disponible).toBe(false);
    expect(st.vencida).toBe(true);
  });

  it("sin fecha de vencimiento sigue disponible (el panel avisa, no bloquea)", () => {
    const u = { cortesia: { disponibles: 1 } };
    expect(estadoCortesia(u, HOY).disponible).toBe(true);
  });

  it("gastar el último crédito NO quita la cortesía: ya está pagada", () => {
    const u = { accessType: "ticketera", credits: 0, cortesia: { disponibles: 1, vence: MANANA } };
    expect(estadoCortesia(u, HOY).disponible).toBe(true);
  });

  it("una cortesía ya usada no cuenta como vencida", () => {
    const u = { cortesia: { disponibles: 0, vence: AYER, usos: [{ guestName: "Ana" }] } };
    const st = estadoCortesia(u, HOY);
    expect(st.disponible).toBe(false);
    expect(st.vencida).toBe(false);
    expect(st.ultimoUso.guestName).toBe("Ana");
  });

  it("un saldo negativo por datos raros se lee como cero", () => {
    expect(estadoCortesia({ cortesia: { disponibles: -3 } }, HOY).disponibles).toBe(0);
  });
});

describe("otorgarCortesia", () => {
  it("deja el saldo en 1 y cuelga el vencimiento del acceso", () => {
    const u = {};
    otorgarCortesia(u, { vence: MANANA, ts: HOY });
    expect(u.cortesia.disponibles).toBe(CORTESIAS_POR_CICLO);
    expect(u.cortesia.vence).toEqual(MANANA);
    expect(u.cortesia.otorgadaEn).toEqual(HOY);
  });

  it("NO se acumula: renovar sin haberla usado la deja en 1", () => {
    const u = { cortesia: { disponibles: 1, vence: AYER } };
    otorgarCortesia(u, { vence: MANANA, ts: HOY });
    expect(u.cortesia.disponibles).toBe(1);
  });

  it("renovar revive una cortesía ya usada", () => {
    const u = { cortesia: { disponibles: 0, vence: AYER, usos: [{ guestName: "Ana" }] } };
    otorgarCortesia(u, { vence: MANANA, ts: HOY });
    expect(estadoCortesia(u, HOY).disponible).toBe(true);
  });

  it("NO borra el historial de invitados", () => {
    const u = { cortesia: { disponibles: 0, usos: [{ guestName: "Ana" }, { guestName: "Beto" }] } };
    otorgarCortesia(u, { vence: MANANA, ts: HOY });
    expect(u.cortesia.usos).toHaveLength(2);
  });

  it("sin fecha de vencimiento la guarda en null, no como fecha inválida", () => {
    const u = {};
    otorgarCortesia(u, { vence: null, ts: HOY });
    expect(u.cortesia.vence).toBeNull();
    expect(estadoCortesia(u, HOY).disponible).toBe(true);
  });
});

describe("quitarCortesia", () => {
  it("deja el saldo en cero sin tocar el historial", () => {
    const u = { cortesia: { disponibles: 1, vence: MANANA, usos: [{ guestName: "Ana" }] } };
    quitarCortesia(u);
    expect(estadoCortesia(u, HOY).disponible).toBe(false);
    expect(u.cortesia.usos).toHaveLength(1);
  });
});

describe("sincronizarVencimiento", () => {
  it("corre el vencimiento cuando todavía hay saldo", () => {
    const u = { cortesia: { disponibles: 1, vence: AYER } };
    sincronizarVencimiento(u, MANANA);
    expect(estadoCortesia(u, HOY).disponible).toBe(true);
  });

  it("no revive una cortesía ya usada al corregir fechas", () => {
    const u = { cortesia: { disponibles: 0, vence: AYER } };
    sincronizarVencimiento(u, MANANA);
    expect(u.cortesia.vence).toEqual(AYER);
    expect(estadoCortesia(u, HOY).disponible).toBe(false);
  });

  it("adelantar el vencimiento a una fecha pasada la invalida", () => {
    const u = { cortesia: { disponibles: 1, vence: MANANA } };
    sincronizarVencimiento(u, AYER);
    expect(estadoCortesia(u, HOY).vencida).toBe(true);
  });
});

/**
 * Reparto de arranque. Lo crítico acá es que sea idempotente: el botón del
 * panel se puede apretar dos veces y NO puede regalarle una segunda entrada a
 * quien ya usó la suya.
 */
describe("esElegibleParaCortesia", () => {
  const conMensualidad = (endDate, extra = {}) => ({
    accessType: "mensualidad", mensualidad: { endDate }, ...extra,
  });
  const conTiquetera = (credits, endDate, extra = {}) => ({
    accessType: "ticketera", credits, tiquetera: { endDate }, ...extra,
  });

  it("mensualidad vigente entra", () => {
    expect(esElegibleParaCortesia(conMensualidad(MANANA), HOY)).toBe(true);
  });

  it("mensualidad vencida no entra: nacería con la cortesía vencida", () => {
    expect(esElegibleParaCortesia(conMensualidad(AYER), HOY)).toBe(false);
  });

  it("tiquetera con créditos y vigente entra", () => {
    expect(esElegibleParaCortesia(conTiquetera(3, MANANA), HOY)).toBe(true);
  });

  it("tiquetera sin créditos no entra", () => {
    expect(esElegibleParaCortesia(conTiquetera(0, MANANA), HOY)).toBe(false);
  });

  it("tiquetera vencida no entra aunque le queden créditos", () => {
    expect(esElegibleParaCortesia(conTiquetera(3, AYER), HOY)).toBe(false);
  });

  it("tiquetera con créditos y sin fecha cargada entra", () => {
    expect(esElegibleParaCortesia({ accessType: "ticketera", credits: 2 }, HOY)).toBe(true);
  });

  it("quien ya tuvo cortesía no vuelve a entrar aunque la haya gastado", () => {
    const u = conMensualidad(MANANA, { cortesia: { disponibles: 0, otorgadaEn: AYER, usos: [{}] } });
    expect(esElegibleParaCortesia(u, HOY)).toBe(false);
  });

  it("quien ya la tiene disponible tampoco (no se duplica)", () => {
    const u = conMensualidad(MANANA, { cortesia: { disponibles: 1, otorgadaEn: AYER } });
    expect(esElegibleParaCortesia(u, HOY)).toBe(false);
  });

  it("correr el reparto dos veces no le devuelve la cortesía a nadie", () => {
    const u = conMensualidad(MANANA);
    expect(esElegibleParaCortesia(u, HOY)).toBe(true);
    otorgarCortesia(u, { vence: MANANA, ts: HOY });   // primera pasada
    quitarCortesia(u);                                 // el socio la usa
    expect(esElegibleParaCortesia(u, HOY)).toBe(false); // segunda pasada
  });

  it("los invitados y los usuarios sin modalidad quedan fuera", () => {
    expect(esElegibleParaCortesia({ userType: "walkin", accessType: null }, HOY)).toBe(false);
    expect(esElegibleParaCortesia({}, HOY)).toBe(false);
  });
});

/**
 * El panel multiplica los check-ins de tiquetera por $15.000 para estimar el
 * ingreso. Si un invitado gratis cae en ese cubo, el número miente. Estos
 * tests fijan esa frontera.
 */
describe("clasificarCheckin", () => {
  const socioTiquetera = { accessType: "ticketera", credits: 5 };
  const socioMensualidad = { accessType: "mensualidad" };
  const invitado = { userType: "walkin", accessType: null };

  it("la visita de cortesía es cortesía, no tiquetera", () => {
    expect(clasificarCheckin(invitado, { esCortesia: true })).toBe("cortesia");
  });

  it("manda la visita, no la modalidad: un socio que entra de invitado no paga", () => {
    // Un socio puede venir de invitado de otro en vez de gastar su crédito.
    expect(clasificarCheckin(socioTiquetera, { esCortesia: true })).toBe("cortesia");
    expect(clasificarCheckin(socioMensualidad, { esCortesia: true })).toBe("cortesia");
  });

  it("el socio de tiquetera en su visita normal sí cuenta como ingreso", () => {
    expect(clasificarCheckin(socioTiquetera, { esCortesia: false })).toBe("ticketera");
    expect(clasificarCheckin(socioTiquetera, {})).toBe("ticketera");
  });

  it("el de mensualidad va a su propio cubo", () => {
    expect(clasificarCheckin(socioMensualidad, {})).toBe("mensualidad");
  });

  it("sin modalidad y sin cortesía no se le inventa ingreso", () => {
    // El bug original: un `else` lo mandaba a tiquetera y sumaba $15.000.
    expect(clasificarCheckin(invitado, {})).toBe("otro");
    expect(clasificarCheckin({}, {})).toBe("otro");
    expect(clasificarCheckin(null, null)).toBe("otro");
  });
});

describe("labelCortesia", () => {
  it("distingue los cuatro estados", () => {
    expect(labelCortesia({ cortesia: { disponibles: 1, vence: MANANA } }, HOY)).toContain("disponible");
    expect(labelCortesia({ cortesia: { disponibles: 1, vence: AYER } }, HOY)).toContain("vencida");
    expect(labelCortesia({ cortesia: { disponibles: 0, usos: [{ guestName: "Ana" }] } }, HOY)).toContain("usada");
    expect(labelCortesia({}, HOY)).toContain("Sin cortesía");
  });
});
