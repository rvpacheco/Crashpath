import { getToken } from "next-auth/jwt";
import dbConnect from "../../../lib/mongodb";
import User from "../../../models/User";

const secret = process.env.NEXTAUTH_SECRET;

function addMonths(date, months) {
    const d = new Date(date);
    const m = d.getMonth();
    d.setMonth(m + months);
    return d;
}

function normalizeAccessType(value) {
    const v = String(value || "").trim().toLowerCase();
    if (v === "ticketera" || v === "mensualidad") return v;
    return null;
}

export default async function handler(req, res) {
    if (req.method !== "POST")
        return res.status(405).json({ message: "Method not allowed" });

    const token = await getToken({ req, secret });
    if (!token) return res.status(401).json({ message: "Not authenticated" });

    // Permitir si es admin O si es el propio usuario
    const requestedUserId = String(req.body?.userId || "").trim();
    const tokenUserId = String(token?.sub || token?.user?.id || "").trim();
    const isSelf = requestedUserId === tokenUserId;

    if (!token?.isAdmin && !isSelf) {
        return res.status(403).json({ message: "Forbidden" });
    }

    const userId = String(req.body?.userId || "").trim();
    const accessType = normalizeAccessType(req.body?.accessType);
    const months = Number(req.body?.months || 0);
    const creditsRaw = req.body?.credits;

    if (!userId)
        return res.status(400).json({ message: "Missing userId" });

    if (!accessType)
        return res.status(400).json({ message: "Invalid accessType" });

    await dbConnect();

    try {
        const user = await User.findById(userId);
        if (!user)
            return res.status(404).json({ message: "User not found" });

        const previousType = user.accessType || "ticketera";
        const now = new Date();

        user.accessType = accessType;

        // ─────────────────────────────────────────────
        // ➜ CAMBIO A MENSUALIDAD
        // ─────────────────────────────────────────────
        if (accessType === "mensualidad") {
            if (!Number.isFinite(months) || months <= 0) {
                return res.status(400).json({
                    message: "You must provide valid months for mensualidad",
                });
            }

            const currentEnd = user?.mensualidad?.endDate
                ? new Date(user.mensualidad.endDate)
                : null;

            // Si está activa, extender desde endDate
            const baseDate =
                currentEnd && currentEnd > now ? currentEnd : now;

            const startDate =
                currentEnd && currentEnd > now
                    ? user?.mensualidad?.startDate || now
                    : now;

            const endDate = addMonths(baseDate, months);

            user.mensualidad = {
                ...(user.mensualidad || {}),
                active: true,
                startDate,
                endDate,
                renewals: [
                    ...(user?.mensualidad?.renewals || []),
                    {
                        renewedAt: now,
                        renewedBy: "admin",
                        adminEmail:
                            token?.email ||
                            token?.user?.email ||
                            "admin",
                        newEndDate: endDate,
                    },
                ],
            };

            // No tocamos créditos (por si luego vuelve a ticketera)
        }

        // ─────────────────────────────────────────────
        // ➜ CAMBIO A TICKETERA
        // ─────────────────────────────────────────────
        if (accessType === "ticketera") {
            if (user.mensualidad) {
                user.mensualidad.active = false;
            }

            if (creditsRaw !== undefined) {
                const n = Number(creditsRaw);
                if (!Number.isFinite(n)) {
                    return res.status(400).json({ message: "Invalid credits" });
                }
                user.credits = Math.max(0, Math.trunc(n));
            }

            if (user.credits == null) user.credits = 0;
        }

        await user.save();

        return res.status(200).json({
            message: "Access type updated successfully",
            user,
            code: "ACCESS_UPDATED",
        });

    } catch (err) {
        console.error("ACCESS SET ERROR:", err);
        return res.status(500).json({
            message: "Failed to update access type",
        });
    }
}