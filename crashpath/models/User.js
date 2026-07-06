import mongoose from "mongoose";

/* -------------------- VISIT EVENT (auditoría dentro de cada visita) -------------------- */
/**
 * Cada evento es algo que pasó dentro de una visita:
 * - CHECKIN / CHECKOUT
 * - cambio de status
 * - notas, etc.
 */
const VisitEventSchema = new mongoose.Schema(
  {
    ts: { type: Date, default: Date.now },

    action: {
      type: String,
      enum: ["CHECKIN", "CHECKOUT", "NOTE", "STATUS_CHANGE"],
      required: true,
    },

    actor: {
      type: String,
      enum: ["user", "admin"],
      default: "admin",
    },

    actorEmail: { type: String },
    actorName: { type: String },

    // meta flexible: ej { from: "registered", to: "checked_in" }
    meta: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { _id: true }
);

/* -------------------- VISIT -------------------- */
const VisitSchema = new mongoose.Schema(
  {
    date: { type: Date, required: true },

    status: {
      type: String,
      enum: ["registered", "checked_in", "no_show", "cancelled"],
      default: "registered",
    },

    createdBy: {
      type: String,
      enum: ["user", "admin"],
      default: "user",
    },

    checkedInAt: Date,
    checkedOutAt: Date,
    notes: String,

    // ✅ auditoría por visita
    events: { type: [VisitEventSchema], default: [] },
  },
  { _id: true }
);

VisitSchema.index({ date: 1 });

/* -------------------- MENSUALIDAD -------------------- */
const MensualidadSchema = new mongoose.Schema(
  {
    active: { type: Boolean, default: false },
    startDate: { type: Date },
    endDate: { type: Date },

    renewals: [
      {
        renewedAt: { type: Date, default: Date.now },
        renewedBy: { type: String, enum: ["admin"], default: "admin" },
        adminEmail: { type: String },
        newEndDate: { type: Date },
      },
    ],
  },
  { _id: false }
);

/* -------------------- USER -------------------- */
const UserSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },

    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },

    documentType: {
      type: String,
      enum: ["CC", "CE", "TI", "PP", "NIT", "OTRO"],
    },
    documentNumber: { type: String, trim: true },

    phone: { type: String, unique: true, sparse: true, trim: true },
    emergencyContactName: { type: String, trim: true },
    emergencyContactPhone: { type: String, trim: true },
    epsName: { type: String, trim: true },

    // ── Tipo de acceso ───────────────────────────────────────
    accessType: {
      type: String,
      enum: ["ticketera", "mensualidad"],
      default: null, // importante: nuevo usuario => null => gate de selección
    },

    // Solo aplica si accessType === "ticketera"
    credits: { type: Number, default: 0 },

    // Datos de la tiquetera vigente (compra y vencimiento).
    // El vencimiento se MUESTRA en el panel pero NO bloquea el check-in:
    // el admin decide (política "trackear y avisar").
    tiquetera: {
      startDate: { type: Date },
      endDate: { type: Date },
      totalUses: { type: Number, default: 8 },
    },

    // Solo aplica si accessType === "mensualidad"
    mensualidad: { type: MensualidadSchema, default: () => ({}) },

    visits: { type: [VisitSchema], default: [] },

    waiverStatus: {
      type: String,
      enum: ["pending", "signed"],
      default: "pending",
    },
    waiverSignedAt: Date,
    waiverVersion: { type: String, default: "v1" },
    waiverMethod: {
      type: String,
      enum: ["checkbox", "signature"],
      default: "checkbox",
    },

    waiverSignatureUrl: String,
    waiverSignatureText: String,
    waiverTextSnapshot: String,

    waiverMeta: {
      ip: String,
      userAgent: String,
      signedBy: String,
      adminEmail: String,
    },

    insuranceProvider: String,
    insurancePolicyNumber: String,

    allergies: String,
    medicalConditions: String,
    bloodType: String,

    sensitiveDataConsent: { type: Boolean, default: false },

    userType: {
      type: String,
      enum: ["regular", "daypass", "walkin"],
      default: "regular",
    },

    profileStatus: {
      type: String,
      enum: ["incomplete", "complete"],
      default: "incomplete",
    },

    // si lo estás usando en UI
    esMinor: { type: Boolean, default: false },
  },
  { timestamps: true, toJSON: { virtuals: true }, toObject: { virtuals: true } }
);

/* -------------------- VIRTUALS -------------------- */
UserSchema.virtual("mensualidadVencida").get(function () {
  if (this.accessType !== "mensualidad") return null;
  if (!this.mensualidad?.endDate) return true;
  return new Date() > new Date(this.mensualidad.endDate);
});

UserSchema.virtual("tiqueteraVencida").get(function () {
  if (this.accessType !== "ticketera") return null;
  if (!this.tiquetera?.endDate) return null; // sin fecha => no se sabe, no alarmar
  return new Date() > new Date(this.tiquetera.endDate);
});

/* -------------------- HOOKS -------------------- */
UserSchema.pre("save", function (next) {
  // Auto-desactivar mensualidad si endDate ya pasó
  if (
    this.accessType === "mensualidad" &&
    this.mensualidad?.endDate &&
    new Date() > new Date(this.mensualidad.endDate)
  ) {
    this.mensualidad.active = false;
  }

  const clean = (k) => {
    if (this[k] === "") this[k] = undefined;
  };

  clean("phone");
  clean("documentType");
  clean("documentNumber");
  clean("emergencyContactName");
  clean("emergencyContactPhone");
  clean("epsName");
  clean("waiverSignatureUrl");
  clean("waiverSignatureText");
  clean("waiverTextSnapshot");

  next();
});

export default mongoose.models.User || mongoose.model("User", UserSchema);