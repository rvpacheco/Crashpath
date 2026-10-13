import { describe, it, expect } from "vitest";
import {
  PERMISOS,
  ROL_ADMIN,
  ROL_STAFF,
  permisosDe,
  puede,
  nombreRol,
} from "../lib/permisos.js";

describe("puede", () => {
  it("el admin puede todo", () => {
    for (const permiso of Object.values(PERMISOS)) {
      expect(puede(ROL_ADMIN, permiso), permiso).toBe(true);
    }
  });

  it("sin rol no puede nada", () => {
    for (const permiso of Object.values(PERMISOS)) {
      expect(puede(null, permiso), permiso).toBe(false);
      expect(puede(undefined, permiso), permiso).toBe(false);
      expect(puede("", permiso), permiso).toBe(false);
    }
  });

  it("un rol inventado no puede nada", () => {
    expect(puede("superadmin", PERMISOS.VER_SOCIOS)).toBe(false);
    expect(puede("staff ", PERMISOS.CHECKIN)).toBe(false); // ojo con el espacio
  });

  it("un permiso inventado no lo tiene nadie", () => {
    expect(puede(ROL_ADMIN, "hackear_todo")).toBe(false);
    expect(puede(ROL_ADMIN, null)).toBe(false);
  });
});

describe("qué puede el voluntario", () => {
  // Estas dos listas son el contrato del rol. Si alguien mueve un permiso de
  // lado sin querer, este test lo canta.
  const PUEDE = [
    PERMISOS.VER_SOCIOS,
    PERMISOS.CHECKIN,
    PERMISOS.COBRAR,
    PERMISOS.CORTESIA_USAR,
    PERMISOS.CREAR_USUARIO,
    PERMISOS.WAIVER_FIRMAR,
    PERMISOS.MOON,
  ];

  const NO_PUEDE = [
    PERMISOS.VER_SENSIBLE,
    PERMISOS.VER_INGRESOS,
    PERMISOS.VER_AUDITORIA,
    PERMISOS.EDITAR_PERFIL,
    PERMISOS.EDITAR_FECHAS,
    PERMISOS.CORTESIA_CORREGIR,
    PERMISOS.EXPORTAR,
    PERMISOS.IMPORTAR,
    PERMISOS.BORRAR_USUARIO,
    PERMISOS.GESTIONAR_STAFF,
    PERMISOS.INVENTARIO_GESTIONAR,
  ];

  it.each(PUEDE)("puede %s", (permiso) => {
    expect(puede(ROL_STAFF, permiso)).toBe(true);
  });

  it.each(NO_PUEDE)("NO puede %s", (permiso) => {
    expect(puede(ROL_STAFF, permiso)).toBe(false);
  });

  it("las dos listas cubren el catálogo entero", () => {
    // Un permiso nuevo sin clasificar rompe acá, que es el punto: obliga a
    // decidir si el voluntario lo tiene en vez de que se cuele.
    expect([...PUEDE, ...NO_PUEDE].sort()).toEqual(Object.values(PERMISOS).sort());
  });

  it("un permiso nuevo nace siendo solo de admin", () => {
    // No se puede agregar un permiso al catálogo desde el test, así que se
    // verifica la propiedad equivalente: staff es subconjunto estricto de
    // admin y el catálogo se deriva de PERMISOS.
    const admin = permisosDe(ROL_ADMIN);
    const staff = permisosDe(ROL_STAFF);
    expect(staff.every((p) => admin.includes(p))).toBe(true);
    expect(staff.length).toBeLessThan(admin.length);
    expect(admin.sort()).toEqual(Object.values(PERMISOS).sort());
  });
});

describe("permisosDe", () => {
  it("devuelve una copia, no la tabla interna", () => {
    const a = permisosDe(ROL_STAFF);
    a.push(PERMISOS.BORRAR_USUARIO);
    expect(puede(ROL_STAFF, PERMISOS.BORRAR_USUARIO)).toBe(false);
  });

  it("rol desconocido devuelve lista vacía", () => {
    expect(permisosDe("nadie")).toEqual([]);
    expect(permisosDe(null)).toEqual([]);
  });
});

describe("nombreRol", () => {
  it("traduce los roles y devuelve null si no hay", () => {
    expect(nombreRol(ROL_ADMIN)).toBe("Administrador");
    expect(nombreRol(ROL_STAFF)).toBe("Voluntario");
    expect(nombreRol(null)).toBeNull();
  });
});
