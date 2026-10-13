import mongoose, { Schema } from "mongoose";

/**
 * Un movimiento del inventario del mostrador (ver lib/inventario.js).
 *
 * El stock de cada producto es la suma de `delta`. No se edita ni se borra un
 * movimiento: un error se corrige con un ajuste, que queda con su autor.
 */
const MovimientoInventarioSchema = new Schema(
  {
    ts: { type: Date, default: Date.now },
    producto: { type: String, required: true }, // clave de lib/inventario.js
    tipo: { type: String, required: true, enum: ["venta", "entrada", "ajuste"] },

    cantidad: { type: Number, required: true }, // siempre positiva, para mostrar
    delta: { type: Number, required: true },    // con signo, lo que mueve el stock
    conteo: { type: Number },                   // solo en ajuste: lo que había en físico

    // Solo en venta. Se guarda el precio del momento: si mañana sube, las
    // ventas viejas siguen sumando lo que realmente se cobró.
    precioUnitario: { type: Number },
    total: { type: Number },

    // Quién lo registró. En una venta, quién vendió.
    por: {
      email: { type: String },
      name: { type: String },
      rol: { type: String },
    },

    nota: { type: String, trim: true },
  },
  { timestamps: false }
);

MovimientoInventarioSchema.index({ producto: 1, ts: -1 });
MovimientoInventarioSchema.index({ ts: -1 });

export default mongoose.models.MovimientoInventario ||
  mongoose.model("MovimientoInventario", MovimientoInventarioSchema);
