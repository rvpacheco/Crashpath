/**
 * Arreglo ÚNICO: Laura Villamizar (hijos, 11/11/2026).
 *
 * Laura es mamá de varios hijos y el sistema no dejaba registrarlos a todos
 * con su mismo celular/correo. Fabian le recargó una tiquetera y descontó de
 * ahí las entradas de los hijos. Este script:
 *   1. le quita 4 créditos a Laura, y
 *   2. anota esos 4 créditos como ingreso (4 × $15.000 = $60.000) con un
 *      evento ADJUST_CREDITS con `meta.monto`, que es de donde el dashboard
 *      de ingresos suma las tiqueteras.
 *
 * Uso (desde crashpath/, con MONGODB_URI de producción en .env.local):
 *
 *   npm run corregir-villamizar          # ver qué haría, sin escribir nada
 *   npm run corregir-villamizar:apply    # aplicar
 *
 * Aborta si no hay exactamente una Laura Villamizar o si tiene menos de 4
 * créditos. NO es idempotente a propósito de forma automática: antes de
 * escribir busca un evento previo de esta corrección y se niega a repetirla.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import mongoose from "mongoose";
import User from "../models/User.js";
import AuditLog from "../models/AuditLog.js";
import { precioTiquetera, pesos } from "../lib/precios.js";

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const APPLY = process.argv.includes("--apply");

const CREDITOS = 4;
const MOTIVO = "Entradas de los 4 hijos de Laura Villamizar (se descontaron de su tiquetera) cobradas como ingreso";
const MARCA = "corregir-villamizar";
// 11/11/2026 12:00 en Bogotá (UTC-5).
const FECHA_INGRESO = new Date("2026-11-11T12:00:00-05:00");

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

const resumen = (u) =>
  `${u.name} · ${u.email} · ${u.accessType || "sin modalidad"} · ${u.credits ?? 0} crédito(s) · _id ${u._id}`;

async function main() {
  cargarEnvLocal();
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error("✗ Falta MONGODB_URI (`vercel env pull .env.local`).");
    process.exit(1);
  }
  await mongoose.connect(uri);

  try {
    const candidatas = await User.find({ $and: [{ name: /laura/i }, { name: /villamizar/i }] });
    if (candidatas.length !== 1) {
      console.log(`Se esperaba 1 Laura Villamizar y hay ${candidatas.length}:`);
      for (const u of candidatas) console.log("  ·", resumen(u));
      throw new Error("No se toca nada. Revisar a mano.");
    }
    const laura = candidatas[0];
    console.log("SOCIA:", resumen(laura));

    if (laura.accessType !== "ticketera") throw new Error("Laura no es de tiquetera: no se toca.");
    if ((laura.credits ?? 0) < CREDITOS) {
      throw new Error(`Laura tiene ${laura.credits ?? 0} crédito(s), menos de ${CREDITOS}: no se toca.`);
    }

    const yaHecho = await AuditLog.findOne({ userId: laura._id, "meta.corrigeScript": MARCA });
    if (yaHecho) throw new Error(`Esta corrección ya se aplicó el ${yaHecho.ts.toISOString()}: no se repite.`);

    const monto = precioTiquetera(CREDITOS);
    const despues = laura.credits - CREDITOS;
    console.log(`\nQuitar ${CREDITOS} créditos: ${laura.credits} → ${despues}`);
    console.log(`Ingreso a sumar al dashboard (tiquetera), con fecha 11/11/2026: ${pesos(monto)}`);

    if (!APPLY) {
      console.log("\n(en seco: no se escribió nada. Para aplicar: npm run corregir-villamizar:apply)");
      return;
    }

    const antes = laura.credits;
    laura.credits = despues;
    await laura.save();

    await AuditLog.create({
      // Las entradas fueron ayer (11/11/2026): el ingreso va a ese día, no al de hoy.
      ts: FECHA_INGRESO,
      action: "ADJUST_CREDITS",
      actorEmail: "script:corregir-villamizar",
      actorRol: "admin",
      userId: laura._id,
      userEmail: laura.email,
      userName: laura.name,
      summary: `Créditos: ${antes} → ${despues} (-${CREDITOS}) · ${pesos(monto)} como ingreso · corrección: ${MOTIVO}`,
      meta: {
        before: antes,
        after: despues,
        delta: -CREDITOS,
        venta: false,
        monto,
        correccion: true,
        motivo: MOTIVO,
        corrigeScript: MARCA,
      },
    });

    console.log("\n✓ Hecho. Cuenta final:", resumen(await User.findById(laura._id)));
  } finally {
    await mongoose.disconnect();
  }
}

main().catch((e) => {
  console.error("✗", e.message);
  process.exit(1);
});
