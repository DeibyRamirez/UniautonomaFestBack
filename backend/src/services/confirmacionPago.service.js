const pagosRepository = require('../repositories/pagos.repository');
const { generarCodigoReclamo } = require('./codigoReclamo.service');
const { intentarEnviarCorreoReclamo } = require('./correoReclamo.service');

/**
 * Aplica el estado reportado por Wompi (webhook o consulta API) sobre un pago en Firestore.
 */
async function aplicarEstadoTransaccion({ reference, transactionId, estado }) {
  if (!reference) {
    return { procesado: false, motivo: 'sin_referencia' };
  }

  let pago = await pagosRepository.buscarPorReferencia(reference);
  if (!pago) {
    return { procesado: false, motivo: 'pago_no_encontrado' };
  }

  if (pago.status === 'APPROVED') {
    await intentarEnviarCorreoReclamo(pago);
    return {
      procesado: true,
      idempotente: true,
      pago,
      uniqueClaimCode: pago.uniqueClaimCode,
    };
  }

  if (estado === 'APPROVED') {
    const codigoReclamo = generarCodigoReclamo();
    await pagosRepository.marcarAprobado(pago.id, {
      transactionId,
      uniqueClaimCode: codigoReclamo,
    });

    pago = await pagosRepository.obtenerPorId(pago.id);
    await intentarEnviarCorreoReclamo(pago);

    return {
      procesado: true,
      aprobado: true,
      codigoReclamo,
      pago,
      uniqueClaimCode: codigoReclamo,
    };
  }

  if (['DECLINED', 'VOIDED', 'ERROR'].includes(estado)) {
    await pagosRepository.marcarRechazado(pago.id, transactionId);
    pago = await pagosRepository.obtenerPorId(pago.id);
    return { procesado: true, rechazado: true, pago };
  }

  return { procesado: false, motivo: 'estado_pendiente', pago };
}

module.exports = { aplicarEstadoTransaccion };
