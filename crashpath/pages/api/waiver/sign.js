// pages/api/waiver/sign.js
import { getToken } from "next-auth/jwt";
import dbConnect from "../../../lib/mongodb";
import User from "../../../models/User";

const secret = process.env.NEXTAUTH_SECRET;

const WAIVER_TEXT_V1 = `
CRASHPATH – CONSENTIMIENTO INFORMADO, ASUNCIÓN DE RIESGO Y EXONERACIÓN DE RESPONSABILIDAD (v1)

Bucaramanga, Santander – Colombia

Yo, como participante y/o usuario de CrashPath, declaro que he leído cuidadosamente el presente documento y que entiendo su contenido en su totalidad.

1) Naturaleza de la actividad y riesgos:
Reconozco que la escalada, el entrenamiento físico y el uso de las instalaciones, equipos y estructuras de CrashPath implican riesgos inherentes, incluyendo pero no limitados a: caídas, golpes, lesiones musculares o articulares, esguinces, fracturas, laceraciones, sobreesfuerzo, fallas de agarre, colisiones con otras personas y accidentes derivados de mi conducta o la de terceros.

2) Asunción voluntaria de riesgo:
Acepto y asumo voluntariamente todos los riesgos conocidos y desconocidos asociados con mi participación, entendiendo que pueden derivar en lesiones graves, incapacidad permanente o, en casos extremos, muerte.

3) Condición física y salud:
Declaro que me encuentro en condiciones físicas y de salud adecuadas para realizar actividad física. Me comprometo a informar cualquier condición médica relevante y asumo la responsabilidad de consultar a un profesional de la salud si tengo dudas sobre mi aptitud.

4) Normas y conducta:
Me comprometo a cumplir las normas internas del gimnasio, seguir las indicaciones del personal y utilizar adecuadamente el equipo. Entiendo que el incumplimiento de estas normas puede aumentar el riesgo de accidente y dar lugar a la suspensión del servicio.

5) Emergencias:
Autorizo a CrashPath a contactar a mi persona de emergencia y a solicitar asistencia médica si fuese necesario. Entiendo que cualquier costo médico será asumido por mí o por mi aseguradora.

6) Exoneración de responsabilidad:
En la máxima medida permitida por la ley aplicable, libero y exonero a CrashPath, sus propietarios, administradores, empleados e instructores de responsabilidad por lesiones o daños derivados de mi participación, salvo en casos de dolo o culpa grave cuando la ley no permita su exclusión.

7) Tratamiento de datos:
Autorizo el tratamiento de mis datos personales para fines operativos, de seguridad y control interno, conforme a la normativa vigente sobre protección de datos.

8) Firma electrónica:
Acepto que mi manifestación mediante checkbox y firma digital constituye prueba válida de aceptación y tiene el mismo efecto que una firma manuscrita.

Declaro que he leído, entendido y acepto este consentimiento en su totalidad.
`;

function getClientIp(req) {
  const xfwd = req.headers["x-forwarded-for"];
  if (typeof xfwd === "string" && xfwd.length > 0) return xfwd.split(",")[0].trim();
  return req.socket?.remoteAddress || "";
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ message: "Method not allowed" });

  const token = await getToken({ req, secret });
  if (!token) return res.status(401).json({ message: "Not authenticated" });

  const { email } = token?.user || token;
  if (!email) return res.status(400).json({ message: "Missing user email" });

  const version = String(req.body?.version || "v1").trim();
  const methodRaw = String(req.body?.method || "checkbox").trim();

  const method = methodRaw === "signature" ? "signature" : "checkbox";

  const signatureText = String(req.body?.signatureText || "").trim();

  // ✅ Compatibilidad: acepta cualquiera de estos nombres
  const signatureUrl = String(
    req.body?.signatureUrl ||
    req.body?.signatureImageUrl ||
    req.body?.signatureDataUrl ||
    ""
  ).trim();

  const ip = getClientIp(req);
  const userAgent = String(req.headers["user-agent"] || "");

  if (method === "signature" && !signatureText && !signatureUrl) {
    return res.status(400).json({
      message: "Signature required (type your name or draw on canvas)",
      code: "SIGNATURE_REQUIRED",
    });
  }

  await dbConnect();

  try {
    const user = await User.findOne({ email });
    if (!user) return res.status(404).json({ message: "User not found" });

    // idempotente
    if (user.waiverStatus === "signed") {
      let changed = false;

      if (!user.waiverTextSnapshot) {
        user.waiverTextSnapshot = version === "v1" ? WAIVER_TEXT_V1 : WAIVER_TEXT_V1;
        changed = true;
      }

      user.waiverMeta = user.waiverMeta || {};
      if (!user.waiverMeta.ip) { user.waiverMeta.ip = ip; changed = true; }
      if (!user.waiverMeta.userAgent) { user.waiverMeta.userAgent = userAgent; changed = true; }

      if (!user.waiverSignatureText && signatureText) {
        user.waiverSignatureText = signatureText;
        changed = true;
      }
      if (!user.waiverSignatureUrl && signatureUrl) {
        user.waiverSignatureUrl = signatureUrl;
        changed = true;
      }

      if (changed) await user.save();

      return res.status(200).json({ message: "Waiver already signed", user });
    }

    user.waiverStatus = "signed";
    user.waiverSignedAt = new Date();
    user.waiverVersion = version;
    user.waiverMethod = method;

    user.waiverTextSnapshot = version === "v1" ? WAIVER_TEXT_V1 : WAIVER_TEXT_V1;

    if (signatureText) user.waiverSignatureText = signatureText;
    if (signatureUrl) user.waiverSignatureUrl = signatureUrl;

    user.waiverMeta = { ip, userAgent };

    await user.save();

    return res.status(200).json({ message: "Waiver signed", user });
  } catch (error) {
    console.error("waiver sign error:", error);
    return res.status(500).json({ message: "Failed to sign waiver" });
  }
}
