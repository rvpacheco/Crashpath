import { getToken } from "next-auth/jwt";
import dbConnect from "../../../../lib/mongodb";
import User from "../../../../models/User";

const secret = process.env.NEXTAUTH_SECRET;

function makeWalkInEmail() {
  const rand = Math.random().toString(36).slice(2, 10);
  return `walkin_${Date.now()}_${rand}@crashpath.local`;
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ message: "Method not allowed" });

  const token = await getToken({ req, secret });
  if (!token) return res.status(401).json({ message: "Not authenticated" });

  const isAdmin = !!(token?.isAdmin ?? token?.user?.isAdmin);
  if (!isAdmin) return res.status(403).json({ message: "Forbidden" });

  const body = req.body || {};

  const name = String(body.name || "").trim();
  let email = String(body.email || "").trim().toLowerCase();

  const phone = String(body.phone || "").trim();
  const documentType = String(body.documentType || "").trim();
  const documentNumber = String(body.documentNumber || "").trim();

  const epsName = String(body.epsName || "").trim();
  const insuranceProvider = String(body.insuranceProvider || "").trim();
  const insurancePolicyNumber = String(body.insurancePolicyNumber || "").trim();

  const emergencyContactName = String(body.emergencyContactName || "").trim();
  const emergencyContactPhone = String(body.emergencyContactPhone || "").trim();

  if (!name) return res.status(400).json({ message: "Missing name" });

  await dbConnect();

  try {
    if (!email) email = makeWalkInEmail();

    const existing = await User.findOne({ email });
    if (existing) {
      return res.status(409).json({
        message: "Email already exists",
        code: "EMAIL_EXISTS",
      });
    }

    const user = await User.create({
      name,
      email,
      phone,
      documentType,
      documentNumber,
      epsName,
      insuranceProvider,
      insurancePolicyNumber,
      emergencyContactName,
      emergencyContactPhone,
      credits: 0,
      waiverStatus: "pending",
    });

    return res.status(200).json({ message: "User created", user });
  } catch (error) {
    console.error("admin users create error:", error);
    return res.status(500).json({ message: "Failed to create user" });
  }
}
