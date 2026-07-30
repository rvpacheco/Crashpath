import { describe, it, expect } from "vitest";
import {
  normalizeName,
  cellText,
  toDate,
  toInt,
  lev1,
  tokenMatch,
} from "../lib/importExcel.js";

/** Día calendario en Bogotá de un Date, para verificar sin depender de la TZ local. */
const bogotaDay = (d) => d.toLocaleDateString("en-CA", { timeZone: "America/Bogota" });

describe("toDate", () => {
  it("serial de Excel → día correcto en Bogotá (el bug del off-by-one)", () => {
    // 46065 = 12/02/2026 en el Excel real del gym
    expect(bogotaDay(toDate(46065))).toBe("2026-02-12");
  });
  it("celda con fórmula ({ formula, result })", () => {
    expect(bogotaDay(toDate({ formula: "=B2+30", result: 46095 }))).toBe("2026-03-14");
  });
  it("string dd/mm/yyyy", () => {
    expect(bogotaDay(toDate("12/02/2026"))).toBe("2026-02-12");
  });
  it("Date de exceljs (medianoche UTC) se corre a día Bogotá", () => {
    expect(bogotaDay(toDate(new Date("2026-02-12T00:00:00.000Z")))).toBe("2026-02-12");
  });
  it("basura devuelve null", () => {
    expect(toDate("basura")).toBeNull();
    expect(toDate(999999)).toBeNull(); // serial fuera de rango
    expect(toDate(null)).toBeNull();
    expect(toDate("")).toBeNull();
  });
});

describe("normalizeName", () => {
  it("quita tildes, baja a minúsculas y colapsa espacios", () => {
    expect(normalizeName("  JOSÉ  Pérez ")).toBe("jose perez");
  });
});

describe("cellText", () => {
  it("richText de exceljs", () => {
    expect(cellText({ richText: [{ text: "Ho" }, { text: "la" }] })).toBe("Hola");
  });
  it("números y nulos", () => {
    expect(cellText(5)).toBe("5");
    expect(cellText(null)).toBe("");
  });
});

describe("toInt", () => {
  it("acepta strings, fórmulas y rechaza basura", () => {
    expect(toInt("8")).toBe(8);
    expect(toInt({ result: 3 })).toBe(3);
    expect(toInt("abc")).toBeNull();
  });
});

describe("lev1 (tolerancia de 1 letra)", () => {
  it("errores de dedo reales del Excel del gym", () => {
    expect(lev1("stphany", "stephany")).toBe(true); // letra faltante
    expect(lev1("gonzales", "gonzalez")).toBe(true); // s/z
  });
  it("no inventa matches", () => {
    expect(lev1("abc", "xyz")).toBe(false);
    expect(lev1("juan", "juanes")).toBe(false); // 2 letras de diferencia
  });
});

describe("tokenMatch (nombre corto del Excel vs nombre completo de Google)", () => {
  it("todas las palabras del Excel presentes en el nombre del panel", () => {
    expect(tokenMatch("Jorge Ramirez", "Jorge Andrés Ramírez Gómez")).toBe(true);
    expect(tokenMatch("Stphany", "Stephany gonzalez reyes")).toBe(true);
  });
  it("no matchea si al Excel le sobran palabras que el panel no tiene", () => {
    expect(tokenMatch("Valeria Sobrina Fabian", "Fabián")).toBe(false);
  });
  it("nombre vacío no matchea nada", () => {
    expect(tokenMatch("", "cualquiera")).toBe(false);
  });
});
