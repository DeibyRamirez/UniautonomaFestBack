const pagosRepository = require('../repositories/pagos.repository');
const { enviarCorreoCodigoReclamo } = require('./correo.service');

async function intentarEnviarCorreoReclamo(pago) {
  if (!pago?.id || !pago.uniqueClaimCode) {
    return { enviado: false, motivo: 'sin_codigo' };
  }

  if (pago.emailEnviadoEn) {
    return { enviado: true, idempotente: true };
  }

  const info = pago.personalInfo || {};
  const nombre = [info.firstName, info.firstSurname].filter(Boolean).join(' ');

  try {
    const resultado = await enviarCorreoCodigoReclamo({
      destinatario: info.email,
      nombre: nombre || 'participante',
      codigoReclamo: pago.uniqueClaimCode,
      tipoKit: pago.kitType,
      tallaCamiseta: info.shirtSize,
      idPago: pago.id,
      reintentarTrasError: Boolean(pago.emailError),
    });

    if (resultado?.omitido) {
      await pagosRepository.registrarErrorCorreo(
        pago.id,
        'RESEND_API_KEY no configurada'
      );
      return { enviado: false, motivo: 'resend_no_configurado' };
    }

    await pagosRepository.marcarCorreoEnviado(pago.id);
    return { enviado: true, idResend: resultado?.data?.id };
  } catch (error) {
    const mensaje = error?.message || 'Error desconocido al enviar correo';
    console.error('[correo] error al enviar a', info.email, mensaje);
    await pagosRepository.registrarErrorCorreo(pago.id, mensaje);
    return { enviado: false, motivo: mensaje };
  }
}

module.exports = { intentarEnviarCorreoReclamo };
