import { describe, it, expect } from "vitest";
import {
  buscarProductos,
  stockDesdeMovimientos,
  validarMovimiento,
  resumenMovimiento,
  MAX_CANTIDAD,
} from "../lib/inventario.js";

const claves = (q) => buscarProductos(q).map((p) => p.clave);

describe("buscarProductos", () => {
  it("encuentra el magnesio por nombre, por 'cubo' y sin tildes ni mayúsculas", () => {
    expect(claves("magnesio")).toEqual(["magnesio"]);
    expect(claves("Magn")).toEqual(["magnesio"]);
    expect(claves("cubos")).toEqual(["magnesio"]);
    expect(claves("cubo de magnesio")).toEqual(["magnesio"]);
  });

  it("encuentra el cepillo", () => {
    expect(claves("cepillo")).toEqual(["cepillo"]);
    expect(claves("cepi")).toEqual(["cepillo"]);
  });

  it("con menos de 3 letras no sugiere nada (son comienzos de nombres de socios)", () => {
    expect(claves("ma")).toEqual([]);
    expect(claves("ce")).toEqual([]);
    expect(claves("")).toEqual([]);
  });

  it("un nombre de socio no dispara la tarjeta", () => {
    expect(claves("juan perez")).toEqual([]);
    expect(claves("maria@gmail.com")).toEqual([]);
  });
});

describe("stockDesdeMovimientos", () => {
  it("suma los delta por producto y trae todos los productos aunque no tengan movimientos", () => {
    expect(
      stockDesdeMovimientos([
        { producto: "magnesio", delta: 10 },
        { producto: "magnesio", delta: -2 },
        { producto: "magnesio", delta: -1 },
      ])
    ).toEqual({ magnesio: 7, cepillo: 0 });
  });

  it("ignora productos desconocidos y deltas basura", () => {
    expect(
      stockDesdeMovimientos([
        { producto: "zapatos", delta: 5 },
        { producto: "cepillo", delta: "3" },
        { producto: "cepillo", delta: 2 },
      ])
    ).toEqual({ magnesio: 0, cepillo: 2 });
  });
});

describe("validarMovimiento", () => {
  it("una venta resta lo vendido", () => {
    expect(validarMovimiento({ tipo: "venta", producto: "magnesio", cantidad: 2 }, 5)).toEqual({
      ok: true,
      delta: -2,
      cantidad: 2,
    });
  });

  it("no deja vender más de lo que hay: el stock nunca queda negativo", () => {
    const r = validarMovimiento({ tipo: "venta", producto: "magnesio", cantidad: 3 }, 2);
    expect(r.ok).toBe(false);
    expect(r.code).toBe("SIN_STOCK");
    expect(r.message).toContain("quedan 2");
  });

  it("sin stock el mensaje dice que no quedan", () => {
    const r = validarMovimiento({ tipo: "venta", producto: "cepillo", cantidad: 1 }, 0);
    expect(r.code).toBe("SIN_STOCK");
    expect(r.message).toContain("no quedan cepillos");
  });

  it("una llegada suma", () => {
    expect(validarMovimiento({ tipo: "entrada", producto: "cepillo", cantidad: 12 }, 0)).toEqual({
      ok: true,
      delta: 12,
      cantidad: 12,
    });
  });

  it.each([0, -1, 1.5, "abc", MAX_CANTIDAD + 1, undefined])("rechaza la cantidad %s", (cantidad) => {
    const r = validarMovimiento({ tipo: "entrada", producto: "magnesio", cantidad }, 0);
    expect(r.code).toBe("CANTIDAD_INVALIDA");
  });

  it("el ajuste calcula la diferencia con el sistema, para arriba o para abajo", () => {
    expect(validarMovimiento({ tipo: "ajuste", producto: "magnesio", conteo: 8 }, 10)).toEqual({
      ok: true,
      delta: -2,
      cantidad: 2,
    });
    expect(validarMovimiento({ tipo: "ajuste", producto: "magnesio", conteo: 0 }, -0)).toMatchObject({
      ok: false,
      code: "SIN_CAMBIO",
    });
    expect(validarMovimiento({ tipo: "ajuste", producto: "magnesio", conteo: 4 }, 1).delta).toBe(3);
  });

  it("el ajuste rechaza conteos negativos o no enteros", () => {
    expect(validarMovimiento({ tipo: "ajuste", producto: "magnesio", conteo: -1 }, 3).code).toBe("CONTEO_INVALIDO");
    expect(validarMovimiento({ tipo: "ajuste", producto: "magnesio", conteo: "" }, 3).code).toBe("CONTEO_INVALIDO");
  });

  it("rechaza producto o tipo desconocidos", () => {
    expect(validarMovimiento({ tipo: "venta", producto: "zapatos", cantidad: 1 }, 5).code).toBe("PRODUCTO_INVALIDO");
    expect(validarMovimiento({ tipo: "regalo", producto: "magnesio", cantidad: 1 }, 5).code).toBe("TIPO_INVALIDO");
  });
});

describe("resumenMovimiento", () => {
  it("singular y plural", () => {
    expect(resumenMovimiento({ tipo: "venta", producto: "magnesio", cantidad: 1 })).toBe("Vendió 1 cubo de magnesio");
    expect(resumenMovimiento({ tipo: "venta", producto: "cepillo", cantidad: 3 })).toBe("Vendió 3 cepillos");
    expect(resumenMovimiento({ tipo: "entrada", producto: "magnesio", cantidad: 20 })).toBe("Llegaron 20 cubos de magnesio");
  });

  it("el ajuste muestra con cuánto quedó y la diferencia con signo", () => {
    expect(resumenMovimiento({ tipo: "ajuste", producto: "cepillo", delta: -2, conteo: 5 })).toBe(
      "Ajuste de conteo de cepillos: quedan 5 (-2)"
    );
  });
});
