const nodemailer = require('nodemailer');
const { variablesEntorno } = require('../../config/variablesEntorno');
const { traducirErrorSmtp } = require('../../utilidades/traducirErrorSmtp');

const PROVEEDOR = 'smtp';

let transporte = null;

function construirRemitente() {
  const { fromName, fromAddress } = variablesEntorno.email;
  if (!fromAddress) return null;
  return `"${fromName}" <${fromAddress}>`;
}

/** Puerto 465 = SSL implícito; 587/2525/25 = STARTTLS (secure debe ser false). */
function resolverSecure(port, secureEnv) {
  if (port === 465) return true;
  if (port === 587 || port === 2525 || port === 25) return false;
  return secureEnv;
}

function obtenerTransporte() {
  const { smtp } = variablesEntorno.email;
  if (!smtp.host || !smtp.user || !smtp.pass) {
    return null;
  }

  const secure = resolverSecure(smtp.port, smtp.secure);
  if (secure !== smtp.secure) {
    console.warn(
      `[correo] SMTP_SECURE=${smtp.secure} ignorado para puerto ${smtp.port}; usando secure=${secure}`
    );
  }

  if (!transporte) {
    transporte = nodemailer.createTransport({
      pool: true,
      maxConnections: 5,
      maxMessages: 100,
      host: smtp.host,
      port: smtp.port,
      secure,
      auth: {
        user: smtp.user,
        pass: smtp.pass,
      },
      tls: {
        rejectUnauthorized: process.env.NODE_ENV === 'production',
      },
    });
  }

  return transporte;
}

async function verificarConexion() {
  const trans = obtenerTransporte();
  if (!trans) {
    throw new Error(
      'SMTP no configurado: define SMTP_HOST, SMTP_USER y SMTP_PASS en backend/.env'
    );
  }
  await trans.verify();
}

async function sendEmail(payload) {
  const trans = obtenerTransporte();
  const from = construirRemitente();

  if (!trans || !from) {
    return { success: false, omitido: true, provider: PROVEEDOR };
  }

  try {
    const info = await trans.sendMail({
      from,
      to: payload.to,
      subject: payload.subject,
      html: payload.html,
      text: payload.text,
      replyTo: payload.replyTo,
      attachments: payload.attachments,
    });

    return {
      success: true,
      messageId: info.messageId,
      provider: PROVEEDOR,
    };
  } catch (error) {
    const traducido = new Error(traducirErrorSmtp(error));
    return { success: false, provider: PROVEEDOR, error: traducido };
  }
}

function estaConfigurado() {
  const { smtp, fromAddress } = variablesEntorno.email;
  return Boolean(smtp.host && smtp.user && smtp.pass && fromAddress);
}

module.exports = {
  sendEmail,
  verificarConexion,
  estaConfigurado,
  proveedor: PROVEEDOR,
};
