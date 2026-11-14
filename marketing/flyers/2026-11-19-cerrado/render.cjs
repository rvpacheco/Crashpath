// Renderiza flyer.html a PNG en historia y post: node render.cjs
const { chromium } = require("playwright");
const path = require("node:path");

const formatos = { story: 1920, post: 1350 };

(async () => {
  const browser = await chromium.launch();
  for (const [f, alto] of Object.entries(formatos)) {
    const page = await browser.newPage({ viewport: { width: 1080, height: alto } });
    await page.goto(`file://${__dirname}/flyer.html?f=${f}`);
    await page.waitForSelector("body[data-listo]");
    await page.locator("#lienzo").screenshot({ path: path.join(__dirname, `cerrado-jue-19-vie-20-${f}.png`) });
    console.log(`listo: ${f}`);
  }
  await browser.close();
})();
