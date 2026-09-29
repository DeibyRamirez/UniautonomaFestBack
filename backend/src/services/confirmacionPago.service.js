const pagosRepository = require('../repositories/pagos.repository');
const configuracionWompi = require('../config/wompi');
const { generarCodigoReclamo } = require('./codigoReclamo.service');
const { intentarEnviarCorreoReclamo } = require('./correoReclamo.service');

function detectarDiscrepancia(pago, { montoCentavos, moneda }) {
  const monto = Number(montoCentavos);
  if (!Number.isFinite(monto)) {
    return 'Wompi no reportó el monto de la transacción';
  }
  if (monto !== Number(pago.amount)) {
    return `Monto de Wompi (${monto}) distinto al del kit (${pago.amount})`;
  }
  if (String(moneda || '').toUpperCase() !== configuracionWompi.moneda) {
    return `Moneda de Wompi (${moneda || 'vacía'}) distinta a ${configuracionWompi.moneda}`;
  }
  return null;
}

/**
 * Aplica el estado reportado por Wompi (webhook o consulta API) sobre un pago en Firestore.
 */
async function aplicarEstadoTransaccion({
  reference,
  transactionId,
  estado,
  montoCentavos,
  moneda,
}) {
  if (!reference) {
    return { procesado: false, motivo: 'sin_referencia' };
  }

  let pago = await pagosRepository.buscarPorReferencia(reference);
  if (!pago) {
    return { procesado: false, motivo: 'pago_no_encontrado' };
  }

  if (pago.status === 'APPROVED') {
    await intentarEnviarCorreoReclamo(pago);
    return { procesado: true, idempotente: true, pago };
  }

  if (estado === 'APPROVED') {
    const discrepancia = detectarDiscrepancia(pago, { montoCentavos, moneda });
    if (discrepancia) {
      console.error('[pago] aprobación rechazada', reference, discrepancia);
      await pagosRepository.registrarAlertaPago(pago.id, discrepancia);
      return { procesado: false, motivo: 'discrepancia', detalle: discrepancia, pago };
    }

    const resultado = await pagosRepository.aprobarPagoAtomico(pago.id, {
      transactionId,
      generarCodigo: generarCodigoReclamo,
    });

    if (resultado.numeroCorredorError) {
      console.error('[numeroCorredor]', reference, resultado.numeroCorredorError);
    }

    pago = await pagosRepository.obtenerPorId(pago.id);
    await intentarEnviarCorreoReclamo(pago);

    return {
      procesado: true,
      aprobado: resultado.aprobado,
      idempotente: Boolean(resultado.idempotente),
      pago,
    };
  }

  if (['DECLINED', 'VOIDED', 'ERROR'].includes(estado)) {
    await pagosRepository.marcarRechazado(pago.id, transactionId);
    pago = await pagosRepository.obtenerPorId(pago.id);
    return { procesado: true, rechazado: pago?.status === 'REJECTED', pago };
  }

  return { procesado: false, motivo: 'estado_pendiente', pago };
}

module.exports = { aplicarEstadoTransaccion };
