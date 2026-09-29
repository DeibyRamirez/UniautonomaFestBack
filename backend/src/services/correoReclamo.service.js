const pagosRepository = require('../repositories/pagos.repository');
const { enviarCorreoCodigoReclamo } = require('./correo.service');

const TIMEOUT_CORREO_MS = 8000;
const TIEMPO_AGOTADO = Symbol('tiempoAgotado');

async function intentarEnviarCorreoReclamo(pago, opciones = {}) {
  const forzarReenvio = Boolean(opciones.forzarReenvio);

  if (!pago?.id || !pago.uniqueClaimCode) {
    return { enviado: false, motivo: 'sin_codigo' };
  }

  if (!forzarReenvio && pago.emailEnviadoEn) {
    return { enviado: true, idempotente: true };
  }

  const info = pago.personalInfo || {};
  const nombre = [info.firstName, info.firstSurname].filter(Boolean).join(' ');

  let temporizador;
  const limiteTiempo = new Promise((resolver) => {
    temporizador = setTimeout(() => resolver(TIEMPO_AGOTADO), TIMEOUT_CORREO_MS);
  });

  try {
    const envio = enviarCorreoCodigoReclamo({
      destinatario: info.email,
      nombre: nombre || 'participante',
      codigoReclamo: pago.uniqueClaimCode,
      numeroCorredor: pago.numeroCorredor || null,
      tipoKit: pago.kitType,
      kitComponents: pago.kitComponents,
      tallaCamiseta: info.shirtSize,
      idPago: pago.id,
      reintentarTrasError: forzarReenvio || Boolean(pago.emailError),
    });

    const resultado = await Promise.race([envio, limiteTiempo]);

    // Sin registrar error: la clave de idempotencia de Resend evita duplicados en el próximo intento.
    if (resultado === TIEMPO_AGOTADO) {
      console.warn('[correo] Resend no respondió a tiempo para', info.email);
      envio.catch(() => {});
      return { enviado: false, motivo: 'timeout' };
    }

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
  } finally {
    clearTimeout(temporizador);
  }
}

module.exports = { intentarEnviarCorreoReclamo };
