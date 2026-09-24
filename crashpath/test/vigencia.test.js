import { describe, it, expect } from "vitest";
import { estadoAcceso, porVencer, normalizarTexto, puntajeBusqueda, buscarUsuarios } from "../lib/vigencia.js";

// 24/09/2026 3pm en Bogotá (20:00Z).
const AHORA = new Date("2026-09-24T20:00:00Z");
const dia = (ymd, hora = "12:00") => new Date(`${ymd}T${hora}:00-05:00`);

describe("estadoAcceso", () => {
  it("mensualidad que vence hoy (a primera hora) sigue vigente todo el día", () => {
    const u = { accessType: "mensualidad", mensualidad: { endDate: dia("2026-09-24", "00:30") } };
    expect(estadoAcceso(u, AHORA).vigente).toBe(true);
  });

  it("mensualidad que venció ayer no está vigente", () => {
    const u = { accessType: "mensualidad", mensualidad: { endDate: dia("2026-09-23", "23:00") } };
    expect(estadoAcceso(u, AHORA)).toMatchObject({ vigente: false, motivo: "mensualidad vencida" });
  });

  it("mensualidad sin fecha no está vigente", () => {
    expect(estadoAcceso({ accessType: "mensualidad", mensualidad: {} }, AHORA).vigente).toBe(false);
  });

  it("tiquetera con créditos y fecha futura está vigente", () => {
    const u = { accessType: "ticketera", credits: 3, tiquetera: { endDate: dia("2026-10-10") } };
    expect(estadoAcceso(u, AHORA)).toMatchObject({ tipo: "tiquetera", vigente: true, creditos: 3 });
  });

  it("tiquetera sin fecha NO cuenta como vigente aunque tenga créditos", () => {
    const u = { accessType: "ticketera", credits: 5, tiquetera: {} };
    expect(estadoAcceso(u, AHORA)).toMatchObject({ vigente: false, motivo: "tiquetera sin fecha de vencimiento" });
  });

  it("tiquetera sin créditos no está vigente", () => {
    const u = { accessType: "ticketera", credits: 0, tiquetera: { endDate: dia("2026-10-10") } };
    expect(estadoAcceso(u, AHORA)).toMatchObject({ vigente: false, motivo: "sin créditos" });
  });

  it("sin modalidad no está vigente", () => {
    expect(estadoAcceso({ accessType: null }, AHORA).vigente).toBe(false);
  });
});

describe("porVencer", () => {
  it("avisa si vence dentro de la ventana (último día incluido)", () => {
    const u = { accessType: "mensualidad", mensualidad: { endDate: dia("2026-10-01", "23:59") } };
    expect(porVencer(u, { dias: 7, ahora: AHORA })).toBe("vence el 2026-10-01");
    expect(porVencer(u, { dias: 6, ahora: AHORA })).toBeNull();
  });

  it("avisa si a la tiquetera le queda 1 crédito", () => {
    const u = { accessType: "ticketera", credits: 1, tiquetera: { endDate: dia("2026-11-30") } };
    expect(porVencer(u, { ahora: AHORA })).toBe("le queda 1 crédito");
  });

  it("no avisa a quien ya no está vigente", () => {
    const u = { accessType: "mensualidad", mensualidad: { endDate: dia("2026-09-20") } };
    expect(porVencer(u, { ahora: AHORA })).toBeNull();
  });
});

describe("búsqueda", () => {
  const juan = { name: "Juan Carlos Hernández", email: "jc@x.com", phone: "3001234567" };
  const mariana = { name: "Mariana Pérez", email: "mari@x.com" };
  const ana = { name: "Ana Pérez", email: "ana@x.com", documentNumber: "1020304050" };

  it("normaliza tildes y mayúsculas", () => {
    expect(normalizarTexto("  JOSÉ  Pérez-Ñúñez ")).toBe("jose perez nunez");
  });

  it("tolera nombres incompletos y sin tildes", () => {
    expect(puntajeBusqueda(juan, "juan hernandez")).toBeGreaterThan(0);
    expect(puntajeBusqueda(juan, "hern")).toBeGreaterThan(0);
    expect(puntajeBusqueda(juan, "juan perez")).toBe(0);
  });

  it("'ana' no trae a 'Mariana' (compara por comienzo de palabra)", () => {
    expect(buscarUsuarios([juan, mariana, ana], "ana")).toEqual([ana]);
  });

  it("el nombre exacto va primero", () => {
    const anaMaria = { name: "Ana María Pérez Gómez" };
    expect(buscarUsuarios([anaMaria, ana], "ana perez")[0]).toBe(ana);
  });

  it("encuentra por teléfono, documento y email", () => {
    expect(buscarUsuarios([juan, ana], "300 123")).toEqual([juan]);
    expect(buscarUsuarios([juan, ana], "10203040")).toEqual([ana]);
    expect(buscarUsuarios([juan, mariana], "mari@x")).toEqual([mariana]);
  });
});
