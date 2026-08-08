import { describe, it, expect } from "vitest";
import {
  addMonthsToDay,
  mensualidadDayHint,
  parseDayEdge,
  todayBogotaDay,
} from "../lib/dates.js";

/**
 * El vencimiento de la mensualidad NO es cosmético: /api/admin/visits/register
 * bloquea el check-in con `endDate <= now`. Si el editor manual guardara la
 * fecha a medianoche (como hace tiquetera-dates, donde el vencimiento solo
 * informa), el socio quedaría afuera durante todo su último día pago.
 *
 * Estos tests fijan esa frontera.
 */
describe("parseDayEdge", () => {
  it("'start' da medianoche de Bogotá", () => {
    expect(parseDayEdge("2026-03-15", "start").toISOString()).toBe("2026-03-15T05:00:00.000Z");
  });

  it("'end' da el último milisegundo del día de Bogotá", () => {
    expect(parseDayEdge("2026-03-15", "end").toISOString()).toBe("2026-03-16T04:59:59.999Z");
  });

  it("el borde por defecto es 'start'", () => {
    expect(parseDayEdge("2026-03-15").toISOString()).toBe("2026-03-15T05:00:00.000Z");
  });

  it("distingue 'sin valor' (null) de 'formato inválido' (undefined)", () => {
    expect(parseDayEdge("")).toBeNull();
    expect(parseDayEdge(null)).toBeNull();
    expect(parseDayEdge(undefined)).toBeNull();
    expect(parseDayEdge("15/03/2026")).toBeUndefined();
    expect(parseDayEdge("2026-3-15")).toBeUndefined();
    expect(parseDayEdge("no-es-fecha")).toBeUndefined();
  });

  it("rechaza días que no existen en el calendario", () => {
    expect(parseDayEdge("2026-02-30")).toBeUndefined();
    expect(parseDayEdge("2026-13-01")).toBeUndefined();
  });

  it("acepta el 29 de febrero de un año bisiesto", () => {
    expect(parseDayEdge("2028-02-29", "end").toISOString()).toBe("2028-03-01T04:59:59.999Z");
  });

  it("tolera espacios alrededor", () => {
    expect(parseDayEdge("  2026-03-15  ", "start").toISOString()).toBe("2026-03-15T05:00:00.000Z");
  });
});

/** Réplica de la regla del servidor: `endDate > now` habilita el check-in. */
const puedeEntrar = (endDate, ahora) => new Date(endDate) > new Date(ahora);

describe("vencimiento inclusivo: el último día pago sigue siendo válido", () => {
  const vence = parseDayEdge("2026-03-15", "end");

  it("a las 8pm de Bogotá del día que vence todavía entra", () => {
    // 15-mar 20:00 Bogotá = 16-mar 01:00Z
    expect(puedeEntrar(vence, "2026-03-16T01:00:00.000Z")).toBe(true);
  });

  it("a las 6am de Bogotá del día que vence entra", () => {
    // 15-mar 06:00 Bogotá = 15-mar 11:00Z
    expect(puedeEntrar(vence, "2026-03-15T11:00:00.000Z")).toBe(true);
  });

  it("al día siguiente ya no entra", () => {
    // 16-mar 06:00 Bogotá = 16-mar 11:00Z
    expect(puedeEntrar(vence, "2026-03-16T11:00:00.000Z")).toBe(false);
  });

  it("la convención de medianoche sí lo dejaría afuera (el bug que se evita)", () => {
    const venceMedianoche = parseDayEdge("2026-03-15", "start");
    expect(puedeEntrar(venceMedianoche, "2026-03-15T11:00:00.000Z")).toBe(false);
  });
});

/**
 * Réplica de la validación del endpoint: se compara contra el valor efectivo
 * (el nuevo si vino, el guardado si no), no solo contra lo que mandó el form.
 */
function rangoValido({ nuevoInicio, nuevoFin, inicioGuardado, finGuardado }) {
  const start = nuevoInicio ?? inicioGuardado ?? null;
  const end = nuevoFin ?? finGuardado ?? null;
  if (start && end) return new Date(end) >= new Date(start);
  return true;
}

