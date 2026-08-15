import { describe, it, expect } from "vitest";
import {
  estadoGate,
  ACCION_LOGIN,
  ACCION_REINTENTAR,
  ACCION_INICIO,
} from "../lib/gateAdmin.js";

const ADMIN = { rol: "admin", permisos: ["ver_socios"] };
const STAFF = { rol: "staff", permisos: ["checkin"] };
const SIN_ROL = { rol: null, motivo: "SIN_ROL" };
const VENCIDO = { rol: null, motivo: "TURNO_VENCIDO" };
const SESION = { user: { email: "quien@sea.com" } };

describe("estadoGate", () => {
  it("mientras carga la sesión no ofrece nada todavía", () => {
    const g = estadoGate({ status: "loading", session: null, rolInfo: null });
    expect(g.texto).toContain("Cargando");
    expect(g.accion).toBeNull();
  });

  it("sin sesión ofrece iniciar sesión (el bug viejo: se quedaba en 'Cargando' para siempre)", () => {
    const g = estadoGate({ status: "unauthenticated", session: null, rolInfo: null });
    expect(g.accion).toBe(ACCION_LOGIN);
    expect(g.texto).toContain("iniciar sesión");
  });

  it("logueado pero sin saber el rol todavía, espera", () => {
    const g = estadoGate({ status: "authenticated", session: SESION, rolInfo: null });
    expect(g.texto).toContain("Verificando");
    expect(g.accion).toBeNull();
  });

  it("si no se pudo consultar el rol deja reintentar, no expulsa", () => {
    const g = estadoGate({
      status: "authenticated",
      session: SESION,
      rolInfo: null,
      rolError: true,
    });
    expect(g.accion).toBe(ACCION_REINTENTAR);
  });

  it("logueado sin rol: fuera del panel", () => {
    const g = estadoGate({ status: "authenticated", session: SESION, rolInfo: SIN_ROL });
    expect(g.accion).toBe(ACCION_INICIO);
    expect(g.texto).toContain("no tiene acceso");
  });

  it("turno vencido dice qué pasó, no un 'no autorizado' seco", () => {
    const g = estadoGate({ status: "authenticated", session: SESION, rolInfo: VENCIDO });
    expect(g.texto).toContain("turno de voluntario terminó");
    expect(g.accion).toBe(ACCION_INICIO);
  });

  it("admin y voluntario entran (null = mostrar el panel)", () => {
    expect(estadoGate({ status: "authenticated", session: SESION, rolInfo: ADMIN })).toBeNull();
    expect(estadoGate({ status: "authenticated", session: SESION, rolInfo: STAFF })).toBeNull();
  });

  it("el error de red no se come el caso de 'todavía cargando la sesión'", () => {
    const g = estadoGate({ status: "loading", session: null, rolInfo: null, rolError: true });
    expect(g.texto).toContain("Cargando");
  });

  it("no revienta si lo llaman sin argumentos", () => {
    expect(estadoGate()).toEqual({ texto: "Necesitás iniciar sesión para entrar al panel.", accion: ACCION_LOGIN });
  });
});
