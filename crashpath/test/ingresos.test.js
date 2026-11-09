import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { PRECIOS, precioDia, precioTiquetera, precioMensualidad, pesos } from "../lib/precios.js";
import { rangoPeriodo, cobrosDeAuditoria, armarResumen } from "../lib/ingresos.js";
import { clasificarCheckin } from "../lib/cortesia.js";

describe("tarifas", () => {
  it("pase de día: $20.000 sin zapatos, $30.000 con zapatos", () => {
    expect(precioDia(false)).toBe(20000);
    expect(precioDia(true)).toBe(30000);
  });

  it("tiquetera: 8 entradas = $120.000, otra cantidad es proporcional ($15.000 c/u)", () => {
    expect(precioTiquetera(8)).toBe(120000);
    expect(precioTiquetera(1)).toBe(15000);
    expect(precioTiquetera(0)).toBe(0);
    expect(precioTiquetera("x")).toBe(0);
  });

  it("mensualidad: $120.000 por mes, $150.000 con pies de gato", () => {
    expect(precioMensualidad(1)).toBe(120000);
    expect(precioMensualidad(3, true)).toBe(450000);
    expect(precioMensualidad(0)).toBe(0);
  });

  it("pesos formatea en miles", () => {
    expect(pesos(30000)).toMatch(/^\$30[.,\s]?000$/);
  });

  it("los precios del landing dicen lo mismo que lib/precios.js", () => {
    const copy = fs.readFileSync(path.join(process.cwd(), "lib", "landingCopy.js"), "utf8");
    const miles = (n) => n.toLocaleString("es-CO");
    expect(copy).toContain(`$${miles(PRECIOS.DIA)}`);
    expect(copy).toContain(`$${miles(PRECIOS.DIA_ZAPATOS)}`);
    expect(copy).toContain(`$${miles(PRECIOS.TIQUETERA)}`);
    expect(copy).toContain(`$${miles(PRECIOS.MENSUALIDAD_ZAPATOS)}`);
  });
});

describe("clasificarCheckin con pases", () => {
  const socioMensual = { accessType: "mensualidad" };

  it("un pase de día no cuenta como mensualidad aunque el socio tenga una", () => {
    expect(clasificarCheckin(socioMensual, { esPaseDia: true })).toBe("dia");
  });

  it("el voluntario va a su propio cubo, sin ingreso", () => {
    expect(clasificarCheckin({ accessType: "ticketera" }, { esVoluntario: true })).toBe("voluntario");
  });

  it("la cortesía sigue mandando sobre todo lo demás", () => {
    expect(clasificarCheckin(socioMensual, { esCortesia: true, esPaseDia: true })).toBe("cortesia");
  });

  it("sin pase, el check-in normal sigue igual", () => {
    expect(clasificarCheckin({ accessType: "ticketera" }, {})).toBe("ticketera");
  });
});

describe("rangoPeriodo (horas de Bogotá, el servidor está en UTC)", () => {
  // Miércoles 11 nov 2026, 9 pm en Bogotá = jueves 12, 02:00Z.
  const AHORA = new Date("2026-11-12T02:00:00.000Z");

  it("hoy arranca a medianoche de Bogotá aunque en UTC ya sea mañana", () => {
    const r = rangoPeriodo("today", AHORA);
    expect(r.desde).toBe("2026-11-11");
    expect(r.start.toISOString()).toBe("2026-11-11T05:00:00.000Z");
  });

  it("la semana arranca el domingo", () => {
    expect(rangoPeriodo("week", AHORA).desde).toBe("2026-11-08");
  });

  it("el mes arranca el día 1", () => {
    expect(rangoPeriodo("month", AHORA).desde).toBe("2026-11-01");
  });

  it("el período anterior es de igual duración y termina justo antes", () => {
    const r = rangoPeriodo("week", AHORA);
    expect(r.prevEnd.getTime()).toBe(r.start.getTime() - 1);
    expect(r.prevEnd.getTime() - r.prevStart.getTime()).toBe(r.end.getTime() - r.start.getTime());
  });
});

