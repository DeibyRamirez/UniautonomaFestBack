const { SUBCOLECCIONES } = require('../repositories/eventos.repository');

const TIPOS_EVENTO = Object.keys(SUBCOLECCIONES);
const TIPOS_DOCUMENTO = ['CC', 'CE', 'TI', 'PAS', 'NIT'];

function validarCorreo(correo) {
  const normalizado = String(correo || '').trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizado)) {
    return { error: 'Correo electrónico inválido', correo: null };
  }
  return { error: null, correo: normalizado };
}

function validarTipoEvento(tipo) {
  if (!TIPOS_EVENTO.includes(tipo)) {
    return 'Tipo de evento inválido';
  }
  return null;
}

function validarDatosHackton(cuerpo) {
  const nombres = String(cuerpo?.nombres || '').trim();
  const apellidos = String(cuerpo?.apellidos || '').trim();
  const programa = String(cuerpo?.programa || '').trim();
  const codigoEstudiantil = String(cuerpo?.codigoEstudiantil || '').trim();

  if (!nombres) return 'Los nombres son obligatorios';
  if (!apellidos) return 'Los apellidos son obligatorios';
  if (!programa) return 'El programa es obligatorio';

  const { error, correo } = validarCorreo(cuerpo?.correoElectronico);
  if (error) return error;

  return {
    nombres,
    apellidos,
    correoElectronico: correo,
    programa,
    codigoEstudiantil: codigoEstudiantil || null,
  };
}

function validarDatosFeria(cuerpo) {
  const nombre = String(cuerpo?.nombre || '').trim();
  const apellido = String(cuerpo?.apellido || '').trim();
  const tipoDocumento = String(cuerpo?.tipoDocumento || '').trim().toUpperCase();
  const numeroDocumento = String(cuerpo?.numeroDocumento || '').trim();
  const telefono = String(cuerpo?.telefono || '').trim();
  const emprendimientoMarca = String(cuerpo?.emprendimientoMarca || '').trim();

  if (!nombre) return 'El nombre es obligatorio';
  if (!apellido) return 'El apellido es obligatorio';
  if (!tipoDocumento || !TIPOS_DOCUMENTO.includes(tipoDocumento)) {
    return 'Selecciona un tipo de documento válido';
  }
  if (!numeroDocumento) return 'El número de documento es obligatorio';
  if (!telefono) return 'El teléfono es obligatorio';

  const { error, correo } = validarCorreo(cuerpo?.correoElectronico);
  if (error) return error;

  return {
    nombre,
    apellido,
    tipoDocumento,
    numeroDocumento,
    telefono,
    correoElectronico: correo,
    emprendimientoMarca: emprendimientoMarca || null,
  };
}

function validarInscripcionEvento(tipoEvento, datos) {
  const errorTipo = validarTipoEvento(tipoEvento);
  if (errorTipo) return { error: errorTipo, datos: null };

  if (tipoEvento === 'Hackton') {
    const resultado = validarDatosHackton(datos);
    if (typeof resultado === 'string') return { error: resultado, datos: null };
    return { error: null, datos: resultado };
  }

  if (tipoEvento === 'FeriaEmprendimiento') {
    const resultado = validarDatosFeria(datos);
    if (typeof resultado === 'string') return { error: resultado, datos: null };
    return { error: null, datos: resultado };
  }

  return { error: 'Tipo de evento inválido', datos: null };
}

module.exports = {
  TIPOS_EVENTO,
  TIPOS_DOCUMENTO,
  validarTipoEvento,
  validarInscripcionEvento,
};
