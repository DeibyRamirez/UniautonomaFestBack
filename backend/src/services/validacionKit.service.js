const { variablesEntorno } = require('../config/variablesEntorno');

const DOMINIO_INSTITUCIONAL = '@uniautonoma.edu.co';
const TIPOS_KIT = ['uniautonomo', 'general'];
const TALLAS_VALIDAS = ['S', 'M', 'L', 'XL'];

function validarTipoKit(kitType) {
  if (!TIPOS_KIT.includes(kitType)) {
    return 'Tipo de kit inválido. Use uniautonomo o general.';
  }
  return null;
}

function validarInformacionPersonal(personalInfo) {
  if (!personalInfo || typeof personalInfo !== 'object') {
    return 'Información personal requerida';
  }

  const campos = [
    'firstName',
    'firstSurname',
    'email',
  ];

  for (const campo of campos) {
    if (!String(personalInfo[campo] || '').trim()) {
      return `El campo ${campo} es obligatorio`;
    }
  }

  const email = String(personalInfo.email).trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return 'Correo electrónico inválido';
  }

  const talla = String(personalInfo.shirtSize || '').trim().toUpperCase();
  if (!TALLAS_VALIDAS.includes(talla)) {
    return 'Selecciona una talla de camiseta válida (S, M, L o XL)';
  }

  return null;
}

function validarReglasKitUniautonomo(kitType, personalInfo) {
  const email = String(personalInfo.email).trim().toLowerCase();

  if (kitType !== 'uniautonomo') {
    return null;
  }

  if (!email.endsWith(DOMINIO_INSTITUCIONAL)) {
    return `Para el kit uniautónomo el correo debe terminar en ${DOMINIO_INSTITUCIONAL}`;
  }

  if (!String(personalInfo.studentCode || '').trim()) {
    return 'El código de estudiante es obligatorio para el kit uniautónomo';
  }

  return null;
}

function obtenerMontoCentavos(kitType) {
  if (kitType === 'uniautonomo') {
    return variablesEntorno.montos.uniautonomo;
  }
  return variablesEntorno.montos.general;
}

function normalizarInformacionPersonal(personalInfo) {
  return {
    firstName: String(personalInfo.firstName).trim(),
    secondName: String(personalInfo.secondName || '').trim(),
    firstSurname: String(personalInfo.firstSurname).trim(),
    secondSurname: String(personalInfo.secondSurname || '').trim(),
    email: String(personalInfo.email).trim().toLowerCase(),
    studentCode: String(personalInfo.studentCode || '').trim(),
    shirtSize: String(personalInfo.shirtSize || '').trim().toUpperCase(),
  };
}

function validarSolicitudCheckout({ kitType, personalInfo }) {
  let error = validarTipoKit(kitType);
  if (error) return error;

  error = validarInformacionPersonal(personalInfo);
  if (error) return error;

  const infoNormalizada = normalizarInformacionPersonal(personalInfo);
  error = validarReglasKitUniautonomo(kitType, infoNormalizada);
  if (error) return error;

  return null;
}

module.exports = {
  validarSolicitudCheckout,
  obtenerMontoCentavos,
  normalizarInformacionPersonal,
};
