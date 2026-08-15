/**
 * Comprueba contra la BASE REAL que el recorte de datos sensibles funciona.
 *
 * Uso (desde crashpath/):
 *
 *   npm run verificar:recorte
 *
 * SOLO LEE: aggregate y find, ni una escritura. Se puede correr en producción
 * con el gym abierto.
 *
 * Por qué existe y no alcanza con los tests: lo único que los tests NO pueden
 * probar es que MONGO de verdad respete la proyección, y ahí está el caso
 * delicado —`cortesia.usos.guestDocument` es un campo adentro de un arreglo—.
 * Si esa exclusión no funcionara, el panel del voluntario mostraría el
 * documento de todos los invitados que pasaron por el gym y los tests seguirían
 * en verde. Vale correrlo después de cada deploy que toque lib/redact.js o el
 * modelo del usuario.
 *
 * La URI de producción está en Vercel: `vercel env pull .env.local`.
 * Hace falta que la IP desde donde se corre esté en el allowlist de Atlas.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import mongoose from "mongoose";
import { CAMPOS_SENSIBLES, proyeccionSinSensibles } from "../lib/redact.js";

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

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

cargarEnvLocal();

const URI = process.env.MONGODB_URI;
if (!URI) {
  console.error("Falta MONGODB_URI. Corré `vercel env pull .env.local` primero.");
  process.exit(1);
}

let fallos = 0;
const chk = (ok, msg) => {
  console.log(`  ${ok ? "ok  " : "FALLA"}  ${msg}`);
  if (!ok) fallos++;
};

// La misma proyección de campos pesados que usa /api/admin/users.
const CAMPOS_PESADOS = {
  waiverTextSnapshot: 0,
  waiverSignatureUrl: 0,
  waiverSignatureText: 0,
  "visits.events": 0,
};

await mongoose.connect(URI);
const col = mongoose.connection.db.collection("users");

console.log("\n== Muestra ==");
const total = await col.countDocuments();
const conSensibles = await col.countDocuments({
  $or: CAMPOS_SENSIBLES.map((c) => ({ [c]: { $exists: true, $ne: null } })),
});
const conUsos = await col.countDocuments({ "cortesia.usos.0": { $exists: true } });
console.log(`  ${total} usuarios · ${conSensibles} con datos sensibles · ${conUsos} con cortesías usadas`);
// Sin datos sensibles en la base, el resto pasaría en verde sin probar nada.
chk(conSensibles > 0, "hay datos sensibles de verdad que recortar");

const comoVoluntario = await col
  .aggregate([{ $project: proyeccionSinSensibles(CAMPOS_PESADOS) }])
  .toArray();

console.log("\n== Lo que el voluntario NO debe recibir ==");
for (const campo of CAMPOS_SENSIBLES) {
  const cuantos = comoVoluntario.filter((u) => u[campo] !== undefined).length;
  chk(cuantos === 0, `"${campo}" no viaja (${cuantos} docs lo traen)`);
}

const conDocInvitado = comoVoluntario.filter((u) =>
  (u.cortesia?.usos || []).some((uso) => uso.guestDocument !== undefined)
);
chk(
  conDocInvitado.length === 0,
  `"cortesia.usos.guestDocument" no viaja (${conDocInvitado.length} docs lo traen)`
);

console.log("\n== Lo que el voluntario SÍ necesita ==");
const usosVisibles = comoVoluntario.reduce((n, u) => n + (u.cortesia?.usos?.length || 0), 0);
chk(
  conUsos === 0 || usosVisibles > 0,
  `el historial de cortesías sigue visible sin el documento (${usosVisibles} usos)`
);
for (const campo of ["name", "email", "accessType", "credits", "waiverStatus", "visits"]) {
  const cuantos = comoVoluntario.filter((u) => u[campo] !== undefined).length;
  chk(cuantos > 0, `"${campo}" sigue llegando (${cuantos} docs)`);
}

console.log("\n== El admin no perdió nada ==");
const comoAdmin = await col.aggregate([{ $project: CAMPOS_PESADOS }]).toArray();
chk(
  comoAdmin.filter((u) => u.documentNumber !== undefined).length > 0,
  "el admin sí ve el documento"
);

console.log("\n== findOne (el detalle de /api/admin/users/[id]) ==");
const uno = await col.findOne({ documentNumber: { $exists: true, $ne: null } });
if (!uno) {
  chk(false, "no hay ningún usuario con documento para probar el detalle");
} else {
  const recortado = await col.findOne({ _id: uno._id }, { projection: proyeccionSinSensibles() });
  chk(recortado.documentNumber === undefined, "el documento no viaja");
  chk(recortado.name !== undefined, "pero el nombre sí");
}

await mongoose.disconnect();

console.log(`\n${fallos === 0 ? "✓ Todo bien: el recorte funciona contra los datos reales." : `✗ ${fallos} fallas.`}\n`);
process.exit(fallos === 0 ? 0 : 1);
