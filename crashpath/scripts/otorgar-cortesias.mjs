/**
 * Reparto ÚNICO de la cortesía de arranque.
 *
 * Se corre una sola vez, al estrenar la función: le da su pase de invitado a
 * todos los socios que YA tenían acceso vigente. De ahí en adelante todo es
 * automático (renovar mensualidad o cargar créditos renueva la cortesía), así
 * que esto no vive en el panel: es un script y se corre a mano.
 *
 * Uso (desde crashpath/):
 *
 *   # 1. ver a quiénes les tocaría, sin escribir nada
 *   npm run cortesias
 *
 *   # 2. si la lista cuadra, aplicar
 *   npm run cortesias:apply
 *
 * (Son dos scripts separados a propósito: PowerShell se come el `--` de
 *  `npm run cortesias -- --apply` y el flag nunca llega acá, así que el
 *  reparto correría en seco creyendo uno que aplicó.)
 *
 * La URI de producción está en Vercel, no en el repo. Se puede bajar con
 * `vercel env pull .env.local` (el script lee .env.local si existe) o pegarla
 * en la variable como en el ejemplo.
 *
 * Es idempotente: solo toca a quien NUNCA ha tenido cortesía. Correrlo dos
 * veces no le devuelve la entrada a nadie que ya la haya gastado.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import mongoose from "mongoose";
import User from "../models/User.js";
import { accesoEndDate, esElegibleParaCortesia, CORTESIAS_POR_CICLO } from "../lib/cortesia.js";

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const APPLY = process.argv.includes("--apply");

/** Lee .env.local si está (formato KEY=valor, ignora comentarios). */
function cargarEnvLocal() {
  const file = path.join(ROOT, ".env.local");
  if (!fs.existsSync(file)) return;
  for (const linea of fs.readFileSync(file, "utf8").split("\n")) {
    const m = linea.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/i);
    if (!m) continue;
    const valor = m[2].replace(/^["']|["']$/g, "");
    if (!process.env[m[1]]) process.env[m[1]] = valor;
  }
}

/** Recorta en Mongo; la palabra final la tiene esElegibleParaCortesia(). */
function filtroCandidatos(now) {
  return {
    $and: [
      {
        $or: [
          { "cortesia.otorgadaEn": { $exists: false } },
          { "cortesia.otorgadaEn": null },
        ],
      },
      {
        $or: [
          { accessType: "mensualidad", "mensualidad.endDate": { $gt: now } },
          {
            accessType: "ticketera",
            credits: { $gt: 0 },
            $or: [
              { "tiquetera.endDate": { $gt: now } },
              { "tiquetera.endDate": { $exists: false } },
              { "tiquetera.endDate": null },
            ],
          },
        ],
      },
    ],
  };
}

const fmt = (d) =>
  d ? new Date(d).toLocaleDateString("en-CA", { timeZone: "America/Bogota" }) : "sin fecha";

async function main() {
  cargarEnvLocal();

  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error(
      "✗ Falta MONGODB_URI.\n" +
        "  Bájala con `vercel env pull .env.local`, o pásala en la variable:\n" +
        '  MONGODB_URI="mongodb+srv://..." npm run cortesias'
    );
    process.exit(1);
  }

  await mongoose.connect(uri);
  console.log(`Conectado a ${mongoose.connection.name}\n`);

  const now = new Date();
  const candidatos = (
    await User.find(filtroCandidatos(now))
      .select("name email accessType credits tiquetera mensualidad cortesia")
      .lean()
  ).filter((u) => esElegibleParaCortesia(u, now));

  if (candidatos.length === 0) {
    console.log("Nadie pendiente: todos los socios con acceso vigente ya tienen su cortesía.");
    await mongoose.disconnect();
    return;
  }

  console.log(`${candidatos.length} socio(s) con acceso vigente y sin cortesía:\n`);
  for (const u of candidatos) {
    const detalle =
      u.accessType === "mensualidad"
        ? `mensualidad vence ${fmt(u.mensualidad?.endDate)}`
        : `${u.credits} crédito(s), tiquetera vence ${fmt(u.tiquetera?.endDate)}`;
    console.log(`  · ${u.name} — ${detalle}`);
  }

  const mens = candidatos.filter((u) => u.accessType === "mensualidad").length;
  console.log(`\n  Mensualidad: ${mens}   Tiquetera: ${candidatos.length - mens}`);

  if (!APPLY) {
    console.log("\n(simulación — no se escribió nada)");
    console.log("Para aplicar: npm run cortesias:apply");
    await mongoose.disconnect();
    return;
  }

  // La cortesía vence con el acceso de cada uno, así que va un update por
  // socio. Se escriben campos sueltos, no el subdocumento entero: `usos` no
  // se toca.
  const ops = candidatos.map((u) => ({
    updateOne: {
      filter: { _id: u._id },
      update: {
        $set: {
          "cortesia.disponibles": CORTESIAS_POR_CICLO,
          "cortesia.otorgadaEn": now,
          "cortesia.vence": accesoEndDate(u),
        },
      },
    },
  }));

  const res = await User.bulkWrite(ops, { ordered: false });
  console.log(`\n✓ Cortesía otorgada a ${res.modifiedCount ?? candidatos.length} socio(s).`);

  await mongoose.disconnect();
}

main().catch(async (err) => {
  console.error("✗ Error:", err?.message || err);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
