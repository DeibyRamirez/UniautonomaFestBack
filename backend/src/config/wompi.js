const { variablesEntorno } = require('./variablesEntorno');

module.exports = {
  llavePublica: variablesEntorno.wompi.llavePublica,
  llavePrivada: variablesEntorno.wompi.llavePrivada,
  secretoIntegridad: variablesEntorno.wompi.secretoIntegridad,
  secretoEventos: variablesEntorno.wompi.secretoEventos,
  moneda: 'COP',
  urlCheckout: 'https://checkout.wompi.co/p/',
};
