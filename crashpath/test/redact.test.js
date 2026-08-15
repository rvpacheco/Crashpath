import { describe, it, expect } from "vitest";
import User from "../models/User.js";
import {
  CAMPOS_SENSIBLES,
  CAMPOS_SENSIBLES_ANIDADOS,
  proyeccionSinSensibles,
  recortarCortesia,
  recortarUsuario,
  recortarUsuarios,
} from "../lib/redact.js";

/** Un socio con todos los campos llenos, para ver qué sobrevive al recorte. */
function socioCompleto() {
  return {
    _id: "u1",
    name: "Carol Cuello",
    email: "carol@example.com",
    documentType: "CC",
    documentNumber: "1098794340",
    phone: "3012343563",
    emergencyContactName: "Ana Cuello",
    emergencyContactPhone: "3009998877",
    epsName: "Sanitas",
    insuranceProvider: "Sura",
    insurancePolicyNumber: "POL-1",
    allergies: "penicilina",
    medicalConditions: "asma",
    bloodType: "O+",
    waiverSignatureUrl: "data:image/png;base64,AAAA",
    waiverSignatureText: "Carol Cuello",
    waiverTextSnapshot: "texto largo del waiver",
    waiverMeta: { ip: "1.2.3.4", userAgent: "Chrome" },
    accessType: "ticketera",
    credits: 5,
    waiverStatus: "signed",
    esMinor: false,
    cortesia: {
      disponibles: 0,
      vence: new Date("2026-09-01"),
      usos: [
        { guestName: "Invitado Uno", guestDocument: "111", adminEmail: "a@b.c" },
        { guestName: "Invitado Dos", guestDocument: "222", adminEmail: "a@b.c" },
      ],
    },
  };
}

describe("recortarUsuario", () => {
  it("le saca al voluntario todo lo sensible", () => {
    const recortado = recortarUsuario(socioCompleto(), { verSensible: false });
    for (const campo of CAMPOS_SENSIBLES) {
      expect(recortado, campo).not.toHaveProperty(campo);
    }
  });

  it("le deja lo que necesita para atender", () => {
    const recortado = recortarUsuario(socioCompleto(), { verSensible: false });
    expect(recortado.name).toBe("Carol Cuello");
    expect(recortado.email).toBe("carol@example.com");
    expect(recortado.accessType).toBe("ticketera");
    expect(recortado.credits).toBe(5);
    expect(recortado.waiverStatus).toBe("signed");
  });

  it("saca el documento de los invitados pero deja la cortesía usable", () => {
    const recortado = recortarUsuario(socioCompleto(), { verSensible: false });
    expect(recortado.cortesia.disponibles).toBe(0);
    expect(recortado.cortesia.usos).toHaveLength(2);
    expect(recortado.cortesia.usos[0].guestName).toBe("Invitado Uno");
    for (const uso of recortado.cortesia.usos) {
      expect(uso).not.toHaveProperty("guestDocument");
    }
  });

  it("al admin no le toca nada", () => {
    const original = socioCompleto();
    expect(recortarUsuario(original, { verSensible: true })).toBe(original);
  });

  it("no muta el original (el documento se sigue pudiendo guardar)", () => {
    const original = socioCompleto();
    recortarUsuario(original, { verSensible: false });
    expect(original.documentNumber).toBe("1098794340");
    expect(original.cortesia.usos[0].guestDocument).toBe("111");
  });

  it("por defecto recorta: si alguien olvida pasar el flag, no se filtra", () => {
    expect(recortarUsuario(socioCompleto())).not.toHaveProperty("documentNumber");
  });

  it("no revienta con nulos ni con usuarios a medio llenar", () => {
    expect(recortarUsuario(null)).toBeNull();
    expect(recortarUsuario(undefined)).toBeUndefined();
    expect(recortarUsuario({ name: "Pelao" }, { verSensible: false })).toEqual({ name: "Pelao" });
  });
});

