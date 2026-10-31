// Renderiza flyer.html a PNG en los dos formatos: node render.cjs
const { chromium } = require("playwright");
const path = require("node:path");

const dir = __dirname;
const formatos = { story: 1920, post: 1350 };

(async () => {
const browser = await chromium.launch();
for (const [f, alto] of Object.entries(formatos)) {
  const page = await browser.newPage({ viewport: { width: 1080, height: alto } });
  await page.goto(`file://${dir}/flyer.html?f=${f}`);
  await page.waitForSelector("body[data-listo]");
  await page.evaluate(() => document.fonts.ready);
  await page.locator("#lienzo").screenshot({ path: path.join(dir, `cerrado-lunes-2-${f}.png`) });
  console.log(`listo: ${f}`);
}
await browser.close();
})();
