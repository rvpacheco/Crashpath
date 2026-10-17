import { describe, it, expect, vi } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import React from "react";

// next/head no pinta nada fuera de Next: lo cambiamos por un contenedor para
// poder leer las etiquetas que la página mete en el <head>.
vi.mock("next/head", () => ({
  default: ({ children }) => React.createElement("head", null, children),
}));

const leer = (ruta) => readFileSync(new URL(`../${ruta}`, import.meta.url), "utf8");

describe("robots.txt", () => {
  it("existe y apunta al sitemap con la URL canónica (con www)", () => {
    expect(existsSync(new URL("../public/robots.txt", import.meta.url))).toBe(true);
    expect(leer("public/robots.txt")).toContain(
      "Sitemap: https://www.crashpath.lat/sitemap.xml"
    );
  });

  it("pide no rastrear /admin ni /api/, pero deja /privacy rastreable", () => {
    const txt = leer("public/robots.txt");
    expect(txt).toMatch(/^Disallow: \/admin$/m);
    expect(txt).toMatch(/^Disallow: \/api\/$/m);
    // noindex solo funciona si Google puede entrar a leer la página
    expect(txt).not.toMatch(/^Disallow: \/privacy/m);
  });
});

describe("sitemap.xml", () => {
  it("lista solo la home, con www", () => {
    expect(existsSync(new URL("../public/sitemap.xml", import.meta.url))).toBe(true);
    const xml = leer("public/sitemap.xml");
    expect([...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1])).toEqual([
      "https://www.crashpath.lat/",
    ]);
  });
});

describe("/privacy", () => {
  it("se publica con noindex, canonical propio y título propio", async () => {
    const { default: Privacy } = await import("../pages/privacy.js");
    const html = renderToStaticMarkup(React.createElement(Privacy));
    expect(html).toContain('name="robots" content="noindex, nofollow"');
    expect(html).toContain('rel="canonical" href="https://www.crashpath.lat/privacy"');
    expect(html).toContain("<title>Política de privacidad | CrashPath</title>");
  });
});
