import mongoose from 'mongoose';
const ReservationSchema = new mongoose.Schema({
  date: Date,
  time: String,  // Add this field to store the time of the reservation
  status: {
    type: String,
    default: 'active',
  },
});

const UserSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  credits: { type: Number, default: 5 }, // Por ejemplo, cada usuario tiene 5 créditos por defecto
  reservations: [ReservationSchema],
});

export default mongoose.models.User || mongoose.model('User', UserSchema);
