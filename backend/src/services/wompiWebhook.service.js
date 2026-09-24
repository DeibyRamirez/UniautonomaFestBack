const { aplicarEstadoTransaccion } = require('./confirmacionPago.service');

async function procesarEventoWompi(cuerpo) {
  const tipoEvento = cuerpo?.event;
  if (tipoEvento !== 'transaction.updated') {
    return { procesado: false, motivo: 'evento_ignorado' };
  }

  const transaccion = cuerpo?.data?.transaction;
  if (!transaccion) {
    return { procesado: false, motivo: 'sin_transaccion' };
  }

  return aplicarEstadoTransaccion({
    reference: transaccion.reference,
    transactionId: transaccion.id,
    estado: transaccion.status,
  });
}

module.exports = { procesarEventoWompi };
