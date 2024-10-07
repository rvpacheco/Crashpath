import nodemailer from 'nodemailer';

// Configura el transporte SMTP con tu correo corporativo
const transporter = nodemailer.createTransport({
  host:  'smtp-relay.sendinblue.com',   // El host del servicio SMTP (p.ej., smtp-relay.brevo.com)
  port: 587,   // El puerto SMTP (587 es común para TLS)
  secure: false,                 // true para 465, false para otros puertos (TLS)
  auth: {
    user: '7d5b50003@smtp-brevo.com', // Tu correo corporativo
    pass: 'YETRW9r8XBAvsPCh', // La API key de Brevo o la contraseña SMTP
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
