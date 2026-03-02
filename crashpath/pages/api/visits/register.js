import { getToken } from "next-auth/jwt";
import dbConnect from "../../../lib/mongodb";
import User from "../../../models/User";

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
        message: "Waiver must be signed before registering a visit",
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
        message: "Complete your profile before registering a visit",
        code: "PROFILE_INCOMPLETE",
      });
    }

    // ====== Determinar día objetivo ======
    const target = req.body?.date ? new Date(req.body.date) : new Date();
    if (Number.isNaN(target.getTime())) {
      return res.status(400).json({ message: "Invalid date" });
    }

    const startOfDay = new Date(target);
    startOfDay.setHours(0, 0, 0, 0);

    const endOfDay = new Date(target);
    endOfDay.setHours(23, 59, 59, 999);

    // ====== Evitar doble visita ======
    const already = (user.visits || []).some((v) => {
      const d = new Date(v.date);
      return d >= startOfDay && d <= endOfDay && v.status !== "cancelled";
    });

    if (already) {
      return res.status(409).json({
        message: "You already have a visit registered for this day",
        code: "VISIT_ALREADY_EXISTS",
      });
    }

    // ====== Documento de visita ======
    const visitDoc = {
      date: startOfDay,
      status: "registered",
      createdBy: "user",
      notes: "",
    };

    // ====== Verificar acceso según tipo ======
    const accessType = user.accessType || "ticketera";

    if (accessType === "mensualidad") {
      const endDate = user?.mensualidad?.endDate;
      const isActive = endDate && new Date(endDate) > new Date();

      if (!isActive) {
        return res.status(409).json({
          message: "Tu mensualidad está vencida.",
          code: "MENSUALIDAD_EXPIRED",
        });
      }

      const updated = await User.findByIdAndUpdate(
        user._id,
        { $push: { visits: visitDoc } },
        { new: true }
      );

      const createdVisit = updated.visits?.[updated.visits.length - 1];
      return res.status(200).json({
        message: "Visit registered",
        user: updated,
        visit: createdVisit,
      });
    }

    // ====== Ticketera: descontar crédito ATÓMICO ======
    const updated = await User.findOneAndUpdate(
      { _id: user._id, credits: { $gte: 1 } },
      {
        $inc: { credits: -1 },
        $push: { visits: visitDoc },
      },
      { new: true }
    );

    if (!updated) {
      return res.status(409).json({
        message: "Not enough credits to register a visit",
        code: "INSUFFICIENT_CREDITS",
      });
    }

    const createdVisit = updated.visits?.[updated.visits.length - 1];
    return res.status(200).json({
      message: "Visit registered",
      user: updated,
      visit: createdVisit,
    });

  } catch (error) {
    console.error("register visit error:", error);
    return res.status(500).json({ message: "Failed to register visit" });
  }
}