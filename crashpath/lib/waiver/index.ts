// src/lib/waiver/index.ts
import { WAIVER_TEMPLATE,WAIVER_VERSION } from "./template";

type WaiverContext = {
  cityLine: string;          // "Bucaramanga, Santander — 23/02/2026"
  isMinor: boolean;
  participantName?: string;  // opcional, por si quieres insertarlo
};

function fill(template: string, vars: Record<string, string>) {
  return template.replace(/\{\{(\w+)\}\}/g, (_, k) => vars[k] ?? "");
}

export function getWaiverSnapshot(ctx: WaiverContext) {
  const intro = ctx.isMinor
    ? `AUTORIZACIÓN Y RESPONSABILIDAD PARA MENORES DE EDAD\n(Completa y firma el representante legal).`
    : `Yo, como participante, declaro lo siguiente:`;

  const minorBlock = ctx.isMinor
    ? `
AUTORIZACIÓN Y RESPONSABILIDAD PARA MENORES DE EDAD
(… sección para padre/madre/tutor y datos del menor …)
`.trim()
    : "";

  const text = fill(WAIVER_TEMPLATE, {
    CITY_LINE: ctx.cityLine,
    INTRO_BLOCK: intro,
    MINOR_BLOCK: minorBlock,
  });

  return {
    version: WAIVER_VERSION,
    text, // ESTE es el snapshot único (DB/PDF/UI si quieres)
  };
}

// Para UI: devolver párrafos listos
export function waiverToParagraphs(snapshotText: string) {
  return snapshotText
    .split("\n\n")
    .map((p) => p.trim())
    .filter(Boolean);
}