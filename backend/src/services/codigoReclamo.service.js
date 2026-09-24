const crypto = require('crypto');

function generarReferenciaPago() {
  const sufijo = crypto.randomBytes(5).toString('hex').toUpperCase();
  return `UAF26-PAY-${sufijo}`;
}

function generarCodigoReclamo() {
  const sufijo = crypto.randomBytes(3).toString('hex').toUpperCase();
  return `UAF26-${sufijo}`;
}

module.exports = {
  generarReferenciaPago,
  generarCodigoReclamo,
};
