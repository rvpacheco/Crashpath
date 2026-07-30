import { describe, it, expect } from "vitest";
import { maskName, maskEmail, maskPhone, maskDocument } from "../lib/privacy.js";

describe("maskName", () => {
  it("reduce a iniciales", () => {
    expect(maskName("Carol giuliana cuello rodriguez")).toBe("C. G. C. R.");
  });
  it("vacíos y no-strings devuelven cadena vacía", () => {
    expect(maskName("")).toBe("");
    expect(maskName(null)).toBe("");
    expect(maskName(undefined)).toBe("");
  });
});

describe("maskEmail", () => {
  it("conserva primera letra y dominio", () => {
    expect(maskEmail("perika81@hotmail.com")).toBe("p•••@hotmail.com");
  });
  it("sin @ conserva solo el primer carácter", () => {
    expect(maskEmail("loquesea")).toBe("l•••");
  });
  it("vacío devuelve cadena vacía", () => {
    expect(maskEmail("")).toBe("");
  });
});

describe("maskPhone", () => {
  it("conserva los últimos 4 dígitos", () => {
    expect(maskPhone("3012343563")).toBe("••• ••• 3563");
  });
  it("con 4 dígitos o menos oculta todo", () => {
    expect(maskPhone("1234")).toBe("••• •••");
  });
  it("vacío devuelve cadena vacía", () => {
    expect(maskPhone("")).toBe("");
  });
});

describe("maskDocument", () => {
  it("conserva los últimos 3 dígitos", () => {
    expect(maskDocument("1098794340")).toBe("•••••340");
  });
  it("conserva el prefijo de tipo de documento", () => {
    expect(maskDocument("CC 1098794340")).toBe("CC •••••340");
  });
  it("con 3 dígitos o menos oculta todo", () => {
    expect(maskDocument("123")).toBe("•••••");
  });
});
