function urlBaseWompi(llavePublica) {
  if (llavePublica.startsWith('pub_test_')) {
    return 'https://sandbox.wompi.co/v1';
  }
  if (llavePublica.startsWith('pub_prod_')) {
    return 'https://production.wompi.co/v1';
  }
  return null;
}

async function validarLlavePublicaComercio(llavePublica) {
  if (!llavePublica) {
    const err = new Error('WOMPI_PUBLIC_KEY vacía en backend/.env');
    err.codigo = 500;
    throw err;
  }

  const base = urlBaseWompi(llavePublica);
  if (!base) {
    const err = new Error(
      'WOMPI_PUBLIC_KEY inválida: debe empezar por pub_test_ (sandbox) o pub_prod_ (producción)'
    );
    err.codigo = 500;
    throw err;
  }

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
}

module.exports = { validarLlavePublicaComercio, urlBaseWompi };
