const { Resend } = require('resend');
const { variablesEntorno } = require('./variablesEntorno');

let clienteResend = null;

function obtenerClienteResend() {
  if (!variablesEntorno.resend.apiKey) {
    return null;
  }
  if (!clienteResend) {
    clienteResend = new Resend(variablesEntorno.resend.apiKey);
  }
  return clienteResend;
}

module.exports = {
  obtenerClienteResend,
  correoRemitente: variablesEntorno.resend.correoRemitente,
};
