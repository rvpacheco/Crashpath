import { describe, it, expect } from "vitest";
import { finDelTurno, turnoVigente, estadoTurno, etiquetaTurno } from "../lib/staff.js";
import { esAdminEmail, normalizarEmail } from "../lib/roles.js";

describe("finDelTurno", () => {
  it("vence a las 23:59:59.999 de Bogotá, que son las 04:59:59.999Z del día siguiente", () => {
    expect(finDelTurno("2026-08-15").toISOString()).toBe("2026-08-16T04:59:59.999Z");
  });

  it("el turno cubre todo el día de Bogotá, incluida la noche", () => {
    const vence = finDelTurno("2026-08-15");
    // 10 pm de Bogotá = 03:00Z del 16. El server está en UTC y ya cambió de
    // día; el voluntario tiene que seguir pudiendo cerrar el muro.
    const diezDeLaNoche = new Date("2026-08-16T03:00:00.000Z");
    expect(vence >= diezDeLaNoche).toBe(true);
  });

  it("no se pasa al día siguiente en Bogotá", () => {
    const vence = finDelTurno("2026-08-15");
    const medianocheYUnMinuto = new Date("2026-08-16T05:01:00.000Z");
    expect(vence < medianocheYUnMinuto).toBe(true);
  });

  it("un día inválido no otorga turno eterno: devuelve undefined", () => {
    expect(finDelTurno("2026-02-30")).toBeUndefined();
    expect(finDelTurno("mañana")).toBeUndefined();
  });
});

describe("turnoVigente", () => {
  const AHORA = new Date("2026-08-15T18:00:00.000Z"); // 1 pm en Bogotá

  it("vale mientras no venza", () => {
    expect(turnoVigente({ vence: new Date("2026-08-16T04:59:59.999Z") }, AHORA)).toBe(true);
  });

  it("no vale un minuto después de vencer", () => {
    expect(turnoVigente({ vence: new Date("2026-08-15T17:59:00.000Z") }, AHORA)).toBe(false);
  });

  it("revocado no vale aunque la fecha todavía dé", () => {
    const grant = {
      vence: new Date("2026-08-16T04:59:59.999Z"),
      revocadoEn: new Date("2026-08-15T17:00:00.000Z"),
    };
    expect(turnoVigente(grant, AHORA)).toBe(false);
  });

  it("sin fecha se asume vencido, nunca eterno", () => {
    expect(turnoVigente({}, AHORA)).toBe(false);
    expect(turnoVigente({ vence: null }, AHORA)).toBe(false);
    expect(turnoVigente({ vence: "cualquier cosa" }, AHORA)).toBe(false);
  });

  it("sin turno no hay acceso", () => {
    expect(turnoVigente(null, AHORA)).toBe(false);
    expect(turnoVigente(undefined, AHORA)).toBe(false);
  });

  it("el borde exacto todavía cuenta (vencimiento inclusivo)", () => {
    const vence = new Date("2026-08-15T18:00:00.000Z");
    expect(turnoVigente({ vence }, AHORA)).toBe(true);
  });
});

describe("estadoTurno", () => {
  const AHORA = new Date("2026-08-15T18:00:00.000Z");

  it("distingue vigente, vencido y revocado", () => {
    expect(estadoTurno({ vence: new Date("2026-08-16T04:00:00Z") }, AHORA)).toBe("vigente");
    expect(estadoTurno({ vence: new Date("2026-08-14T04:00:00Z") }, AHORA)).toBe("vencido");
    expect(
      estadoTurno({ vence: new Date("2026-08-16T04:00:00Z"), revocadoEn: AHORA }, AHORA)
    ).toBe("revocado");
    expect(estadoTurno(null, AHORA)).toBe("ninguno");
  });
});

describe("etiquetaTurno", () => {
  it("muestra la hora de Bogotá, no la del server", () => {
    // 04:59:59.999Z ya es el día siguiente en UTC pero sigue siendo el mismo
    // día a las 11:59 pm en Bogotá.
    expect(etiquetaTurno(new Date("2026-08-16T04:59:59.999Z"))).toContain("11:59");
  });

  it("no inventa hora si no hay fecha", () => {
    expect(etiquetaTurno(null)).toBe("Turno de voluntario");
    expect(etiquetaTurno("cualquier cosa")).toBe("Turno de voluntario");
  });
});

describe("esAdminEmail", () => {
  it("reconoce a un admin sin importar mayúsculas ni espacios", () => {
    expect(esAdminEmail("  RVPacheco17@Gmail.com ")).toBe(true);
  });

  it("no deja pasar a nadie más", () => {
    expect(esAdminEmail("voluntario@gmail.com")).toBe(false);
    expect(esAdminEmail("")).toBe(false);
    expect(esAdminEmail(null)).toBe(false);
    expect(esAdminEmail(undefined)).toBe(false);
  });

  it("normalizarEmail no revienta con basura", () => {
    expect(normalizarEmail(null)).toBe("");
    expect(normalizarEmail(123)).toBe("123");
  });
});