describe("validación de rango", () => {
  const inicio = parseDayEdge("2026-03-01", "start");
  const fin = parseDayEdge("2026-03-31", "end");

  it("inicio y fin el mismo día es válido (fin de día > medianoche)", () => {
    expect(
      rangoValido({
        nuevoInicio: parseDayEdge("2026-03-15", "start"),
        nuevoFin: parseDayEdge("2026-03-15", "end"),
      })
    ).toBe(true);
  });

  it("fin anterior al inicio se rechaza", () => {
    expect(rangoValido({ nuevoInicio: fin, nuevoFin: inicio })).toBe(false);
  });

  it("editar solo el fin se valida contra el inicio guardado", () => {
    expect(
      rangoValido({
        nuevoFin: parseDayEdge("2026-02-01", "end"),
        inicioGuardado: inicio,
      })
    ).toBe(false);
  });

  it("editar solo el inicio se valida contra el fin guardado", () => {
    expect(
      rangoValido({
        nuevoInicio: parseDayEdge("2026-12-01", "start"),
        finGuardado: fin,
      })
    ).toBe(false);
  });

  it("un usuario sin fechas previas no falla la validación", () => {
    expect(rangoValido({ nuevoInicio: inicio })).toBe(true);
  });
});

/**
 * Réplica del recálculo de `active`. El hook pre("save") del modelo solo apaga
 * la mensualidad cuando venció; nunca la reactiva. El endpoint tiene que
 * hacerlo explícito o el flag queda desfasado del vencimiento real.
 */
const calcularActive = (endDate, ahora) => !!endDate && new Date(endDate) > new Date(ahora);

describe("recálculo de active", () => {
  it("corregir a una fecha futura reactiva la mensualidad", () => {
    expect(calcularActive(parseDayEdge("2026-12-31", "end"), "2026-03-15T11:00:00.000Z")).toBe(true);
  });

  it("poner una fecha pasada la desactiva (cancelación anticipada)", () => {
    expect(calcularActive(parseDayEdge("2026-01-01", "end"), "2026-03-15T11:00:00.000Z")).toBe(false);
  });

  it("sin fecha de vencimiento queda inactiva", () => {
    expect(calcularActive(null, "2026-03-15T11:00:00.000Z")).toBe(false);
  });

  it("el día del vencimiento sigue activa", () => {
    expect(calcularActive(parseDayEdge("2026-03-15", "end"), "2026-03-15T23:00:00.000Z")).toBe(true);
  });
});

describe("addMonthsToDay (atajos +1 mes / +3 meses del modal)", () => {
  it("suma un mes", () => {
    expect(addMonthsToDay("2026-03-15", 1)).toBe("2026-04-15");
  });

  it("suma tres meses cruzando el año", () => {
    expect(addMonthsToDay("2026-11-15", 3)).toBe("2027-02-15");
  });

  // No clampea a fin de mes: desborda, igual que el setMonth de renovar.js.
  // Se fija acá para que los dos caminos (Renovar y el editor) no se separen.
  it("desborda igual que renovar.js: 31/ene + 1 mes = 03/mar", () => {
    expect(addMonthsToDay("2026-01-31", 1)).toBe("2026-03-03");
  });

  it("desborda igual que renovar.js: 30/nov + 3 meses = 02/mar", () => {
    expect(addMonthsToDay("2026-11-30", 3)).toBe("2027-03-02");
  });

  it("no corre el día por la zona del navegador", () => {
    // Con aritmética local esto se iría al 2026-06-30 en husos al oeste de UTC
    expect(addMonthsToDay("2026-06-01", 1)).toBe("2026-07-01");
  });
});

describe("mensualidadDayHint (aviso en vivo del modal)", () => {
  const hoy = "2026-03-15";

  it("una fecha pasada avisa que bloquea el check-in", () => {
    const h = mensualidadDayHint("2026-03-14", hoy);
    expect(h.ok).toBe(false);
    expect(h.text).toContain("no podrá hacer check-in");
  });

  it("hoy es válido y lo dice explícito", () => {
    const h = mensualidadDayHint(hoy, hoy);
    expect(h.ok).toBe(true);
    expect(h.text).toContain("puede entrar hoy");
  });

  it("mañana cuenta 1 día, en singular", () => {
    const h = mensualidadDayHint("2026-03-16", hoy);
    expect(h.ok).toBe(true);
    expect(h.text).toContain("1 día ");
  });

  it("cuenta los días bien cruzando un mes", () => {
    expect(mensualidadDayHint("2026-04-15", hoy).text).toContain("31 días");
  });

  it("sin fecha no muestra nada", () => {
    expect(mensualidadDayHint("", hoy)).toBeNull();
    expect(mensualidadDayHint(null, hoy)).toBeNull();
  });

  it("por defecto compara contra hoy en Bogotá", () => {
    expect(mensualidadDayHint(todayBogotaDay()).ok).toBe(true);
  });
});

describe("todayBogotaDay", () => {
  it("devuelve el formato YYYY-MM-DD que consume el input type=date", () => {
    expect(todayBogotaDay()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});
