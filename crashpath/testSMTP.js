const nodemailer = require('nodemailer');

async function testSMTP() {
  let transporter = nodemailer.createTransport({
    host: 'smtp-relay.sendinblue.com',  // Servidor SMTP de Brevo
    port: 587,                     // Puerto SMTP para TLS
    secure: false,                 // No usamos 'secure' porque es puerto 587
    auth: {
      user: '7d5b50003@smtp-brevo.com',  // Tu correo de empresa
      pass: 'YETRW9r8XBAvsPCh',        // Reemplaza con la API key correcta de Brevo
    },
  });

  try {
    // Verifica la conexión SMTP
    await transporter.verify();
    console.log('La conexión con el servidor SMTP es exitosa');
  } catch (error) {
    console.error('Error en la conexión SMTP:', error);
  }
}

testSMTP();
