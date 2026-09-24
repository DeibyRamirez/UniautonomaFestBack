const crypto = require('crypto');
const configuracionWompi = require('../config/wompi');

function calcularFirmaIntegridad({ reference, amountInCents, expirationTime }) {
  const secreto = configuracionWompi.secretoIntegridad;
  if (!secreto) {
    throw new Error('WOMPI_INTEGRITY_SECRET no configurado');
  }

  let cadena = `${reference}${amountInCents}${configuracionWompi.moneda}`;
  if (expirationTime) {
    cadena += expirationTime;
  }
  cadena += secreto;

  return crypto.createHash('sha256').update(cadena).digest('hex');
}

module.exports = { calcularFirmaIntegridad };
