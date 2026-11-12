import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { PERMISOS, ROL_STAFF, ROL_ADMIN, puede } from "../lib/permisos.js";

// Este test lee el código de los endpoints. Es el guardarraíl del rol: cuando
// alguien agregue un endpoint nuevo bajo /api/admin y se olvide del guardia,
// o le ponga el permiso equivocado, falla acá y no en el mostrador un sábado.

const RAIZ = path.join(process.cwd(), "pages", "api", "admin");

/**
 * Qué permiso exige cada endpoint. Esta tabla ES la decisión de diseño: leerla
 * de arriba a abajo tiene que contar qué puede hacer un voluntario.
 */
const ESPERADO = {
  "adjust-credits.js": PERMISOS.COBRAR,
  "audit.js": PERMISOS.VER_AUDITORIA,
  "descontar-creditos.js": PERMISOS.CHECKIN,
  "checkins.js": PERMISOS.CHECKIN,
  "export-xlsx.js": PERMISOS.EXPORTAR,
  "import-xlsx.js": PERMISOS.IMPORTAR,
  // Vender es cobrar. Llegadas y ajustes los frena el propio endpoint con
  // INVENTARIO_GESTIONAR, que el voluntario no tiene (test/permisos.test.js).
  "inventario/index.js": PERMISOS.COBRAR,
  "ingresos.js": PERMISOS.VER_INGRESOS,
  "users.js": PERMISOS.VER_SOCIOS,
  "cortesia/set.js": PERMISOS.CORTESIA_CORREGIR,
  "cortesia/usar.js": PERMISOS.CORTESIA_USAR,
  "mensualidad/renovar.js": PERMISOS.COBRAR,
  "moon/cancel.js": PERMISOS.MOON,
  "moon/reservations.js": PERMISOS.MOON,
  "moon/reserve.js": PERMISOS.MOON,
  "staff/index.js": PERMISOS.GESTIONAR_STAFF,
  "staff/revocar.js": PERMISOS.GESTIONAR_STAFF,
  "users/[id].js": PERMISOS.VER_SOCIOS,
  "users/[id]/delete.js": PERMISOS.BORRAR_USUARIO,
  "users/[id]/visits.js": PERMISOS.VER_SOCIOS,
  "users/create.js": PERMISOS.CREAR_USUARIO,
  "users/mensualidad-dates.js": PERMISOS.EDITAR_FECHAS,
  "users/set-access-type.js": PERMISOS.COBRAR,
  "users/tiquetera-dates.js": PERMISOS.EDITAR_FECHAS,
  "users/update-profile.js": PERMISOS.EDITAR_PERFIL,
  "visits/[id].js": PERMISOS.CHECKIN,
  "visits/cancel.js": PERMISOS.CHECKIN,
  "visits/checkin.js": PERMISOS.CHECKIN,
  "visits/register.js": PERMISOS.CHECKIN,
  "waiver/pdf.js": PERMISOS.VER_SENSIBLE,
  "waiver/sign.js": PERMISOS.WAIVER_FIRMAR,
};

function listarEndpoints(dir = RAIZ, prefijo = "") {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entrada) => {
    const rel = prefijo ? `${prefijo}/${entrada.name}` : entrada.name;
    if (entrada.isDirectory()) return listarEndpoints(path.join(dir, entrada.name), rel);
    return entrada.name.endsWith(".js") ? [rel] : [];
  });
}

const endpoints = listarEndpoints();
const leer = (rel) => fs.readFileSync(path.join(RAIZ, rel), "utf8");

/** El permiso que el archivo realmente exige, o null si no llama al guardia. */
function permisoDe(rel) {
  const m = leer(rel).match(/requireAuth\(\s*req,\s*res,\s*PERMISOS\.([A-Z_]+)\s*\)/);
  return m ? PERMISOS[m[1]] ?? `DESCONOCIDO:${m[1]}` : null;
}

