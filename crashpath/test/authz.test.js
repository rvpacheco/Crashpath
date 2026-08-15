import { describe, it, expect, vi, beforeEach } from "vitest";

// El guardia habla con next-auth y con Mongo. Se mockean los dos para poder
// probar CADA camino de denegación sin levantar una base: los caminos que
// importan acá son justamente los que no se pueden reproducir a mano (Mongo
// caído, dos turnos con el mismo vencimiento, un turno revocado hace un
// segundo).
const getToken = vi.fn();
const findOne = vi.fn();
const dbConnect = vi.fn().mockResolvedValue(true);

vi.mock("next-auth/jwt", () => ({ getToken: (...a) => getToken(...a) }));
vi.mock("../lib/mongodb", () => ({ default: (...a) => dbConnect(...a) }));
vi.mock("../models/StaffGrant", () => ({
  default: { findOne: (...a) => findOne(...a) },
}));

const { resolverActor, requireAuth, verSensible } = await import("../lib/authz.js");
const { PERMISOS } = await import("../lib/permisos.js");

const ADMIN = "rvpacheco17@gmail.com";
const VOLUNTARIO = "voluntario@gmail.com";

/** El .lean() de mongoose devuelve una promesa; findOne se encadena. */
function encolarGrants(...resultados) {
  const cola = [...resultados];
  findOne.mockImplementation(() => {
    const valor = cola.shift();
    const chain = {
      lean: () => Promise.resolve(valor ?? null),
      sort: () => chain,
    };
    return chain;
  });
}

function tokenDe(email) {
  return { user: { email, name: "Quien Sea" }, sub: "google-123" };
}

/** Un res falso que registra lo que se le respondió. */
function fakeRes() {
  const res = { statusCode: null, body: null, headers: {} };
  res.status = (c) => {
    res.statusCode = c;
    return res;
  };
  res.json = (b) => {
    res.body = b;
    return res;
  };
  res.setHeader = (k, v) => {
    res.headers[k] = v;
  };
  return res;
}

const HOY_TARDE = () => new Date(Date.now() + 3 * 3600000);
const AYER = () => new Date(Date.now() - 26 * 3600000);

beforeEach(() => {
  vi.clearAllMocks();
  dbConnect.mockResolvedValue(true);
  encolarGrants(null);
});

describe("resolverActor: admin", () => {
  it("el admin de la lista entra sin tocar la base", async () => {
    getToken.mockResolvedValue(tokenDe(ADMIN));

    const actor = await resolverActor({});

    expect(actor.rol).toBe("admin");
    expect(actor.email).toBe(ADMIN);
    // Esta es la razón de tener la lista en código: si Mongo está caído,
    // seguimos pudiendo entrar.
    expect(dbConnect).not.toHaveBeenCalled();
    expect(findOne).not.toHaveBeenCalled();
  });

  it("reconoce al admin con mayúsculas y espacios en el email", async () => {
    getToken.mockResolvedValue({ user: { email: "  RVPacheco17@GMAIL.com  " } });
    expect((await resolverActor({})).rol).toBe("admin");
  });

  it("también lee el email de token.email (no solo de token.user)", async () => {
    getToken.mockResolvedValue({ email: ADMIN });
    expect((await resolverActor({})).rol).toBe("admin");
  });
});

describe("resolverActor: sin sesión", () => {
  it("sin token no hay rol", async () => {
    getToken.mockResolvedValue(null);
    const actor = await resolverActor({});
    expect(actor.rol).toBeNull();
    expect(actor.motivo).toBe("SIN_SESION");
    expect(dbConnect).not.toHaveBeenCalled();
  });

  it("un token sin email tampoco alcanza", async () => {
    getToken.mockResolvedValue({ sub: "google-123" });
    expect((await resolverActor({})).motivo).toBe("SIN_SESION");
  });
});

describe("resolverActor: voluntario", () => {
  it("con turno vigente es staff", async () => {
    getToken.mockResolvedValue(tokenDe(VOLUNTARIO));
    encolarGrants({ email: VOLUNTARIO, name: "Vito", vence: HOY_TARDE() });

    const actor = await resolverActor({});

    expect(actor.rol).toBe("staff");
    expect(actor.email).toBe(VOLUNTARIO);
    expect(actor.vence).toBeInstanceOf(Date);
  });

  it("la consulta de acceso filtra por vigencia, no por 'el último'", async () => {
    getToken.mockResolvedValue(tokenDe(VOLUNTARIO));
    encolarGrants({ email: VOLUNTARIO, vence: HOY_TARDE() });

    await resolverActor({});

    // Todos los turnos de un mismo día vencen en el MISMO milisegundo, así que
    // ordenar por fecha empata y Mongo desempata como quiere. El filtro tiene
    // que excluir revocados y vencidos en la propia consulta.
    const filtro = findOne.mock.calls[0][0];
    expect(filtro.email).toBe(VOLUNTARIO);
    expect(filtro.revocadoEn).toBeNull();
    expect(filtro.vence).toHaveProperty("$gte");
  });

  it("sin ningún turno: SIN_ROL, no TURNO_VENCIDO", async () => {
    getToken.mockResolvedValue(tokenDe(VOLUNTARIO));
    encolarGrants(null, null); // ni vigente ni histórico

    const actor = await resolverActor({});
    expect(actor.rol).toBeNull();
    expect(actor.motivo).toBe("SIN_ROL");
  });

  it("con turno vencido avisa TURNO_VENCIDO para poder explicarlo", async () => {
    getToken.mockResolvedValue(tokenDe(VOLUNTARIO));
    encolarGrants(null, { email: VOLUNTARIO, vence: AYER() });

    const actor = await resolverActor({});
    expect(actor.rol).toBeNull();
    expect(actor.motivo).toBe("TURNO_VENCIDO");
  });

  it("revocado y vuelto a otorgar el mismo día: el vigente manda", async () => {
    // Este es el caso que rompía: dos documentos con el vencimiento idéntico
    // al milisegundo, uno revocado. Antes el guardia leía "el último por
    // fecha" y podía quedarse con el revocado.
    getToken.mockResolvedValue(tokenDe(VOLUNTARIO));
    const mismoVence = HOY_TARDE();
    encolarGrants({ email: VOLUNTARIO, vence: mismoVence }); // el filtro ya excluyó el revocado

    expect((await resolverActor({})).rol).toBe("staff");
  });

  it("un admin nunca cae en la rama de voluntario aunque tenga turno", async () => {
    getToken.mockResolvedValue(tokenDe(ADMIN));
    encolarGrants({ email: ADMIN, vence: AYER() });

    expect((await resolverActor({})).rol).toBe("admin");
  });
});

