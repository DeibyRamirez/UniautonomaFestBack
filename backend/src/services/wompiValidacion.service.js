let llaveValidadaEnProceso = null;

function urlBaseWompiDesdeLlave(llave) {
  if (!llave) return null;
  if (llave.startsWith('pub_test_') || llave.startsWith('prv_test_')) {
    return 'https://sandbox.wompi.co/v1';
  }
  if (llave.startsWith('pub_prod_') || llave.startsWith('prv_prod_')) {
    return 'https://production.wompi.co/v1';
  }
  return null;
}

function urlBaseWompi(llavePublica) {
  return urlBaseWompiDesdeLlave(llavePublica);
}

function validarFormatoLlavePublica(llavePublica) {
  if (!llavePublica) {
    const err = new Error('WOMPI_PUBLIC_KEY vacía en backend/.env');
    err.codigo = 500;
    throw err;
  }

  if (!urlBaseWompi(llavePublica)) {
    const err = new Error(
      'WOMPI_PUBLIC_KEY inválida: debe empezar por pub_test_ (sandbox) o pub_prod_ (producción)'
    );
    err.codigo = 500;
    throw err;
  }
}

function validarFormatoLlavePrivada(llavePrivada) {
  if (!llavePrivada) {
    const err = new Error('WOMPI_PRIVATE_KEY no configurada en backend/.env');
    err.codigo = 500;
    throw err;
  }

  if (!llavePrivada.startsWith('prv_test_') && !llavePrivada.startsWith('prv_prod_')) {
    const err = new Error(
      'WOMPI_PRIVATE_KEY inválida: debe empezar por prv_test_ (sandbox) o prv_prod_ (producción)'
    );
    err.codigo = 500;
    throw err;
  }

  if (!urlBaseWompiDesdeLlave(llavePrivada)) {
    const err = new Error('WOMPI_PRIVATE_KEY no configurada o inválida');
    err.codigo = 500;
    throw err;
  }
}

async function validarLlavePublicaComercio(llavePublica) {
  validarFormatoLlavePublica(llavePublica);

  if (llaveValidadaEnProceso === llavePublica) {
    return;
  }

  const base = urlBaseWompi(llavePublica);
  const url = `${base}/merchants/${encodeURIComponent(llavePublica)}`;
  const respuesta = await fetch(url, {
    headers: {
      Authorization: `Bearer ${llavePublica}`,
    },
  });

  if (respuesta.status === 404) {
    const err = new Error(
      'La llave pública WOMPI_PUBLIC_KEY no existe en Wompi (404). ' +
        'Copia de nuevo pub_test_... desde https://comercios.wompi.co → Desarrolladores → Llaves, ' +
        'modo Sandbox activado, sin espacios ni comillas.'
    );
    err.codigo = 502;
    throw err;
  }

  if (!respuesta.ok) {
    const err = new Error(
      `Wompi rechazó la llave pública (HTTP ${respuesta.status}). Revisa el comercio y el entorno sandbox/producción.`
    );
    err.codigo = 502;
    throw err;
  }

  llaveValidadaEnProceso = llavePublica;
}

module.exports = {
  validarLlavePublicaComercio,
  validarFormatoLlavePublica,
  validarFormatoLlavePrivada,
  urlBaseWompi,
  urlBaseWompiDesdeLlave,
};
