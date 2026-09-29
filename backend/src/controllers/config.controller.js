const { variablesEntorno } = require('../config/variablesEntorno');
const configuracionWompi = require('../config/wompi');
const {
  listarKitsPublicos,
  listarComponentesPublicos,
} = require('../config/catalogoKits');
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
    catalogo: {
      kits: listarKitsPublicos(),
      componentes: listarComponentesPublicos(),
    },
  });
}

function getCiudades(req, res) {
  return res.json({ ciudades: listarCiudades() });
}

module.exports = { getConfigPublica, getCiudades };
