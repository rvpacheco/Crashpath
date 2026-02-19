import { getToken } from "next-auth/jwt";
import dbConnect from "../../../lib/mongodb";
import User from "../../../models/User";

const secret = process.env.NEXTAUTH_SECRET;

function computeProfileStatusFromFields({
  documentType,
  documentNumber,
  phone,
  epsName,
  emergencyContactName,
  emergencyContactPhone,
}) {
  const ok =
    String(documentType || "").trim() &&
    String(documentNumber || "").trim() &&
    String(phone || "").trim() &&
    String(epsName || "").trim() &&
    String(emergencyContactName || "").trim() &&
    String(emergencyContactPhone || "").trim();

  return ok ? "complete" : "incomplete";
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ message: "Method not allowed" });

  const token = await getToken({ req, secret });
  if (!token) return res.status(401).json({ message: "Not authenticated" });

  const email = token?.user?.email || token?.email;
  if (!email) return res.status(400).json({ message: "Missing user email" });

  const documentType = String(req.body?.documentType || "").trim();
  const documentNumber = String(req.body?.documentNumber || "").trim();

  const phone = String(req.body?.phone || "").trim();
  const emergencyContactName = String(req.body?.emergencyContactName || "").trim();
  const emergencyContactPhone = String(req.body?.emergencyContactPhone || "").trim();
  const epsName = String(req.body?.epsName || "").trim();

  if (!documentType || !documentNumber || !phone || !emergencyContactName || !emergencyContactPhone || !epsName) {
    return res.status(400).json({
      message:
        "Missing fields: documentType, documentNumber, phone, emergencyContactName, emergencyContactPhone, epsName",
      code: "PROFILE_FIELDS_MISSING",
    });
  }

  await dbConnect();

  try {
    const user = await User.findOne({ email });
    if (!user) return res.status(404).json({ message: "User not found" });

    // evitar phone duplicado
    const phoneInUse = await User.findOne({ phone, _id: { $ne: user._id } });
    if (phoneInUse) {
      return res.status(409).json({
        message: "This phone is already used by another account",
        code: "PHONE_ALREADY_IN_USE",
      });
    }

    user.documentType = documentType;
    user.documentNumber = documentNumber;

    user.phone = phone;
    user.emergencyContactName = emergencyContactName;
    user.emergencyContactPhone = emergencyContactPhone;
    user.epsName = epsName;

    user.profileStatus = computeProfileStatusFromFields({
      documentType,
      documentNumber,
      phone,
      epsName,
      emergencyContactName,
      emergencyContactPhone,
    });

    await user.save();

    return res.status(200).json({
      message: "Profile updated",
      user,
    });
  } catch (error) {
    console.error("profile update error:", error);
    return res.status(500).json({ message: "Failed to update profile" });
  }
}