describe("requireAuth", () => {
  it("deja pasar al admin y devuelve el actor listo para auditar", async () => {
    getToken.mockResolvedValue(tokenDe(ADMIN));
    const res = fakeRes();

    const actor = await requireAuth({}, res, PERMISOS.BORRAR_USUARIO);

    expect(actor.rol).toBe("admin");
    expect(actor.email).toBe(ADMIN);
    expect(res.statusCode).toBeNull();
  });

  it("401 sin sesión", async () => {
    getToken.mockResolvedValue(null);
    const res = fakeRes();

    await expect(requireAuth({}, res, PERMISOS.CHECKIN)).rejects.toThrow();
    expect(res.statusCode).toBe(401);
    expect(res.body.code).toBe("NO_AUTORIZADO");
  });

  it("401 con código propio si el turno venció, para que la UI lo explique", async () => {
    getToken.mockResolvedValue(tokenDe(VOLUNTARIO));
    encolarGrants(null, { email: VOLUNTARIO, vence: AYER() });
    const res = fakeRes();

    await expect(requireAuth({}, res, PERMISOS.CHECKIN)).rejects.toThrow();
    expect(res.statusCode).toBe(401);
    expect(res.body.code).toBe("TURNO_VENCIDO");
  });

  it("403 cuando el voluntario pide algo que no le toca", async () => {
    getToken.mockResolvedValue(tokenDe(VOLUNTARIO));
    encolarGrants({ email: VOLUNTARIO, vence: HOY_TARDE() });
    const res = fakeRes();

    await expect(requireAuth({}, res, PERMISOS.EXPORTAR)).rejects.toThrow();
    expect(res.statusCode).toBe(403);
    expect(res.body.code).toBe("SIN_PERMISO");
    expect(res.body.permiso).toBe(PERMISOS.EXPORTAR);
  });

  it("el voluntario sí pasa por lo suyo", async () => {
    getToken.mockResolvedValue(tokenDe(VOLUNTARIO));
    encolarGrants({ email: VOLUNTARIO, vence: HOY_TARDE() });
    const res = fakeRes();

    const actor = await requireAuth({}, res, PERMISOS.COBRAR);
    expect(actor.rol).toBe("staff");
    expect(res.statusCode).toBeNull();
  });

  it("si Mongo no responde DENIEGA con 503: un guardia que abre cuando no puede verificar no sirve", async () => {
    getToken.mockResolvedValue(tokenDe(VOLUNTARIO));
    dbConnect.mockRejectedValue(new Error("connection timed out"));
    const res = fakeRes();

    await expect(requireAuth({}, res, PERMISOS.CHECKIN)).rejects.toThrow();
    expect(res.statusCode).toBe(503);
    expect(res.body.code).toBe("AUTH_NO_DISPONIBLE");
  });

  it("Mongo caído NO deja afuera al admin", async () => {
    getToken.mockResolvedValue(tokenDe(ADMIN));
    dbConnect.mockRejectedValue(new Error("connection timed out"));
    const res = fakeRes();

    const actor = await requireAuth({}, res, PERMISOS.VER_AUDITORIA);
    expect(actor.rol).toBe("admin");
    expect(res.statusCode).toBeNull();
  });

  it("sin permiso pedido solo exige tener algún rol", async () => {
    getToken.mockResolvedValue(tokenDe(VOLUNTARIO));
    encolarGrants({ email: VOLUNTARIO, vence: HOY_TARDE() });
    const res = fakeRes();

    const actor = await requireAuth({}, res);
    expect(actor.rol).toBe("staff");
  });

  it("responde ANTES de lanzar, para que el catch del endpoint no escriba encima", async () => {
    // Los endpoints hacen `try { await requireAuth(...) } catch { return }`.
    // Si el guardia lanzara sin responder, el catch genérico mandaría un 500.
    getToken.mockResolvedValue(null);
    const res = fakeRes();

    await requireAuth({}, res, PERMISOS.CHECKIN).catch(() => {});
    expect(res.statusCode).toBe(401);
    expect(res.body).toBeTruthy();
  });
});

describe("verSensible", () => {
  it("solo el admin", () => {
    expect(verSensible({ rol: "admin" })).toBe(true);
    expect(verSensible({ rol: "staff" })).toBe(false);
    expect(verSensible({ rol: null })).toBe(false);
    expect(verSensible(null)).toBe(false);
    expect(verSensible(undefined)).toBe(false);
  });
});