describe("todos los endpoints de /api/admin tienen guardia", () => {
  it("encontró los endpoints (si esto falla, la ruta del test está mal)", () => {
    expect(endpoints.length).toBeGreaterThan(20);
  });

  it.each(endpoints)("%s llama a requireAuth", (rel) => {
    expect(leer(rel)).toMatch(/requireAuth\(/);
  });

  it.each(endpoints)("%s exige el permiso que le corresponde", (rel) => {
    expect(
      ESPERADO,
      `Endpoint nuevo sin clasificar: agregá "${rel}" a ESPERADO con el permiso que le toca.`
    ).toHaveProperty(rel);
    expect(permisoDe(rel)).toBe(ESPERADO[rel]);
  });

  it("la tabla no tiene endpoints fantasma", () => {
    const fantasmas = Object.keys(ESPERADO).filter((rel) => !endpoints.includes(rel));
    expect(fantasmas).toEqual([]);
  });
});

describe("no quedan guardias viejos", () => {
  // Antes convivían tres mecanismos y dos leían isAdmin CACHEADO en el JWT, así
  // que sacar a alguien de la lista de admins no le quitaba el acceso hasta que
  // expirara su token. Que no vuelvan.
  const PROHIBIDO = [
    [/isAdminRequest/, "isAdminRequest (el guardia viejo)"],
    [/token\??\.isAdmin/, "token.isAdmin (viene cacheado del login)"],
    [/session\??\.isAdmin/, "session.isAdmin (viene cacheado del login)"],
    [/getServerSession/, "getServerSession (usa el JWT, no la base)"],
  ];

  it.each(endpoints)("%s no usa mecanismos cacheados", (rel) => {
    const src = leer(rel);
    for (const [re, nombre] of PROHIBIDO) {
      expect(re.test(src), `${rel} todavía usa ${nombre}`).toBe(false);
    }
  });
});

describe("qué endpoints alcanza un voluntario", () => {
  const paraRol = (rol) =>
    endpoints.filter((rel) => puede(rol, ESPERADO[rel])).sort();

  it("el admin llega a todos", () => {
    expect(paraRol(ROL_ADMIN).length).toBe(endpoints.length);
  });

  it("el voluntario llega exactamente a los del mostrador", () => {
    expect(paraRol(ROL_STAFF)).toEqual(
      [
        "adjust-credits.js",
        "checkins.js",
        "cortesia/usar.js",
        "descontar-creditos.js",
        "inventario/index.js",
        "mensualidad/renovar.js",
        "moon/cancel.js",
        "moon/reservations.js",
        "moon/reserve.js",
        "users.js",
        "users/[id].js",
        "users/[id]/visits.js",
        "users/create.js",
        "users/set-access-type.js",
        "visits/[id].js",
        "visits/cancel.js",
        "visits/checkin.js",
        "visits/register.js",
        "waiver/sign.js",
      ].sort()
    );
  });

  it.each([
    "users/[id]/delete.js",
    "export-xlsx.js",
    "import-xlsx.js",
    "audit.js",
    "waiver/pdf.js",
    "users/update-profile.js",
    "users/mensualidad-dates.js",
    "users/tiquetera-dates.js",
    "cortesia/set.js",
    "staff/index.js",
    "staff/revocar.js",
  ])("el voluntario NO alcanza %s", (rel) => {
    expect(puede(ROL_STAFF, ESPERADO[rel])).toBe(false);
  });
});

describe("los endpoints que devuelven datos del socio los recortan", () => {
  // Un endpoint que el voluntario puede llamar y devuelve el documento del
  // usuario tiene que pasarlo por lib/redact.js. El bug clásico es recortar la
  // lista y olvidarse de la respuesta de "guardar", que devuelve el user entero.
  const DEVUELVEN_SOCIO = [
    "users.js",
    "users/[id].js",
    "users/create.js",
    "users/set-access-type.js",
    "visits/cancel.js",
    "visits/register.js",
    "waiver/sign.js",
    "cortesia/usar.js",
    "adjust-credits.js",
    "mensualidad/renovar.js",
  ];

  // Los que delegan en lib/operaciones.js (compartido con el MCP) recortan
  // allá, así que vale importar eso siempre que operaciones recorte.
  const operaciones = fs.readFileSync(path.join(process.cwd(), "lib", "operaciones.js"), "utf8");

  it("lib/operaciones.js importa el recorte", () => {
    expect(operaciones).toMatch(/from ["']\.\/redact["']/);
  });

  it.each(DEVUELVEN_SOCIO)("%s importa el recorte", (rel) => {
    expect(leer(rel)).toMatch(/from ["'].*lib\/(redact|operaciones)["']/);
  });
});
