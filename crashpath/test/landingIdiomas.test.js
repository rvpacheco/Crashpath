import { describe, it, expect, vi } from "vitest";
import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import React from "react";

// next/head no pinta nada fuera de Next: lo cambiamos por un contenedor para
// poder leer las etiquetas que la página mete en el <head>.
vi.mock("next/head", () => ({
  default: ({ children }) => React.createElement("head", null, children),
}));

import { COPY } from "../lib/landingCopy.js";

// Forma de un objeto: sus claves, recursivamente. Si alguien agrega un texto en
// español y se le olvida el inglés, estas formas dejan de coincidir.
const forma = (v) =>
  Array.isArray(v)
    ? v.map(forma)
    : v && typeof v === "object"
      ? Object.fromEntries(Object.keys(v).sort().map((k) => [k, forma(v[k])]))
      : v === undefined || v === null
        ? "string" // un texto opcional (ej. seo.title en español usa el título por defecto)
        : typeof v;

const textos = (v) =>
  Array.isArray(v) ? v.flatMap(textos) : v && typeof v === "object" ? Object.values(v).flatMap(textos) : [v];

describe("textos del landing", () => {
  it("español e inglés tienen exactamente las mismas claves", () => {
    expect(forma(COPY.en)).toEqual(forma(COPY.es));
  });

  it("ningún texto en inglés está vacío ni se quedó igual al español", () => {
    const es = textos(COPY.es);
    const en = textos(COPY.en);
    expect(en.every((s) => typeof s !== "string" || s.trim() !== "")).toBe(true);
    // Excepciones legítimas: nombres propios y cosas que no se traducen.
    const igualesOk = new Set([
      "CrashPath",
      "MoonBoard",
      "WhatsApp",
      "Home",
      "IG @crash_path",
      "WhatsApp +57 320 8608016",
      "📍 Bucaramanga, Colombia · Sport climbing", // ya está en inglés
    ]);
    const iguales = en.filter((s, i) => typeof s === "string" && s === es[i] && !igualesOk.has(s) && s.length > 12);
    expect(iguales).toEqual([]);
  });

  it("los precios en inglés llevan COP (en inglés $20.000 se lee como 20 dólares)", () => {
    const precios = [COPY.en.prices.day.price, COPY.en.prices.pack.price, COPY.en.prices.month.price];
    expect(precios.every((p) => p.startsWith("COP "))).toBe(true);
    expect(COPY.es.prices.day.price).toBe("$20.000");
  });
});

describe("páginas / y /en", () => {
  const render = async (ruta) => {
    const { default: Pagina } = await import(ruta);
    return renderToStaticMarkup(React.createElement(Pagina));
  };

  it("/ sigue en español, con canonical y hreflang hacia /en", async () => {
    const html = await render("../pages/index.js");
    expect(html).toContain("Entrenamiento Libre");
    expect(html).toContain('rel="canonical" href="https://www.crashpath.lat/"');
    expect(html).toContain('rel="alternate" hrefLang="en" href="https://www.crashpath.lat/en"');
    expect(html).toContain('rel="alternate" hrefLang="es" href="https://www.crashpath.lat/"');
    expect(html).toContain('hrefLang="x-default" href="https://www.crashpath.lat/"');
    expect(html).toContain('property="og:locale" content="es_CO"');
  });

  it("/en está en inglés, con su propio canonical, hreflang y og:locale", async () => {
    const html = await render("../pages/en.js");
    expect(html).toContain("Open Training");
    expect(html).toContain("<title>Climbing Gym in Bucaramanga, Colombia | CrashPath</title>");
    expect(html).toContain('rel="canonical" href="https://www.crashpath.lat/en"');
    expect(html).toContain('rel="alternate" hrefLang="es" href="https://www.crashpath.lat/"');
    expect(html).toContain('rel="alternate" hrefLang="en" href="https://www.crashpath.lat/en"');
    expect(html).toContain('property="og:locale" content="en_US"');
    // nada en español de la página original
    expect(html).not.toContain("Entrenamiento Libre");
    expect(html).not.toContain("Registrar visita");
    expect(html).not.toContain("Abrir menú");
  });

  it("cada página enlaza a la otra con un selector de idioma", async () => {
    expect(await render("../pages/index.js")).toContain('href="/en"');
    expect(await render("../pages/en.js")).toContain('href="/"');
  });

  it("og:locale no se repite: _app.js ya no lo fija para todo el sitio", async () => {
    expect(readFileSync(new URL("../pages/_app.js", import.meta.url), "utf8")).not.toContain("og:locale");
  });
});

describe("sitemap.xml", () => {
  const xml = readFileSync(new URL("../public/sitemap.xml", import.meta.url), "utf8");
  it("lista / y /en, cada una con sus alternates", () => {
    expect([...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1])).toEqual([
      "https://www.crashpath.lat/",
      "https://www.crashpath.lat/en",
    ]);
    expect(xml).toContain('hreflang="en" href="https://www.crashpath.lat/en"');
    expect(xml).toContain('hreflang="es" href="https://www.crashpath.lat/"');
  });
});
