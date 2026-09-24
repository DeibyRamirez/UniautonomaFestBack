const { variablesEntorno } = require('../config/variablesEntorno');
const configuracionWompi = require('../config/wompi');

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

module.exports = { getConfigPublica };
