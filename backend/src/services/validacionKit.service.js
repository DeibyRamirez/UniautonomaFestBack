const {
  DOMINIO_INSTITUCIONAL,
  obtenerDefinicionKit,
  normalizarKitType,
  validarComponentes,
  obtenerPrecioKit,
  ordenarComponentes,
  requiereTallaCamiseta,
  esRolEstudiante,
  esRolInstitucionalValido,
  esCarreraValida,
} = require('../config/catalogoKits');
const { esCiudadResidenciaValida } = require('./ciudadesColombia.service');
const {
  LIMITES,
  validarTextoNombre,
  validarSoloNumeros,
} = require('../utilidades/validacionCamposFormulario');

const TALLAS_VALIDAS = ['S', 'M', 'L', 'XL'];
const TIPOS_DOCUMENTO = ['CC', 'CE', 'TI', 'PAS', 'NIT'];

const MENSAJE_SOLO_UNIAUTONOMOS =
  'Este kit es solo para la comunidad uniautónoma. Usa tu correo institucional';
const MENSAJE_KIT_EXTERNO =
  'Este kit es para participantes externos. Usa un correo personal o elige Kit Sangre Azul / Arma tu kit.';

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

  if (!String(personalInfo.residenceCity || '').trim()) {
    return 'La ciudad de residencia es obligatoria';
  }

  if (!esCiudadResidenciaValida(personalInfo.residenceCity)) {
    return 'Selecciona una ciudad de residencia válida';
  }

  return null;
}

function validarRolYCarreraInstitucional(kitType, personalInfo) {
  const tipoNormalizado = normalizarKitType(kitType);
  if (tipoNormalizado !== 'uniautonomo' && tipoNormalizado !== 'personalizado') {
    return null;
  }

  const rol = String(personalInfo.participantRole || '').trim();
  if (!rol) {
    return 'Selecciona tu rol en la universidad';
  }
  if (!esRolInstitucionalValido(rol)) {
    return 'Selecciona un rol válido';
  }

  if (esRolEstudiante(rol)) {
    const errorCodigo = validarSoloNumeros(personalInfo.studentCode, {
      obligatorio: true,
      etiqueta: 'Código de estudiante',
      max: LIMITES.codigoEstudiante,
    });
    if (errorCodigo) return errorCodigo;

    const carrera = String(personalInfo.academicCareer || '').trim();
    if (!carrera) {
      return 'Selecciona tu carrera académica';
    }
    if (!esCarreraValida(carrera)) {
      return 'Selecciona una carrera académica válida';
    }
  } else {
    const codigo = String(personalInfo.studentCode || '').trim();
    if (codigo) {
      const errorCodigo = validarSoloNumeros(personalInfo.studentCode, {
        etiqueta: 'Código de estudiante',
        max: LIMITES.codigoEstudiante,
      });
      if (errorCodigo) return errorCodigo;
    }
  }

  return null;
}

function validarTallaCamiseta(kitType, kitComponents, personalInfo) {
  if (!requiereTallaCamiseta(kitType, kitComponents)) {
    return null;
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
    return MENSAJE_SOLO_UNIAUTONOMOS;
  }

  if (!definicion.requiereCorreoInstitucional && esInstitucional) {
    return MENSAJE_KIT_EXTERNO;
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

function normalizarInformacionPersonal(personalInfo, { kitType, kitComponents } = {}) {
  const tipoNormalizado = kitType ? normalizarKitType(kitType) : null;
  const esInstitucionalKit =
    tipoNormalizado === 'uniautonomo' || tipoNormalizado === 'personalizado';

  const rol = esInstitucionalKit
    ? String(personalInfo.participantRole || '').trim()
    : '';
  const esEstudiante = esRolEstudiante(rol);

  const info = {
    firstName: String(personalInfo.firstName).trim(),
    secondName: String(personalInfo.secondName || '').trim(),
    firstSurname: String(personalInfo.firstSurname).trim(),
    secondSurname: String(personalInfo.secondSurname || '').trim(),
    documentType: String(personalInfo.documentType).trim().toUpperCase(),
    documentNumber: String(personalInfo.documentNumber).trim(),
    residenceCity: String(personalInfo.residenceCity).trim(),
    address: String(personalInfo.address || '').trim(),
    email: String(personalInfo.email).trim().toLowerCase(),
    participantRole: rol,
    academicCareer: esEstudiante ? String(personalInfo.academicCareer || '').trim() : '',
    studentCode: esEstudiante ? String(personalInfo.studentCode || '').trim() : '',
    shirtSize: String(personalInfo.shirtSize || '').trim().toUpperCase(),
  };

  if (kitType && !requiereTallaCamiseta(kitType, kitComponents || [])) {
    info.shirtSize = '';
  }

  return info;
}

function validarSolicitudCheckout({ kitType, kitComponents, personalInfo }) {
  const tipoNormalizado = normalizarKitType(kitType);

  let error = validarTipoKit(tipoNormalizado);
  if (error) return error;

  error = validarInformacionPersonal(personalInfo);
  if (error) return error;

  const componentesNormalizados = normalizarKitComponents(kitComponents);
  const infoNormalizada = normalizarInformacionPersonal(personalInfo, {
    kitType: tipoNormalizado,
    kitComponents: componentesNormalizados,
  });

  error = validarReglasKit(tipoNormalizado, infoNormalizada, componentesNormalizados);
  if (error) return error;

  error = validarRolYCarreraInstitucional(tipoNormalizado, infoNormalizada);
  if (error) return error;

  error = validarTallaCamiseta(tipoNormalizado, componentesNormalizados, infoNormalizada);
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
