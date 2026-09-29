const {
  DOMINIO_INSTITUCIONAL,
  obtenerDefinicionKit,
  normalizarKitType,
  validarComponentes,
  obtenerPrecioKit,
  ordenarComponentes,
} = require('../config/catalogoKits');
const { esCiudadResidenciaValida } = require('./ciudadesColombia.service');
const {
  validarTextoNombre,
  validarSoloNumeros,
} = require('../utilidades/validacionCamposFormulario');

const TALLAS_VALIDAS = ['S', 'M', 'L', 'XL'];
const TIPOS_DOCUMENTO = ['CC', 'CE', 'TI', 'PAS', 'NIT'];

function validarTipoKit(kitType) {
  const definicion = obtenerDefinicionKit(kitType);
  if (!definicion) {
    return 'Tipo de kit inválido.';
  }
  return null;
}

function validarInformacionPersonal(personalInfo) {
  if (!personalInfo || typeof personalInfo !== 'object') {
    return 'Información personal requerida';
  }

  const campos = ['firstName', 'firstSurname', 'email'];

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

function validarReglasKit(kitType, personalInfo, kitComponents) {
  const definicion = obtenerDefinicionKit(kitType);
  if (!definicion) return 'Tipo de kit inválido.';

  const email = String(personalInfo.email).trim().toLowerCase();
  const esInstitucional = email.endsWith(DOMINIO_INSTITUCIONAL);

  if (definicion.requiereCorreoInstitucional && !esInstitucional) {
    return 'Correo electrónico inválido';
  }

  if (!definicion.requiereCorreoInstitucional && esInstitucional) {
    return `El correo institucional no puede usarse para el kit externo. Usa un correo personal o elige un kit uniautónomo.`;
  }

  if (definicion.requiereCodigoEstudiante && !String(personalInfo.studentCode || '').trim()) {
    return 'El código de estudiante es obligatorio para este kit';
  }

  if (definicion.requiereCodigoEstudiante) {
    const errorCodigo = validarSoloNumeros(personalInfo.studentCode, {
      etiqueta: 'Código de estudiante',
      max: 20,
    });
    if (errorCodigo) return errorCodigo;
  }

  if (definicion.esPersonalizable) {
    return validarComponentes(kitComponents);
  }

  return null;
}

function obtenerMontoCentavos(kitType, kitComponents = []) {
  return obtenerPrecioKit(kitType, kitComponents);
}

function normalizarKitComponents(kitComponents) {
  if (!Array.isArray(kitComponents)) return [];
  return ordenarComponentes(
    kitComponents.map((c) => String(c || '').trim()).filter(Boolean)
  );
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

function validarSolicitudCheckout({ kitType, kitComponents, personalInfo }) {
  const tipoNormalizado = normalizarKitType(kitType);

  let error = validarTipoKit(tipoNormalizado);
  if (error) return error;

  error = validarInformacionPersonal(personalInfo);
  if (error) return error;

  const infoNormalizada = normalizarInformacionPersonal(personalInfo);
  const componentesNormalizados = normalizarKitComponents(kitComponents);

  error = validarReglasKit(tipoNormalizado, infoNormalizada, componentesNormalizados);
  if (error) return error;

  const monto = obtenerMontoCentavos(tipoNormalizado, componentesNormalizados);
  if (!monto || monto <= 0) {
    return 'No se pudo calcular el monto del kit.';
  }

  return null;
}

module.exports = {
  validarSolicitudCheckout,
  obtenerMontoCentavos,
  normalizarInformacionPersonal,
  normalizarKitType,
  normalizarKitComponents,
};