describe("recortarCortesia", () => {
  // Cobrar créditos y renovar el mes devuelven la cortesía suelta, y ahí viaja
  // el historial de invitados con su documento. Es el caso fácil de olvidar
  // porque el endpoint "no devuelve el usuario".
  const cortesia = () => ({
    disponibles: 1,
    vence: new Date("2026-09-01"),
    usos: [{ guestName: "Invitado Uno", guestDocument: "111", visitId: "v1" }],
  });

  it("le saca el documento del invitado al voluntario", () => {
    const c = recortarCortesia(cortesia(), { verSensible: false });
    expect(c.usos[0]).not.toHaveProperty("guestDocument");
    expect(c.usos[0].guestName).toBe("Invitado Uno");
    expect(c.disponibles).toBe(1);
  });

  it("al admin no le toca nada", () => {
    const original = cortesia();
    expect(recortarCortesia(original, { verSensible: true })).toBe(original);
  });

  it("por defecto recorta y no muta el original", () => {
    const original = cortesia();
    expect(recortarCortesia(original).usos[0]).not.toHaveProperty("guestDocument");
    expect(original.usos[0].guestDocument).toBe("111");
  });

  it("no revienta sin cortesía ni sin usos", () => {
    expect(recortarCortesia(null)).toBeNull();
    expect(recortarCortesia({ disponibles: 0 })).toEqual({ disponibles: 0 });
  });
});

describe("recortarUsuarios", () => {
  it("recorta la lista entera", () => {
    const lista = recortarUsuarios([socioCompleto(), socioCompleto()], { verSensible: false });
    expect(lista).toHaveLength(2);
    for (const u of lista) expect(u).not.toHaveProperty("phone");
  });

  it("tolera lo que no sea lista", () => {
    expect(recortarUsuarios(null, { verSensible: false })).toBeNull();
  });
});

describe("proyeccionSinSensibles", () => {
  it("es toda de exclusión (Mongo no deja mezclar con inclusiones)", () => {
    const proj = proyeccionSinSensibles({ "visits.events": 0 });
    for (const valor of Object.values(proj)) expect(valor).toBe(0);
  });

  it("excluye también los anidados y respeta lo que le pasen", () => {
    const proj = proyeccionSinSensibles({ waiverTextSnapshot: 0, "visits.events": 0 });
    expect(proj).toHaveProperty("documentNumber", 0);
    expect(proj).toHaveProperty("cortesia.usos.guestDocument", 0);
    expect(proj).toHaveProperty("visits.events", 0);
  });
});

describe("el recorte no se queda atrás del modelo", () => {
  // Campos del User que un voluntario SÍ puede ver. Todo lo que no esté acá
  // ni en CAMPOS_SENSIBLES rompe el test: agregar un campo al modelo obliga a
  // decidir de qué lado va, en vez de que se filtre por omisión.
  const NO_SENSIBLES = [
    "_id",
    "__v",
    "id",
    "name",
    "email",
    "accessType",
    "credits",
    "tiquetera",
    "mensualidad",
    "cortesia", // se recorta por dentro, ver CAMPOS_SENSIBLES_ANIDADOS
    "visits",
    "waiverStatus",
    "waiverSignedAt",
    "waiverVersion",
    "waiverMethod",
    "sensitiveDataConsent", // es un booleano de consentimiento, no el dato
    "userType",
    "profileStatus",
    "esMinor", // el mostrador necesita saber si es menor de edad
    "createdAt",
    "updatedAt",
  ];

  it("todo campo del schema está clasificado", () => {
    const raiz = new Set(Object.keys(User.schema.paths).map((p) => p.split(".")[0]));
    const clasificados = new Set([...CAMPOS_SENSIBLES, ...NO_SENSIBLES]);
    const sinClasificar = [...raiz].filter((c) => !clasificados.has(c));

    expect(
      sinClasificar,
      `Campos nuevos en models/User.js sin clasificar. Si son sensibles, sumalos a ` +
        `CAMPOS_SENSIBLES en lib/redact.js; si no, a NO_SENSIBLES en este test.`
    ).toEqual([]);
  });

  it("no hay campos en la lista de sensibles que ya no existan en el modelo", () => {
    const raiz = new Set(Object.keys(User.schema.paths).map((p) => p.split(".")[0]));
    const fantasmas = CAMPOS_SENSIBLES.filter((c) => !raiz.has(c));
    expect(fantasmas).toEqual([]);
  });

  it("los anidados apuntan a un campo que existe", () => {
    for (const path of CAMPOS_SENSIBLES_ANIDADOS) {
      const raiz = path.split(".")[0];
      expect(Object.keys(User.schema.paths).some((p) => p.split(".")[0] === raiz)).toBe(true);
    }
  });
});
