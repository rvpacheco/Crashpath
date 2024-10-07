// pages/privacy.js

import React from 'react';

const Privacy = () => {
  return (
    <div style={{ padding: '20px', maxWidth: '800px', margin: '0 auto' }}>
      <h1>Política de Privacidad</h1>
      <p>Última actualización: Octubre 2024</p>

      <h2>Introducción</h2>
      <p>
        En <strong>Crashpath</strong>, valoramos tu privacidad y nos comprometemos a proteger los datos personales que compartes con nosotros.
        Esta Política de Privacidad explica cómo recopilamos, usamos, y protegemos la información de los usuarios de nuestra aplicación,
        especialmente en relación con la integración de Google Calendar.
      </p>

      <h2>Información que Recopilamos</h2>
      <p>
        Nuestra aplicación recopila y utiliza la siguiente información cuando interactúas con nuestros servicios:
      </p>
      <ul>
        <li>
          <strong>Información de autenticación</strong>: Utilizamos <em>NextAuth</em> para gestionar la autenticación. Al iniciar sesión,
          recopilamos tu dirección de correo electrónico y cualquier otra información básica necesaria para autenticar tu cuenta.
        </li>
        <li>
          <strong>Tokens de acceso</strong>: Para crear eventos en tu Google Calendar, necesitamos acceso a tu cuenta de Google. Esto se hace a
          través de un token de acceso temporal que nos permite interactuar con la API de Google Calendar en tu nombre.
        </li>
        <li>
          <strong>Información de calendario</strong>: Cuando creas una reserva o evento, recopilamos detalles como la fecha, hora, y título
          del evento para agregarlo a tu Google Calendar. No almacenamos permanentemente esta información a menos que sea necesario para el
          funcionamiento de la app.
        </li>
      </ul>

      <h2>Cómo Utilizamos tu Información</h2>
      <p>La información que recopilamos se utiliza únicamente para los siguientes fines:</p>
      <ul>
        <li><strong>Crear eventos en Google Calendar</strong>: Utilizamos la API de Google Calendar para crear, modificar, y eliminar eventos en tu calendario a petición tuya.</li>
        <li><strong>Autenticación</strong>: Utilizamos tu cuenta de Google para autenticarte de manera segura en nuestra aplicación.</li>
      </ul>

      <h2>Compartir Información</h2>
      <p>No compartimos tu información personal con terceros, excepto cuando sea necesario para:</p>
      <ul>
        <li>
          <strong>Integración con Google Calendar</strong>: Utilizamos la API de Google Calendar para crear eventos en tu cuenta de Google Calendar. Google puede procesar tus datos de acuerdo con su propia política de privacidad, que puedes revisar <a href="https://policies.google.com/privacy" target="_blank" rel="noopener noreferrer">aquí</a>.
        </li>
        <li>
          <strong>Requerimientos legales</strong>: Si estamos obligados por ley a compartir tus datos con las autoridades.
        </li>
      </ul>

      <h2>Seguridad de los Datos</h2>
      <p>
        Nos comprometemos a proteger la información que nos proporcionas. Utilizamos medidas de seguridad técnicas y organizativas adecuadas
        para proteger tus datos contra el acceso no autorizado, la divulgación, o destrucción.
      </p>

      <h2>Tus Derechos</h2>
      <p>Como usuario, tienes derecho a:</p>
      <ul>
        <li><strong>Acceder a tu información</strong>: Puedes solicitar una copia de la información que tenemos sobre ti.</li>
        <li><strong>Revocar el acceso</strong>: Puedes revocar el acceso a tu cuenta de Google en cualquier momento a través de las configuraciones de tu cuenta de Google.</li>
        <li><strong>Eliminar tu cuenta</strong>: Si deseas eliminar tu cuenta, puedes ponerte en contacto con nosotros y eliminaremos toda la información que tenemos sobre ti.</li>
      </ul>

      <h2>Cambios en esta Política de Privacidad</h2>
      <p>
        Podemos actualizar esta Política de Privacidad de vez en cuando. Cualquier cambio será notificado a través de nuestra aplicación y
        entrará en vigor inmediatamente después de su publicación.
      </p>

      <h2>Contacto</h2>
      <p>Si tienes alguna pregunta sobre esta Política de Privacidad, puedes contactarnos en:</p>
      <ul>
        <li><strong>Email</strong>: <a href="mailto:rvpacheco17@gmail.com">rvpacheco17@gmail.com</a></li>
        <li><strong>Dirección</strong>: Bucaramanga, Colombia</li>
      </ul>
    </div>
  );
};

export default Privacy;