describe("cobrosDeAuditoria", () => {
  const ev = (action, meta, extra = {}) => ({ action, meta, ts: "2026-11-11T15:00:00Z", userName: "Ana", ...extra });

  it("usa el monto guardado y no lo marca como estimado", () => {
    const [c] = cobrosDeAuditoria([ev("ADJUST_CREDITS", { delta: 8, venta: true, monto: 120000 })]);
    expect(c).toMatchObject({ tipo: "tiquetera", monto: 120000, estimado: false });
  });

  it("una corrección de saldo (monto 0) no suma", () => {
    expect(cobrosDeAuditoria([ev("ADJUST_CREDITS", { delta: 1, venta: false, monto: 0 })])).toEqual([]);
  });

  it("un ajuste viejo, sin monto, se estima por sus créditos y se marca", () => {
    const [c] = cobrosDeAuditoria([ev("ADJUST_CREDITS", { delta: 8 })]);
    expect(c).toMatchObject({ tipo: "tiquetera", monto: 120000, estimado: true });
  });

  it("restar créditos viejos no es un cobro", () => {
    expect(cobrosDeAuditoria([ev("ADJUST_CREDITS", { delta: -1 })])).toEqual([]);
  });

  it("renovación vieja: se estima por meses", () => {
    const [c] = cobrosDeAuditoria([ev("MENSUALIDAD_RENEW", { months: 2 })]);
    expect(c).toMatchObject({ tipo: "mensualidad", monto: 240000, estimado: true });
  });

  it("renovación nueva con zapatos usa su monto", () => {
    const [c] = cobrosDeAuditoria([ev("MENSUALIDAD_RENEW", { months: 1, zapatos: true, monto: 150000 })]);
    expect(c).toMatchObject({ monto: 150000, estimado: false });
  });

  it("cambio de modalidad: con créditos es tiquetera, sin ellos es mensualidad", () => {
    const [t] = cobrosDeAuditoria([ev("ACCESS_TYPE_CHANGED", { to: "ticketera", creditos: 8, monto: 120000 })]);
    const [m] = cobrosDeAuditoria([ev("ACCESS_TYPE_CHANGED", { to: "mensualidad", months: 1, monto: 120000 })]);
    expect(t.tipo).toBe("tiquetera");
    expect(m.tipo).toBe("mensualidad");
  });

  it("cambiar de modalidad sin cobrar (monto 0) o un cambio viejo a tiquetera no suma", () => {
    expect(cobrosDeAuditoria([ev("ACCESS_TYPE_CHANGED", { to: "ticketera", monto: 0 })])).toEqual([]);
    expect(cobrosDeAuditoria([ev("ACCESS_TYPE_CHANGED", { from: "mensualidad", to: "ticketera" })])).toEqual([]);
  });

  it("usuario creado con mensualidad cuenta; con tiquetera (0 créditos) no", () => {
    const [m] = cobrosDeAuditoria([ev("USER_CREATE", { accessType: "mensualidad", months: 1, monto: 120000 })]);
    expect(m.monto).toBe(120000);
    expect(cobrosDeAuditoria([ev("USER_CREATE", { accessType: "ticketera", monto: 0 })])).toEqual([]);
  });

  it("ignora acciones que no son cobros", () => {
    expect(cobrosDeAuditoria([ev("CHECKIN", { monto: 999 })])).toEqual([]);
  });
});

describe("armarResumen", () => {
  const AHORA = new Date("2026-11-11T20:00:00.000Z"); // miércoles 3 pm Bogotá
  const rango = rangoPeriodo("week", AHORA);
  const d = (iso) => new Date(iso);

  it("suma cada fuente en su tipo y el total es la suma de los tipos", () => {
    const r = armarResumen({
      rango,
      pases: [
        { ts: d("2026-11-09T18:00:00Z"), monto: 20000, conZapatos: false },
        { ts: d("2026-11-10T18:00:00Z"), monto: 30000, conZapatos: true },
      ],
      cobros: [{ ts: d("2026-11-10T19:00:00Z"), tipo: "tiquetera", monto: 120000, estimado: false }],
      ventas: [{ ts: d("2026-11-11T15:00:00Z"), total: 15000, producto: "magnesio" }],
    });
    expect(r.porTipo).toEqual({ dia: 50000, tiquetera: 120000, mensualidad: 0, inventario: 15000 });
    expect(r.total).toBe(185000);
    expect(r.pases).toEqual({ sinZapatos: 1, conZapatos: 1 });
  });

  it("separa lo estimado del resto", () => {
    const r = armarResumen({
      rango,
      cobros: [
        { ts: d("2026-11-10T19:00:00Z"), tipo: "mensualidad", monto: 120000, estimado: true },
        { ts: d("2026-11-10T19:00:00Z"), tipo: "mensualidad", monto: 120000, estimado: false },
      ],
    });
    expect(r.total).toBe(240000);
    expect(r.estimado).toBe(120000);
  });

  it("lo del período anterior no entra al total pero sirve para comparar", () => {
    const r = armarResumen({
      rango,
      pases: [
        // Mitad de semana: el período anterior dura lo mismo que lo corrido hasta
        // hoy (3,6 días), así que el jueves 5 cae dentro y el martes 3 no.
        { ts: d("2026-11-05T18:00:00Z"), monto: 20000, conZapatos: false },
        { ts: d("2026-11-10T18:00:00Z"), monto: 30000, conZapatos: true },
      ],
    });
    expect(r.total).toBe(30000);
    expect(r.previo).toBe(20000);
    expect(r.cambio).toBeCloseTo(50);
  });

  it("sin período anterior, el cambio es null (no un 100% inventado)", () => {
    expect(armarResumen({ rango }).cambio).toBeNull();
  });

  it("una venta a las 9 pm de Bogotá cae en su día y no en el siguiente de UTC", () => {
    const r = armarResumen({
      rango,
      ventas: [{ ts: d("2026-11-11T02:00:00Z"), total: 5000, producto: "magnesio" }], // martes 10, 9 pm Bogotá
    });
    expect(r.dias.find((x) => x.dia === "2026-11-10").total).toBe(5000);
    expect(r.dias.find((x) => x.dia === "2026-11-11").total).toBe(0);
  });

  it("lista todos los días del período, aunque estén en cero", () => {
    const r = armarResumen({ rango });
    expect(r.dias.map((x) => x.dia)).toEqual(["2026-11-08", "2026-11-09", "2026-11-10", "2026-11-11"]);
  });

  it("un monto en cero no suma ni crea ruido", () => {
    const r = armarResumen({ rango, pases: [{ ts: d("2026-11-10T18:00:00Z"), monto: 0, conZapatos: false }] });
    expect(r.total).toBe(0);
  });
});
