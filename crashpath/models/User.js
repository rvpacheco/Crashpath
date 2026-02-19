import mongoose from "mongoose";

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
  },
  { _id: true }
);

VisitSchema.index({ date: 1 });

const UserSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },

    documentType: {
      type: String,
      enum: ["CC", "CE", "TI", "PP", "NIT", "OTRO"],
    },
    documentNumber: { type: String },

    phone: { type: String, unique: true, sparse: true },
    emergencyContactName: { type: String },
    emergencyContactPhone: { type: String },
    epsName: { type: String },

    credits: { type: Number, default: 0 },

    visits: [VisitSchema],

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

    sensitiveDataConsent: {
      type: Boolean,
      default: false,
    },

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
  },
  { timestamps: true }
);

UserSchema.pre("save", function (next) {
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
