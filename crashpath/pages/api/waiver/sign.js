// pages/api/waiver/sign.js
import { getToken } from "next-auth/jwt";
import dbConnect from "../../../lib/mongodb";
import User from "../../../models/User";

const secret = process.env.NEXTAUTH_SECRET;

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ message: "Method not allowed" });

  const token = await getToken({ req, secret });
  if (!token) return res.status(401).json({ message: "Not authenticated" });

  await dbConnect();

  try {
    const email = String(token?.email || "").toLowerCase().trim();
    if (!email) return res.status(400).json({ message: "Missing token email" });

    const {
      version,
      method = "signature",
      waiverTextSnapshot,
      signatureImageUrl,
      signatureText,
      esMinor,
    } = req.body || {};

    if (!version || !waiverTextSnapshot) {
      return res.status(400).json({ message: "Missing waiver version/text" });
    }

    if (method === "signature" && !signatureImageUrl) {
      return res.status(400).json({ message: "Missing signatureImageUrl" });
    }

    const user = await User.findOne({ email });
    if (!user) return res.status(404).json({ message: "User not found" });

    user.waiverStatus = "signed";
    user.waiverSignedAt = new Date();
    user.waiverVersion = version;
    user.waiverMethod = method;

    user.waiverTextSnapshot = waiverTextSnapshot;
    user.waiverSignatureUrl = signatureImageUrl || user.waiverSignatureUrl;
    user.waiverSignatureText = signatureText || user.waiverSignatureText;

    user.esMinor = typeof esMinor === "boolean" ? esMinor : user.esMinor;

    user.waiverMeta = {
      ip:
        (req.headers["x-forwarded-for"]?.toString().split(",")[0] || "").trim() ||
        req.socket?.remoteAddress ||
        "",
      userAgent: req.headers["user-agent"] || "",
    };

    // opcional: evento interno
    user.events = user.events || [];
    user.events.push({
      ts: new Date(),
      action: "waiver_signed_user",
      summary: `Waiver firmado por usuario · v${version}`,
    });

    await user.save();

    return res.status(200).json({ message: "Waiver signed", code: "WAIVER_SIGNED", user });
  } catch (err) {
    console.error("waiver sign (user) error:", err);
    return res.status(500).json({ message: "Failed to sign waiver" });
  }
}