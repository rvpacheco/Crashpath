import mongoose, { Schema } from "mongoose";

const AuditLogSchema = new Schema(
  {
    ts: { type: Date, default: Date.now, index: true },

    action: { type: String, required: true, index: true }, // "CHECKIN", "ADJUST_CREDITS", ...

    actorId: { type: Schema.Types.ObjectId, ref: "User" },
    actorEmail: { type: String },
    actorName: { type: String },
    // Con qué rol actuó. El email solo no alcanza para leer la historia: la
    // lista de admins cambia y los turnos de voluntario duran un día, así que
    // dentro de un mes no habría cómo saber con qué permiso se cobró esto.
    actorRol: { type: String, enum: ["admin", "staff"] },

    userId: { type: Schema.Types.ObjectId, ref: "User", index: true },
    userEmail: { type: String },
    userName: { type: String },

    summary: { type: String }, // listo para UI
    meta: { type: Schema.Types.Mixed },
  },
  { timestamps: false }
);

export default mongoose.models.AuditLog || mongoose.model("AuditLog", AuditLogSchema);