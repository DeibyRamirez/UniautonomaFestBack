const configuracionWompi = require('../config/wompi');
const { urlBaseWompi } = require('./wompiValidacion.service');

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
  const respuesta = await fetch(url, {
    headers: { Authorization: `Bearer ${llave}` },
  });

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
