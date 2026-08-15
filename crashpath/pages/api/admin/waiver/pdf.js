// pages/api/admin/waiver/pdf.js
import dbConnect from "../../../../lib/mongodb";
import User from "../../../../models/User";
import PDFDocument from "pdfkit";
import { requireAuth, PERMISOS } from "../../../../lib/authz";

function safe(s) {
  return String(s ?? "");
}

function safeFilename(name) {
  const base = safe(name).trim() || "usuario";
  return base
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .slice(0, 80);
}

export default async function handler(req, res) {
  if (req.method !== "GET") return res.status(405).json({ message: "Method not allowed" });

  // El PDF trae documento, contacto de emergencia y la firma escaneada: es
  // justo lo que el voluntario no puede ver, así que pide VER_SENSIBLE.
  try {
    await requireAuth(req, res, PERMISOS.VER_SENSIBLE);
  } catch {
    // El guardia ya respondió; sin este catch la excepción sube y Next
    // registra un 500 encima de una respuesta cerrada.
    return;
  }
  await dbConnect();

  try {
    const { userId, email } = req.query;

    const user = userId
      ? await User.findById(userId)
      : email
        ? await User.findOne({ email: String(email) })
        : null;

    if (!user) return res.status(404).json({ message: "User not found" });

    if (user.waiverStatus !== "signed") {
      return res.status(409).json({ message: "User has not signed the waiver" });
    }

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="waiver-${safeFilename(user.name)}.pdf"`
    );

    const doc = new PDFDocument({ size: "LETTER", margin: 48 });
    doc.pipe(res);

    doc.fontSize(18).text("CRASHPATH – WAIVER / CONSENTIMIENTO", { align: "center" });
    doc.moveDown(1);

    doc.fontSize(11);
    doc.text(`Nombre: ${safe(user.name)}`);
    doc.text(`Email: ${safe(user.email)}`);
    doc.text(`Documento: ${safe(user.documentType)} ${safe(user.documentNumber)}`.trim());
    doc.text(`Teléfono: ${safe(user.phone)}`);
    doc.text(`EPS: ${safe(user.epsName)}`);
    doc.text(
      `Fecha y hora de firma: ${user.waiverSignedAt
        ? new Date(user.waiverSignedAt).toLocaleString("es-CO", {
          timeZone: "America/Bogota",
          year: "numeric",
          month: "long",
          day: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        })
        : "—"
      }`
    );
    doc.text(`Versión: ${safe(user.waiverVersion)}`);
    doc.text(`Método: ${safe(user.waiverMethod)}`);
    doc.moveDown(0.5);
    doc.text(`IP: ${safe(user.waiverMeta?.ip)}`);
    doc.text(`User-Agent: ${safe(user.waiverMeta?.userAgent)}`);
    doc.moveDown(1);

    doc.fontSize(12).text("Texto firmado (snapshot):", { underline: true });
    doc.moveDown(0.5);
    doc.fontSize(10).text(safe(user.waiverTextSnapshot), { align: "left" });
    doc.moveDown(1);

    doc.fontSize(12).text("Firma:", { underline: true });
    doc.moveDown(0.5);

    const sigUrl = safe(user.waiverSignatureUrl);

    if (sigUrl.startsWith("data:image/")) {
      const base64 = sigUrl.split(",")[1] || "";
      const imgBuffer = Buffer.from(base64, "base64");
      doc.image(imgBuffer, { fit: [250, 120] });
    } else if (sigUrl) {
      doc.fontSize(10).text(`Firma (URL): ${sigUrl}`);
    } else if (user.waiverSignatureText) {
      doc.fontSize(14).text(safe(user.waiverSignatureText));
    } else {
      doc.fontSize(10).text("—");
    }

    doc.end();
  } catch (e) {
    console.error("waiver pdf error:", e);
    return res.status(500).json({ message: "Failed to generate waiver PDF" });
  }
}
