import { describe, it, expect } from "vitest";
import { readFileSync, statSync } from "node:fs";

const aqui = (ruta) => new URL(`../${ruta}`, import.meta.url);
const KB = 1024;

// Lighthouse en móvil midió LCP de 10 s: el hero era un JPG de 1,27 MB
// (5616x3744 px). Estas pruebas evitan volver a servir una foto así.
describe("hero del landing", () => {
  const landing = readFileSync(aqui("pages/index.js"), "utf8");

  it("no usa el JPG original de 1,3 MB", () => {
    expect(landing).not.toContain("hero-2.jpg");
  });

  it.each(["public/landing/hero-2-movil.webp", "public/landing/hero-2-escritorio.webp"])(
    "%s existe y pesa menos de 250 KB",
    (ruta) => {
      expect(statSync(aqui(ruta)).size).toBeLessThan(250 * KB);
    }
  );

  it("el landing referencia las dos versiones y las precarga con su media query", () => {
    expect(landing).toContain("/landing/hero-2-movil.webp");
    expect(landing).toContain("/landing/hero-2-escritorio.webp");
    // si la precarga no lleva media, el celular baja las dos fotos
    expect(landing).toMatch(/rel="preload"[^>]*media=/s);
  });
});

describe("iconos", () => {
  it("favicon.ico pesa menos de 50 KB (llegó a 215 KB)", () => {
    expect(statSync(aqui("public/favicon.ico")).size).toBeLessThan(50 * KB);
  });
  it("existe apple-touch-icon.png, que _app.js ya referenciaba", () => {
    expect(statSync(aqui("public/apple-touch-icon.png")).size).toBeGreaterThan(0);
  });
});
