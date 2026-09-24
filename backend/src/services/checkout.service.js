const pagosRepository = require('../repositories/pagos.repository');
const configuracionWompi = require('../config/wompi');
const { variablesEntorno } = require('../config/variablesEntorno');
const {
  validarSolicitudCheckout,
  obtenerMontoCentavos,
  normalizarInformacionPersonal,
} = require('./validacionKit.service');
const { generarReferenciaPago } = require('./codigoReclamo.service');
const { calcularFirmaIntegridad } = require('./wompiIntegridad.service');
const { validarLlavePublicaComercio } = require('./wompiValidacion.service');
const { intentarEnviarCorreoReclamo } = require('./correoReclamo.service');
const { aplicarEstadoTransaccion } = require('./confirmacionPago.service');
const { consultarTransaccionPorId } = require('./wompiTransaccion.service');

function construirRespuestaInicio({ pago, reference, amount }) {
  const signatureIntegrity = calcularFirmaIntegridad({
    reference,
    amountInCents: amount,
  });

  return {
    paymentId: pago.id,
    reference,
    amountInCents: amount,
    currency: configuracionWompi.moneda,
    publicKey: configuracionWompi.llavePublica,
    signatureIntegrity,
    redirectUrl: `${variablesEntorno.urlBase}/#kit`,
    checkoutUrl: configuracionWompi.urlCheckout,
  };
}

async function iniciarCheckout({ kitType, personalInfo }) {
  const errorValidacion = validarSolicitudCheckout({ kitType, personalInfo });
  if (errorValidacion) {
    const err = new Error(errorValidacion);
    err.codigo = 400;
    throw err;
  }

  if (!configuracionWompi.llavePublica) {
    const err = new Error('WOMPI_PUBLIC_KEY no configurada en el servidor');
    err.codigo = 500;
    throw err;
  }

  await validarLlavePublicaComercio(configuracionWompi.llavePublica);

  const info = normalizarInformacionPersonal(personalInfo);
  const amount = obtenerMontoCentavos(kitType);

  let pago = await pagosRepository.buscarPendienteReciente({
    email: info.email,
    kitType,
    amount,
  });

  let reference;

  if (pago) {
    reference = pago.reference;
    await pagosRepository.actualizarInformacionPendiente(pago.id, {
      personalInfo: info,
    });
  } else {
    reference = generarReferenciaPago();
    pago = await pagosRepository.crearPagoPendiente({
      reference,
      personalInfo: info,
      kitType,
      amount,
    });
  }

  return construirRespuestaInicio({ pago, reference, amount });
}

function respuestaEstadoDesdePago(pago) {
  return {
    status: pago.status,
    uniqueClaimCode: pago.uniqueClaimCode,
    kitType: pago.kitType,
    emailEnviado: Boolean(pago.emailEnviadoEn),
  };
}

async function confirmarPagoCheckout({ reference, transactionId }) {
  if (!reference || typeof reference !== 'string') {
    const err = new Error('reference requerido');
    err.codigo = 400;
    throw err;
  }
  if (!transactionId || typeof transactionId !== 'string') {
    const err = new Error('transactionId requerido');
    err.codigo = 400;
    throw err;
  }

  const referenciaLimpia = reference.trim();
  const pago = await pagosRepository.buscarPorReferencia(referenciaLimpia);
  if (!pago) {
    const err = new Error('Pago no encontrado');
    err.codigo = 404;
    throw err;
  }

  if (pago.status === 'APPROVED' && pago.uniqueClaimCode) {
    await intentarEnviarCorreoReclamo(pago);
    const actualizado = await pagosRepository.buscarPorReferencia(referenciaLimpia);
    return respuestaEstadoDesdePago(actualizado || pago);
  }

  const transaccion = await consultarTransaccionPorId(transactionId.trim());

  if (transaccion.reference !== referenciaLimpia) {
    const err = new Error('La transacción no corresponde a esta referencia de pago');
    err.codigo = 400;
    throw err;
  }

  const montoWompi = Number(transaccion.amount_in_cents);
  if (Number.isFinite(montoWompi) && montoWompi !== Number(pago.amount)) {
    const err = new Error('El monto de la transacción no coincide con el kit');
    err.codigo = 400;
    throw err;
  }

  const resultado = await aplicarEstadoTransaccion({
    reference: referenciaLimpia,
    transactionId: transaccion.id,
    estado: transaccion.status,
  });

  const pagoFinal =
    (resultado.pago && (await pagosRepository.obtenerPorId(resultado.pago.id))) ||
    (await pagosRepository.buscarPorReferencia(referenciaLimpia));

  if (!pagoFinal) {
    const err = new Error('No se pudo actualizar el pago');
    err.codigo = 500;
    throw err;
  }

  return respuestaEstadoDesdePago(pagoFinal);
}

async function obtenerEstadoCheckout(reference) {
  if (!reference || typeof reference !== 'string') {
    const err = new Error('Parámetro reference requerido');
    err.codigo = 400;
    throw err;
  }

  const pago = await pagosRepository.buscarPorReferencia(reference.trim());
  if (!pago) {
    const err = new Error('Pago no encontrado');
    err.codigo = 404;
    throw err;
  }

  if (
    pago.status === 'APPROVED' &&
    pago.uniqueClaimCode &&
    !pago.emailEnviadoEn
  ) {
    await intentarEnviarCorreoReclamo(pago);
    const actualizado = await pagosRepository.buscarPorReferencia(reference.trim());
    if (actualizado) {
      Object.assign(pago, actualizado);
    }
  }

  return respuestaEstadoDesdePago(pago);
}

module.exports = { iniciarCheckout, obtenerEstadoCheckout, confirmarPagoCheckout };
