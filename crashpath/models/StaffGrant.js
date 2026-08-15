import mongoose, { Schema } from "mongoose";

/**
 * Turno de voluntario. Le da acceso de mostrador a un email por lo que queda
 * del día, sin deploy y sin tocar la lista de admins de lib/roles.js.
 *
 * Colección aparte y no un campo en User por dos razones: el voluntario puede
 * no ser socio (no tiene por qué existir como User), y el historial de turnos
 * es de la operación del gym, no del perfil de un escalador.
 *
 * SIN índice TTL a propósito: el turno vencido es el registro de quién estuvo
 * en el mostrador ese día. Borrarlo automáticamente solo perdería la historia
 * que sirve para leer la auditoría después ("¿quién cobró esto el sábado?").
 */
const StaffGrantSchema = new Schema(
  {
    email: { type: String, required: true, lowercase: true, trim: true, index: true },
    name: { type: String, trim: true },

    // Siempre poblado: no existe el turno sin vencimiento (ver lib/staff.js).
    vence: { type: Date, required: true },

    otorgadoEn: { type: Date, default: Date.now },
    otorgadoPor: {
      email: { type: String },
      name: { type: String },
    },

    // Revocación manual antes de que venza solo. Se marca, no se borra.
    revocadoEn: { type: Date },
    revocadoPor: {
      email: { type: String },
      name: { type: String },
    },

    nota: { type: String, trim: true },
  },
  { timestamps: true }
);

// El guardia corre esta consulta en CADA request de un voluntario: buscar por
// email el turno más nuevo. Sin el índice compuesto sería un collscan por
// request sobre una colección que solo crece.
StaffGrantSchema.index({ email: 1, vence: -1 });

export default mongoose.models.StaffGrant ||
  mongoose.model("StaffGrant", StaffGrantSchema);
