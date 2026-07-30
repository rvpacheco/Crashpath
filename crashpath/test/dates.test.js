import { describe, it, expect } from "vitest";
import { dayRangeBogota } from "../lib/dates.js";

describe("dayRangeBogota", () => {
  it("toma 'YYYY-MM-DD' literal como día de Bogotá (sin corrimiento UTC)", () => {
    const r = dayRangeBogota("2026-07-07");
    expect(r.start.toISOString()).toBe("2026-07-07T05:00:00.000Z");
    expect(r.end.toISOString()).toBe("2026-07-08T04:59:59.999Z");
  });

  it("una hora nocturna de Bogotá cae en su día, no en el siguiente", () => {
    // 6-jul 9:00pm Bogotá = 7-jul 02:00Z → el día Bogotá sigue siendo 6-jul
    const r = dayRangeBogota(new Date("2026-07-07T02:00:00.000Z"));
    expect(r.start.toISOString()).toBe("2026-07-06T05:00:00.000Z");
  });

  it("sin argumento usa hoy y el rango dura exactamente un día", () => {
    const r = dayRangeBogota();
    expect(r.start).toBeInstanceOf(Date);
    expect(r.end.getTime() - r.start.getTime()).toBe(86400000 - 1);
  });

  it("fecha inválida devuelve null", () => {
    expect(dayRangeBogota("no-es-fecha")).toBeNull();
  });
});
