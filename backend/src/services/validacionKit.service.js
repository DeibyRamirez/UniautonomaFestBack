const { variablesEntorno } = require('../config/variablesEntorno');
const { esCiudadResidenciaValida } = require('./ciudadesColombia.service');
const {
  validarTextoNombre,
  validarSoloNumeros,
} = require('../utilidades/validacionCamposFormulario');

const DOMINIO_INSTITUCIONAL = '@uniautonoma.edu.co';
const TIPOS_KIT = ['uniautonomo', 'general'];
const TALLAS_VALIDAS = ['S', 'M', 'L', 'XL'];
const TIPOS_DOCUMENTO = ['CC', 'CE', 'TI', 'PAS', 'NIT'];

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

  let error = validarTextoNombre(personalInfo.firstName, { etiqueta: 'Primer nombre' });
  if (error) return error;
  error = validarTextoNombre(personalInfo.secondName, { obligatorio: false, etiqueta: 'Segundo nombre' });
  if (error) return error;
  error = validarTextoNombre(personalInfo.firstSurname, { etiqueta: 'Primer apellido' });
  if (error) return error;
  error = validarTextoNombre(personalInfo.secondSurname, { obligatorio: false, etiqueta: 'Segundo apellido' });
  if (error) return error;

  error = validarSoloNumeros(personalInfo.documentNumber, { etiqueta: 'Número de documento' });
  if (error) return error;

  const email = String(personalInfo.email).trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return 'Correo electrónico inválido';
  }

  const tipoDocumento = String(personalInfo.documentType || '').trim().toUpperCase();
  if (!tipoDocumento || !TIPOS_DOCUMENTO.includes(tipoDocumento)) {
    return 'Selecciona un tipo de documento válido';
  }

  error = validarSoloNumeros(personalInfo.studentCode, {
    obligatorio: false,
    etiqueta: 'Código de estudiante',
    max: 20,
  });
  if (error) return error;

  if (!String(personalInfo.residenceCity || '').trim()) {
    return 'La ciudad de residencia es obligatoria';
  }

  if (!esCiudadResidenciaValida(personalInfo.residenceCity)) {
    return 'Selecciona una ciudad de residencia válida';
  }

  if (!String(personalInfo.address || '').trim()) {
    return 'La dirección es obligatoria';
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

  return validarSoloNumeros(personalInfo.studentCode, {
    etiqueta: 'Código de estudiante',
    max: 20,
  });
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
    documentType: String(personalInfo.documentType).trim().toUpperCase(),
    documentNumber: String(personalInfo.documentNumber).trim(),
    residenceCity: String(personalInfo.residenceCity).trim(),
    address: String(personalInfo.address).trim(),
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
