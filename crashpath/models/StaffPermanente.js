import mongoose, { Schema } from "mongoose";

/**
 * Voluntario permanente: acceso de mostrador sin vencimiento, hasta que un
 * admin lo quite de la lista.
 *
 * Colección aparte de StaffGrant a propósito. StaffGrant guarda la regla de
 * oro del turno diario (siempre vence a medianoche, olvidarse de revocar es
 * el camino seguro) y no admite un documento sin `vence`. Un permanente es la
 * excepción deliberada: acá olvidarse SÍ deja el acceso abierto, y por eso
 * vive en su propia lista, visible en el panel, y quitarlo queda en la
 * auditoría con quién lo hizo.
 *
 * Se marca `quitadoEn`, no se borra: es el historial de quién tuvo acceso.
 */
const StaffPermanenteSchema = new Schema(
  {
    email: { type: String, required: true, lowercase: true, trim: true, index: true },
    name: { type: String, trim: true },
    nota: { type: String, trim: true },

    agregadoEn: { type: Date, default: Date.now },
    agregadoPor: {
      email: { type: String },
      name: { type: String },
    },

    quitadoEn: { type: Date },
    quitadoPor: {
      email: { type: String },
      name: { type: String },
    },
  },
  { timestamps: true }
);

export default mongoose.models.StaffPermanente ||
  mongoose.model("StaffPermanente", StaffPermanenteSchema);
