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

    // "staff" es el voluntario de turno (ver lib/authz.js). Va aparte de
    // "admin" para que el historial diga quién atendió, no solo que fue
    // "alguien del mostrador".
    actor: {
      type: String,
      enum: ["user", "admin", "staff"],
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
      enum: ["user", "admin", "staff"],
      default: "user",
    },

    checkedInAt: Date,
    checkedOutAt: Date,
    notes: String,

    // ── Visita de invitado ────────────────────────────────────────────
    // El invitado entró con la cortesía de un socio. Se guarda plano (y no
    // como objeto anidado) porque en Mongoose un path anidado siempre existe
    // como {} y no sirve para preguntar "¿esta visita fue cortesía?".
    esCortesia: { type: Boolean, default: false },
    cortesiaHostId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    cortesiaHostName: { type: String },

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
        // Sin "staff" acá, la renovación cobrada por un voluntario reventaba
        // la validación de Mongoose al guardar.
        renewedBy: { type: String, enum: ["admin", "staff"], default: "admin" },
        adminEmail: { type: String },
        newEndDate: { type: Date },
      },
    ],
  },
  { _id: false }
);

/* -------------------- CORTESÍA (pase de invitado) -------------------- */
/**
 * Un socio con mensualidad o tiquetera tiene UNA cortesía para llevar a
 * alguien. Se renueva con cada compra/renovación (no se acumula) y vence
 * junto con el acceso. La lógica vive en lib/cortesia.js.
 */
const CortesiaUsoSchema = new mongoose.Schema(
  {
    ts: { type: Date, default: Date.now },

    // El invitado queda como usuario propio (walk-in) para tener su waiver
    // firmado y su propia visita; acá solo se guarda el vínculo.
    guestUserId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    guestName: { type: String },
    guestDocument: { type: String },

    visitId: { type: mongoose.Schema.Types.ObjectId },
    adminEmail: { type: String },
  },
  { _id: true }
);

const CortesiaSchema = new mongoose.Schema(
  {
    disponibles: { type: Number, default: 0, min: 0 },
    otorgadaEn: { type: Date },
    vence: { type: Date },
    usos: { type: [CortesiaUsoSchema], default: [] },
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

    // Pase de invitado. Aplica a las dos modalidades.
    cortesia: { type: CortesiaSchema, default: () => ({}) },

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

// Mismo criterio que estadoCortesia() en lib/cortesia.js: hay saldo y no venció.
// (El panel usa /api/admin/users, que va por aggregate y no trae virtuals, así
// que allá se calcula con el helper; esto es para las rutas que sí serializan
// el documento, como /api/user.)
UserSchema.virtual("cortesiaDisponible").get(function () {
  const disponibles = this.cortesia?.disponibles ?? 0;
  if (disponibles <= 0) return false;
  const vence = this.cortesia?.vence ? new Date(this.cortesia.vence) : null;
  return !vence || vence >= new Date();
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