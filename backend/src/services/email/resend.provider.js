const { obtenerClienteResend, correoRemitente } = require('../../config/resend');
const { traducirErrorResend } = require('../../utilidades/traducirErrorResend');

const PROVEEDOR = 'resend';

async function sendEmail(payload) {
  const cliente = obtenerClienteResend();
  if (!cliente) {
    return { success: false, omitido: true, provider: PROVEEDOR };
  }

  const opciones = {};
  if (payload.idempotencyKey) {
    opciones.idempotencyKey = payload.idempotencyKey;
  }

  const mensaje = {
    from: correoRemitente,
    to: payload.to,
    subject: payload.subject,
    html: payload.html,
  };

  if (payload.text) mensaje.text = payload.text;
  if (payload.replyTo) mensaje.reply_to = payload.replyTo;
  if (payload.attachments?.length) mensaje.attachments = payload.attachments;

  const resultado = await cliente.emails.send(mensaje, opciones);

  if (resultado?.error) {
    const error = new Error(traducirErrorResend(resultado.error.message));
    return { success: false, provider: PROVEEDOR, error };
  }

  return {
    success: true,
    messageId: resultado?.data?.id,
    provider: PROVEEDOR,
  };
}

function estaConfigurado() {
  return Boolean(obtenerClienteResend());
}

module.exports = {
  sendEmail,
  estaConfigurado,
  proveedor: PROVEEDOR,
};
