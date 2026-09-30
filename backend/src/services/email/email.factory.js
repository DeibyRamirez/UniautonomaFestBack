const { variablesEntorno } = require('../../config/variablesEntorno');
const resendProvider = require('./resend.provider');
const smtpProvider = require('./smtp.provider');

const PROVEEDORES = {
  resend: resendProvider,
  smtp: smtpProvider,
};

function resolverDriver() {
  const driver = variablesEntorno.email.driver;
  if (driver === 'resend' || driver === 'smtp') {
    return driver;
  }
  return variablesEntorno.email.usoResend ? 'resend' : 'smtp';
}

function obtenerProveedor(nombre) {
  return PROVEEDORES[nombre] || null;
}

function obtenerProveedorPrincipal() {
  return obtenerProveedor(resolverDriver());
}

function obtenerProveedorSecundario() {
  const principal = resolverDriver();
  return obtenerProveedor(principal === 'resend' ? 'smtp' : 'resend');
}

/**
 * @param {import('../../types/email').SendEmailPayload} payload
 * @returns {Promise<import('../../types/email').SendEmailResult>}
 */
async function enviarCorreo(payload) {
  const principal = obtenerProveedorPrincipal();
  const secundario = obtenerProveedorSecundario();
  const fallback = variablesEntorno.email.fallbackHabilitado;

  const resultadoPrincipal = await principal.sendEmail(payload);

  if (resultadoPrincipal.success) {
    return resultadoPrincipal;
  }

  if (resultadoPrincipal.omitido && !fallback) {
    return resultadoPrincipal;
  }

  if (!fallback) {
    if (resultadoPrincipal.error) {
      throw resultadoPrincipal.error;
    }
    return resultadoPrincipal;
  }

  console.warn(
    `[correo] fallback a ${secundario.proveedor}: falló ${principal.proveedor}`,
    resultadoPrincipal.error?.message || 'proveedor no configurado'
  );

  const resultadoSecundario = await secundario.sendEmail(payload);

  if (resultadoSecundario.success) {
    return resultadoSecundario;
  }

  if (resultadoSecundario.error) {
    throw resultadoSecundario.error;
  }

  return resultadoSecundario;
}

module.exports = {
  resolverDriver,
  obtenerProveedorPrincipal,
  obtenerProveedorSecundario,
  enviarCorreo,
};
