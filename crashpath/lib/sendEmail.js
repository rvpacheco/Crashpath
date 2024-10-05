import nodemailer from 'nodemailer';

// Configura el transporte SMTP
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,   // El host del servicio SMTP (p.ej., smtp.sendgrid.net)
  port: process.env.SMTP_PORT,   // El puerto SMTP (p.ej., 587)
  secure: false,                 // true para 465, false para otros puertos
  auth: {
    user: process.env.SMTP_USER, // Usuario SMTP
    pass: process.env.SMTP_PASS, // Contraseña SMTP
  },
});

// Función para enviar correos electrónicos
export async function sendEmail({ to, subject, text }) {
  const mailOptions = {
    from: process.env.SMTP_USER,  // Dirección de correo del remitente
    to: to,                       // Dirección de correo del destinatario
    subject: subject,             // Asunto del correo
    text: text,                   // Texto del correo
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log('Correo enviado correctamente a:', to);
  } catch (error) {
    console.error('Error al enviar el correo:', error);
    throw error;
  }
}
