import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";

const KB = 1024;

// Ancho y alto de un JPEG leyendo su cabecera (marcador SOFn).
function dimensionesJpeg(buf) {
  let i = 2;
  while (i < buf.length) {
    if (buf[i] !== 0xff) throw new Error("JPEG mal formado");
    const marcador = buf[i + 1];
    const largo = buf.readUInt16BE(i + 2);
    const esSof = marcador >= 0xc0 && marcador <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marcador);
    if (esSof) return { alto: buf.readUInt16BE(i + 5), ancho: buf.readUInt16BE(i + 7) };
    i += 2 + largo;
  }
  throw new Error("sin cabecera SOF");
}

// og-image.jpg era la foto original: 5616x3744 px y 1,3 MB. WhatsApp e
// Instagram descartan o recortan mal las vistas previas tan pesadas.
describe("og-image.jpg (vista previa al compartir el link)", () => {
  const buf = readFileSync(new URL("../public/og-image.jpg", import.meta.url));

  it("mide 1200x630, el tamaño que esperan las redes", () => {
    expect(dimensionesJpeg(buf)).toEqual({ ancho: 1200, alto: 630 });
  });

  it("pesa menos de 300 KB", () => {
    expect(buf.length).toBeLessThan(300 * KB);
  });
});
