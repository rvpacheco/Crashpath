/**
 * Arreglo ÚNICO de un socio duplicado: Alejandro Jacome Reyes (10/11/2026).
 *
 * Se creó dos veces. La cuenta con el check-in y el waiver firmado quedó con
 * el correo y el celular mal; la otra tiene los datos buenos pero ni check-in
 * ni firma. Este script:
 *   1. borra la cuenta SIN check-in (la de datos buenos, que sobra), junto con
 *      sus reservas de moonboard, y
 *   2. le pone los datos buenos a la cuenta que conserva el pase de día y la firma.
 *
 * Uso (desde crashpath/, con MONGODB_URI de producción en .env.local):
 *
 *   npm run corregir-jacome          # ver qué haría, sin escribir nada
 *   npm run corregir-jacome:apply    # aplicar
 *
 * Verifica los _id y el estado de cada cuenta antes de tocar nada; si algo no
 * cuadra, aborta. Correrlo dos veces es seguro (la segunda aborta).
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import mongoose from "mongoose";
import User from "../models/User.js";
import MoonReservation from "../models/MoonReservation.js";

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const APPLY = process.argv.includes("--apply");

// Cuenta que se conserva (datos malos, con check-in y waiver) → se corrige.
const ID_CONSERVAR = "6af39a3960fff395e8dca26d";
// Cuenta que sobra (datos buenos, sin check-in ni waiver) → se borra.
const ID_BORRAR = "6af39a0b60fff395e8dca25f";
const EMAIL_BUENO = "alejandrojacome504@gmail.com";
const TELEFONO_BUENO = "3224572392";

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
  `${u.name} · ${u.email} · ${u.phone || u.telefono || "sin cel"} · waiver ${u.waiverStatus} · ${(u.visits || []).length} visita(s)`;

async function main() {
  cargarEnvLocal();
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error("✗ Falta MONGODB_URI (`vercel env pull .env.local`).");
    process.exit(1);
  }
  await mongoose.connect(uri);

  try {
    const conservar = await User.findById(ID_CONSERVAR);
    const borrar = await User.findById(ID_BORRAR);

    if (!conservar || !borrar) {
      console.log("Nada que hacer: una de las dos cuentas ya no existe (¿ya se corrió?).");
      if (conservar) console.log("  Queda:", resumen(conservar));
      return;
    }

    console.log("SE CONSERVA :", resumen(conservar));
    console.log("SE BORRA    :", resumen(borrar));

    // Salvaguardas: no borrar nada que tenga historia.
    if ((borrar.visits || []).length > 0 || borrar.waiverStatus === "signed") {
      throw new Error("La cuenta a borrar tiene visitas o waiver firmado: no se toca. Revisar a mano.");
    }
    if ((conservar.visits || []).length === 0 || conservar.waiverStatus !== "signed") {
      throw new Error("La cuenta a conservar no tiene el check-in/waiver esperado: no se toca. Revisar a mano.");
    }
    if (String(borrar.email).toLowerCase() !== EMAIL_BUENO) {
      throw new Error("El correo de la cuenta a borrar no es el esperado: no se toca.");
    }

    console.log(`\nDespués: la que se conserva queda con ${EMAIL_BUENO} · ${TELEFONO_BUENO}`);

    if (!APPLY) {
      console.log("\n(en seco: no se escribió nada. Para aplicar: npm run corregir-jacome:apply)");
      return;
    }

    // Primero borrar: el email es único y está ocupado por la que sobra.
    await User.findByIdAndDelete(ID_BORRAR);
    await MoonReservation.deleteMany({
      $or: [{ userId: String(ID_BORRAR) }, { userEmail: borrar.email }],
    });

    conservar.email = EMAIL_BUENO;
    conservar.phone = TELEFONO_BUENO;
    await conservar.save();

    console.log("\n✓ Hecho. Cuenta final:", resumen(await User.findById(ID_CONSERVAR)));
  } finally {
    await mongoose.disconnect();
  }
}

main().catch((e) => {
  console.error("✗", e.message);
  process.exit(1);
});
