const REGEX_TEXTO_NOMBRE = /^[A-Za-zÁÉÍÓÚáéíóúÑñÜü\s'-]+$/;
const REGEX_SOLO_NUMEROS = /^\d+$/;

const LIMITES = {
  nombre: 80,
  documento: 20,
  codigoEstudiante: 20,
};

function validarTextoNombre(valor, { obligatorio = true, etiqueta = 'Nombre' } = {}) {
  const texto = String(valor ?? '').trim();
  if (!texto) {
    return obligatorio ? `${etiqueta} es obligatorio` : null;
  }
  if (texto.length > LIMITES.nombre) {
    return `${etiqueta} demasiado largo`;
  }
  if (!REGEX_TEXTO_NOMBRE.test(texto)) {
    return `${etiqueta} solo puede contener letras`;
  }
  return null;
}

function validarSoloNumeros(valor, { obligatorio = true, etiqueta = 'Campo', max = LIMITES.documento } = {}) {
  const texto = String(valor ?? '').trim();
  if (!texto) {
    return obligatorio ? `${etiqueta} es obligatorio` : null;
  }
  if (texto.length > max) {
    return `${etiqueta} demasiado largo`;
  }
  if (!REGEX_SOLO_NUMEROS.test(texto)) {
    return `${etiqueta} solo puede contener números`;
  }
  return null;
}

module.exports = {
  REGEX_TEXTO_NOMBRE,
  REGEX_SOLO_NUMEROS,
  LIMITES,
  validarTextoNombre,
  validarSoloNumeros,
};
