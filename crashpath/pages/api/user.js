import { getToken } from "next-auth/jwt";
import dbConnect from "../../lib/mongodb";
import User from "../../models/User";

const secret = process.env.NEXTAUTH_SECRET;

function computeMissingFields(user) {
  const missing = [];
  if (!String(user?.documentType || "").trim()) missing.push("documentType");
  if (!String(user?.documentNumber || "").trim()) missing.push("documentNumber");
  if (!String(user?.phone || "").trim()) missing.push("phone");
  if (!String(user?.epsName || "").trim()) missing.push("epsName");
  if (!String(user?.emergencyContactName || "").trim()) missing.push("emergencyContactName");
  if (!String(user?.emergencyContactPhone || "").trim()) missing.push("emergencyContactPhone");
  return missing;
}

function computeProfileStatus(user) {
  return computeMissingFields(user).length === 0 ? "complete" : "incomplete";
}

export default async function handler(req, res) {
  const token = await getToken({ req, secret });

  if (!token) return res.status(401).json({ message: "Not authenticated" });

  const email = token?.user?.email || token?.email;
  const name = token?.user?.name || token?.name;

  if (!email || !name) {
    return res.status(400).json({ message: "Missing user details" });
  }

  await dbConnect();

  try {
    let user = await User.findOne({ email });

    if (!user) {
      user = await User.create({
        name,
        email,
        credits: 0,
        visits: [],
        waiverStatus: "pending",
        profileStatus: "incomplete",
      });
    } else {
      // mantener name actualizado si cambia en Google
      if (user.name !== name) {
        user.name = name;
        await user.save();
      }
    }

    const profileStatus = computeProfileStatus(user);
    if (user.profileStatus !== profileStatus) {
      user.profileStatus = profileStatus;
      await user.save();
    }

    const missingFields = computeMissingFields(user);

    // devolver user + helpers para front
    const safe = user.toObject();
    safe.profileStatus = user.profileStatus;
    safe.missingFields = missingFields;

    return res.status(200).json(safe);
  } catch (error) {
    console.error("Error in /api/user:", error);
    return res.status(500).json({ message: "Failed to fetch or create user" });
  }
}
