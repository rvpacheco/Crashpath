/**
 * Agrega voluntarios permanentes (acceso de mostrador todos los días).
 * Hace lo mismo que agregarPermanente() de lib/turnos.js: crea el documento en
 * StaffPermanente y deja la línea en AuditLog. Idempotente.
 *
 * Uso (desde crashpath/):
 *   npm run voluntarios          # simulación, no escribe
 *   npm run voluntarios:apply    # aplica
 *
 * Edita la lista VOLUNTARIOS de abajo para agregar a otros.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import mongoose from "mongoose";
import StaffPermanente from "../models/StaffPermanente.js";
import AuditLog from "../models/AuditLog.js";

const VOLUNTARIOS = [
  { email: "mte.running@gmail.com", name: "Juan Orozco" },
  { email: "andreasalazar91bu@gmail.com", name: "Andrea Salazar" },
  { email: "hexon.lizcano@gmail.com", name: "Hexon Lizcano" },
];

const ACTOR = { email: "rvpacheco17@gmail.com", name: "Rodolfo Pacheco" };
const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const APPLY = process.argv.includes("--apply");

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

async function main() {
  cargarEnvLocal();
  if (!process.env.MONGODB_URI) {
    console.error("✗ Falta MONGODB_URI (vercel env pull .env.local).");
    process.exit(1);
  }
  await mongoose.connect(process.env.MONGODB_URI);
  console.log(`Conectado a ${mongoose.connection.name}\n`);

  for (const v of VOLUNTARIOS) {
    const email = v.email.trim().toLowerCase();
    const ya = await StaffPermanente.findOne({ email, quitadoEn: null }).lean();
    if (ya) {
      console.log(`· ${v.name} <${email}>: ya es permanente`);
      continue;
    }
    if (!APPLY) {
      console.log(`· ${v.name} <${email}>: se agregaría`);
      continue;
    }
    await StaffPermanente.create({
      email,
      name: v.name,
      agregadoEn: new Date(),
      agregadoPor: ACTOR,
    });
    await AuditLog.create({
      ts: new Date(),
      action: "STAFF_PERMANENTE_ADD",
      actorEmail: ACTOR.email,
      actorName: ACTOR.name,
      userEmail: email,
      userName: v.name,
      summary: `Voluntario permanente agregado: ${v.name}`,
      meta: { email, origen: "script" },
    });
    console.log(`✓ ${v.name} <${email}>: agregado`);
  }

  if (!APPLY) console.log("\n(simulación — no se escribió nada)\nPara aplicar: npm run voluntarios:apply");
  await mongoose.disconnect();
}

main().catch(async (err) => {
  console.error("✗ Error:", err?.message || err);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
