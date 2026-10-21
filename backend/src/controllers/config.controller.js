const { variablesEntorno } = require('../config/variablesEntorno');
const configuracionWompi = require('../config/wompi');
const {
  listarKitsPublicos,
  listarComponentesPublicos,
} = require('../config/catalogoKits');
const { listarCiudades } = require('../services/ciudadesColombia.service');
const { listarParaPublico } = require('../services/tallasCamiseta.service');
const {
  obtenerConfig: obtenerConfigVitrina,
  listarParaPublico: listarVitrinaParaPublico,
} = require('../services/vitrinaPublica.service');

async function getConfigPublica(req, res) {
  let tallasCamiseta = [];
  try {
    tallasCamiseta = await listarParaPublico();
  } catch (error) {
    console.error('[config publica tallas]', error);
  }

  let vitrinaPublica = null;
  try {
    const configVitrina = await obtenerConfigVitrina();
    vitrinaPublica = listarVitrinaParaPublico(configVitrina);
  } catch (error) {
    console.error('[config publica vitrina]', error);
  }

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
    tallasCamiseta,
    vitrinaPublica,
  });
}

function getCiudades(req, res) {
  return res.json({ ciudades: listarCiudades() });
}

module.exports = { getConfigPublica, getCiudades };
