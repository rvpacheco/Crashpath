import mongoose from "mongoose";

/**
 * MoonReservation
 * Una reserva = 1 slot de 1.5h en la moonboard.
 * Solo 1 reserva activa por slot (unicidad por date+hour).
 * El usuario puede tener máximo 1 reserva activa/futura a la vez.
 */
const MoonReservationSchema = new mongoose.Schema(
  {
    // Usuario que reservó
    userId: { type: String, required: true },
    userEmail: { type: String, required: true },
    userName: { type: String },

    // Fecha del slot (se guarda como inicio del día en UTC-5/Bogotá)
    date: { type: Date, required: true },

    // Hora de inicio del slot: entero 0-23 (ej. 15 = 3pm)
    startHour: { type: Number, required: true, min: 0, max: 22 },

    // Duración fija: 90 minutos
    durationMinutes: { type: Number, default: 90 },

    status: {
      type: String,
      enum: ["active", "cancelled", "completed"],
      default: "active",
    },

    cancelledAt: { type: Date },
    cancelledBy: { type: String, enum: ["user", "admin"] },
    cancelReason: { type: String },

    // Auditoría
    createdBy: { type: String, enum: ["user", "admin"], default: "user" },
    meta: {
      ip: { type: String },
      userAgent: { type: String },
    },
  },
  { timestamps: true }
);

// Unicidad: solo 1 reserva activa por slot (date + startHour)
MoonReservationSchema.index(
  { date: 1, startHour: 1, status: 1 },
  {
    unique: true,
    partialFilterExpression: { status: "active" },
    name: "unique_active_slot",
  }
);

MoonReservationSchema.index({ userId: 1, status: 1 });
MoonReservationSchema.index({ date: 1 });

export default mongoose.models.MoonReservation ||
  mongoose.model("MoonReservation", MoonReservationSchema);