// pages/api/user/set-access.js
import { getToken } from "next-auth/jwt";
import dbConnect from "../../../lib/mongodb";
import User from "../../../models/User";

export default async function handler(req, res) {
  if (req.method !== "POST")
    return res.status(405).json({ message: "Method not allowed" });

  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
  if (!token) return res.status(401).json({ message: "Not authenticated" });

  const accessType = String(req.body?.accessType || "").trim().toLowerCase();
  if (accessType !== "ticketera" && accessType !== "mensualidad")
    return res.status(400).json({ message: "Invalid accessType" });

  await dbConnect();

  try {
    const email = token?.user?.email || token?.email;
    const user = await User.findOne({ email });
    if (!user) return res.status(404).json({ message: "User not found" });

    // Solo permitir si aún no tiene accessType definido
    if (user.accessType) {
      return res.status(409).json({ message: "Ya tienes una modalidad asignada." });
    }

    user.accessType = accessType;
    if (accessType === "ticketera" && user.credits == null) user.credits = 0;
    await user.save();

    return res.status(200).json({ message: "OK", accessType });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ message: "Error interno" });
  }
}