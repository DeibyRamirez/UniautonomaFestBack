const fs = require('fs');
const path = require('path');

const RUTA_DATOS = path.join(__dirname, '../data/ciudades-colombia.json');

let ciudadesCache = null;
let etiquetasValidasCache = null;

function cargarCiudades() {
  if (ciudadesCache) return ciudadesCache;

  const contenido = fs.readFileSync(RUTA_DATOS, 'utf8');
  ciudadesCache = JSON.parse(contenido);
  etiquetasValidasCache = new Set(ciudadesCache.map((ciudad) => ciudad.etiqueta));
  return ciudadesCache;
}

function listarCiudades() {
  return cargarCiudades();
}

function esCiudadResidenciaValida(valor) {
  const etiqueta = String(valor || '').trim();
  if (!etiqueta) return false;
  cargarCiudades();
  return etiquetasValidasCache.has(etiqueta);
}

module.exports = {
  listarCiudades,
  esCiudadResidenciaValida,
};
