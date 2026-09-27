const { variablesEntorno } = require('../config/variablesEntorno');
const configuracionWompi = require('../config/wompi');
const { listarCiudades } = require('../services/ciudadesColombia.service');

function getConfigPublica(req, res) {
  return res.json({
    firebase: {
      apiKey: variablesEntorno.firebase.apiKey,
      authDomain: variablesEntorno.firebase.authDomain,
      projectId: variablesEntorno.firebase.projectId,
    },
    wompi: {
      llavePublica: configuracionWompi.llavePublica,
    },
    montos: variablesEntorno.montos,
  });
}

function getCiudades(req, res) {
  return res.json({ ciudades: listarCiudades() });
}

module.exports = { getConfigPublica, getCiudades };
