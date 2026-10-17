import { defineConfig, transformWithOxc } from "vite";

// Las páginas de Next llevan JSX en archivos .js; Vitest no los entiende y no
// se pueden importar para probar lo que pintan. Este plugin los compila como
// JSX solo dentro de pages/ y components/.
const jsxEnPages = {
  name: "jsx-en-pages",
  enforce: "pre",
  async transform(code, id) {
    if (!/\/(pages|components)\/[^?]*\.js$/.test(id)) return null;
    return transformWithOxc(code, id, { lang: "jsx", jsx: { runtime: "automatic" } });
  },
};

export default defineConfig({ plugins: [jsxEnPages] });
