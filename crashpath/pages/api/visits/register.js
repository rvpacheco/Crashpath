import { getToken } from "next-auth/jwt";
import dbConnect from "../../../lib/mongodb";
import User from "../../../models/User";
import { dayRangeBogota } from "../../../lib/dates";

const secret = process.env.NEXTAUTH_SECRET;

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ message: "Method not allowed" });
  }

  const token = await getToken({ req, secret });
  if (!token) {
    return res.status(401).json({ message: "Not authenticated" });
  }

  const { email } = token?.user || token;
  if (!email) {
    return res.status(400).json({ message: "Missing user email" });
  }

  await dbConnect();

  try {
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // ====== Waiver obligatorio ======
    if (user.waiverStatus !== "signed") {
      return res.status(409).json({
        message: "Waiver must be signed before checking in",
        code: "WAIVER_REQUIRED",
      });
    }

    // ====== Perfil obligatorio ======
    const missingProfile =
      !user.phone ||
      !user.documentNumber ||
      !user.emergencyContactName ||
      !user.emergencyContactPhone ||
      !user.epsName;

    if (missingProfile) {
      return res.status(409).json({
        message: "Complete your profile before checking in",
        code: "PROFILE_INCOMPLETE",
      });
    }

    // ====== Determinar día objetivo (día calendario de BOGOTÁ, no del
    // servidor: en Vercel el servidor es UTC y "hoy" arrancaría a las 7pm) ======
    const range = dayRangeBogota(req.body?.date);
    if (!range) {
      return res.status(400).json({ message: "Invalid date" });
    }
    const { start: startOfDay, end: endOfDay } = range;

    // ====== Documento de check-in ======
    // El check-in solo marca asistencia: no descuenta créditos ni valida modalidad.
    const visitDoc = {
      date: startOfDay,
      status: "checked_in",
      createdBy: "user",
      notes: "",
    };

    // ====== Insert atómico anti-doble check-in ======
    // El filtro exige que NO exista ya una visita no cancelada en el rango del
    // día. Si existe, el update no matchea y `updated` queda null → ya hizo
    // check-in hoy. Esto evita la condición de carrera de leer-luego-escribir.
    const updated = await User.findOneAndUpdate(
      {
        _id: user._id,
        visits: {
          $not: {
            $elemMatch: {
              date: { $gte: startOfDay, $lte: endOfDay },
              status: { $ne: "cancelled" },
            },
          },
        },
      },
      { $push: { visits: visitDoc } },
      { new: true }
    );

    if (!updated) {
      return res.status(409).json({
        message: "You already checked in for this day",
        code: "VISIT_ALREADY_EXISTS",
      });
    }

    const createdVisit = updated.visits?.[updated.visits.length - 1];
    return res.status(200).json({
      message: "Check-in registered",
      user: updated,
      visit: createdVisit,
    });
  } catch (error) {
    console.error("check-in error:", error);
    return res.status(500).json({ message: "Failed to register check-in" });
  }
}