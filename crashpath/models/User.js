import mongoose from 'mongoose';

const ReservationSchema = new mongoose.Schema({
  date: Date,
  time: String,  // Campo para almacenar la hora de la reserva
  status: {
    type: String,
    default: 'active',
  },
  isPrivate: {  // Indica si la reserva es privada
    type: Boolean,
    default: false,
  },
});

const UserSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  credits: { type: Number, default: 0 }, // Créditos por defecto para cada usuario
  reservations: [ReservationSchema],
});

export default mongoose.models.User || mongoose.model('User', UserSchema);
