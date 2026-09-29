const configuracionWompi = require('../config/wompi');
const { urlBaseWompi } = require('./wompiValidacion.service');

const TIMEOUT_WOMPI_MS = 8000;

async function consultarTransaccionPorId(transactionId) {
  const llave = configuracionWompi.llavePublica;
  const base = urlBaseWompi(llave);
  if (!base) {
    const err = new Error('WOMPI_PUBLIC_KEY inválida para consultar transacciones');
    err.codigo = 500;
    throw err;
  }

  if (!transactionId || typeof transactionId !== 'string') {
    const err = new Error('transactionId requerido');
    err.codigo = 400;
    throw err;
  }

  const url = `${base}/transactions/${encodeURIComponent(transactionId.trim())}`;
  let respuesta;
  try {
    respuesta = await fetch(url, {
      headers: { Authorization: `Bearer ${llave}` },
      signal: AbortSignal.timeout(TIMEOUT_WOMPI_MS),
    });
  } catch (error) {
    const esTimeout = error?.name === 'TimeoutError' || error?.name === 'AbortError';
    const err = new Error(
      esTimeout
        ? 'Wompi tardó demasiado en responder. Tu pago se confirmará automáticamente en unos minutos.'
        : 'No se pudo conectar con Wompi para verificar el pago'
    );
    err.codigo = 504;
    throw err;
  }

  if (respuesta.status === 404) {
    const err = new Error('Transacción no encontrada en Wompi');
    err.codigo = 404;
    throw err;
  }

  if (!respuesta.ok) {
    const err = new Error(`Wompi no permitió consultar la transacción (HTTP ${respuesta.status})`);
    err.codigo = 502;
    throw err;
  }

  const cuerpo = await respuesta.json();
  const transaccion = cuerpo?.data;
  if (!transaccion?.id) {
    const err = new Error('Respuesta inválida de Wompi al consultar transacción');
    err.codigo = 502;
    throw err;
  }

  return transaccion;
}

module.exports = { consultarTransaccionPorId };
