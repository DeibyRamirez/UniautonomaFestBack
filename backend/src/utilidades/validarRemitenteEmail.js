const { variablesEntorno } = require('../config/variablesEntorno');
const {
  validarRemitenteResend,
  extraerCorreoRemitente,
} = require('./validarRemitenteResend');
const { resolverDriver } = require('../services/email/email.factory');

function validarRemitenteEmail() {
  const driver = resolverDriver();

  if (driver === 'resend') {
    return validarRemitenteResend(variablesEntorno.resend.correoRemitente);
  }

  const correo = variablesEntorno.email.fromAddress;
  if (!correo || !correo.includes('@')) {
    return (
      'EMAIL_FROM_ADDRESS inválido en backend/.env. Ejemplo: no-reply@uniautonoma.edu.co'
    );
  }

  return null;
}

function obtenerCorreoRemitenteActivo() {
  const driver = resolverDriver();
  if (driver === 'resend') {
    return extraerCorreoRemitente(variablesEntorno.resend.correoRemitente);
  }
  return String(variablesEntorno.email.fromAddress || '').toLowerCase();
}

module.exports = { validarRemitenteEmail, obtenerCorreoRemitenteActivo };
