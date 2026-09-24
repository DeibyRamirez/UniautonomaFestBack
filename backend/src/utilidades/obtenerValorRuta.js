/**
 * Resuelve una ruta con puntos (p. ej. transaction.id) sobre un objeto.
 */
function obtenerValorRuta(objeto, ruta) {
  if (!objeto || !ruta) return undefined;
  return ruta.split('.').reduce((acumulado, clave) => {
    if (acumulado === undefined || acumulado === null) return undefined;
    return acumulado[clave];
  }, objeto);
}

module.exports = { obtenerValorRuta };
