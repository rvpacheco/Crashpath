import AuditLog from "../models/AuditLog";

export async function logAudit({ req, action, user, summary, meta }) {
  const actorEmail = req?.user?.email || req?.session?.user?.email; // depende de tu isAdminRequest
  const actorName = req?.user?.name || req?.session?.user?.name;

  const doc = await AuditLog.create({
    action,
    actorEmail,
    actorName,
    userId: user?._id,
    userEmail: user?.email,
    userName: user?.name,
    summary,
    meta: meta || {},
  });

  return doc.toObject();
}