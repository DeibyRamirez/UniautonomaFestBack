const pagosRepository = require('../repositories/pagos.repository');
const {
  validarSolicitudCheckout,
  obtenerMontoCentavos,
  normalizarInformacionPersonal,
  normalizarKitType,
  normalizarKitComponents,
} = require('./validacionKit.service');
const {
  generarReferenciaManual,
  generarCodigoReclamo,
} = require('./codigoReclamo.service');
const { intentarEnviarCorreoReclamo } = require('./correoReclamo.service');
const { consultarTransaccionPorId } = require('./wompiTransaccion.service');
const {
  validarDisponibilidadCompraPorCorreo,
  esCheckoutInstitucional,
} = require('./checkout.service');

const ORIGENES_VALIDOS = ['EFECTIVO', 'CORTESIA', 'WOMPI_EXTERNO'];

function respuestaDesdePago(pago) {
  return {
    id: pago.id,
    status: pago.status,
    reference: pago.reference,
    uniqueClaimCode: pago.uniqueClaimCode,
    numeroCorredor: pago.numeroCorredor || null,
    kitType: pago.kitType,
    kitComponents: pago.kitComponents || [],
    origenRegistro: pago.origenRegistro || null,
    emailEnviado: Boolean(pago.emailEnviadoEn),
  };
}

async function prepararSolicitudRegistro({ kitType, kitComponents, personalInfo }) {
  const tipoNormalizado = normalizarKitType(kitType);
  const componentesNormalizados = normalizarKitComponents(kitComponents);

  const errorValidacion = validarSolicitudCheckout({
    kitType: tipoNormalizado,
    kitComponents: componentesNormalizados,
    personalInfo,
  });
  if (errorValidacion) {
    const err = new Error(errorValidacion);
    err.codigo = 400;
    throw err;
  }

  const info = normalizarInformacionPersonal(personalInfo, {
    kitType: tipoNormalizado,
    kitComponents: componentesNormalizados,
  });
  const amount = obtenerMontoCentavos(tipoNormalizado, componentesNormalizados);
  const esInstitucional = esCheckoutInstitucional(tipoNormalizado, info.email);

  await validarDisponibilidadCompraPorCorreo({
    kitType: tipoNormalizado,
    kitComponents: componentesNormalizados,
    email: info.email,
    esInstitucional,
  });

  return {
    tipoNormalizado,
    componentesNormalizados,
    info,
    amount,
    esInstitucional,
  };
}

async function registrarManualAprobado({
  kitType,
  kitComponents,
  personalInfo,
  origenRegistro,
  transactionId,
  notas,
  enviarCorreo,
  registradoPorAdminEmail,
}) {
  const origen = String(origenRegistro || '').trim().toUpperCase();
  if (!ORIGENES_VALIDOS.includes(origen)) {
    const err = new Error('Origen de registro inválido. Usa EFECTIVO, CORTESIA o WOMPI_EXTERNO.');
    err.codigo = 400;
    throw err;
  }

  const { tipoNormalizado, componentesNormalizados, info, amount } =
    await prepararSolicitudRegistro({ kitType, kitComponents, personalInfo });

  let reference = generarReferenciaManual();
  let transactionIdFinal = null;

  if (origen === 'WOMPI_EXTERNO') {
    const idTransaccion = String(transactionId || '').trim();
    if (!idTransaccion) {
      const err = new Error('transactionId requerido para registro WOMPI_EXTERNO');
      err.codigo = 400;
      throw err;
    }

    const transaccion = await consultarTransaccionPorId(idTransaccion);
    if (transaccion.status !== 'APPROVED') {
      const err = new Error(
        `La transacción en Wompi no está aprobada (estado: ${transaccion.status || 'desconocido'})`
      );
      err.codigo = 400;
      throw err;
    }
    if (Number(transaccion.amount_in_cents) !== Number(amount)) {
      const err = new Error(
        `El monto en Wompi (${transaccion.amount_in_cents}) no coincide con el kit (${amount})`
      );
      err.codigo = 400;
      throw err;
    }

    reference = String(transaccion.reference || '').trim() || reference;
    transactionIdFinal = transaccion.id;

    const existente = await pagosRepository.buscarPorReferencia(reference);
    if (existente) {
      const err = new Error('Ya existe un registro con esta referencia de Wompi.');
      err.codigo = 409;
      throw err;
    }
  }

  const pago = await pagosRepository.crearRegistroManualAprobado(
    {
      reference,
      personalInfo: info,
      kitType: tipoNormalizado,
      kitComponents: componentesNormalizados,
      amount,
      origenRegistro: origen,
      transactionId: transactionIdFinal,
      notas,
      registradoPorAdminEmail,
    },
    generarCodigoReclamo
  );

  if (!pago) {
    const err = new Error('No se pudo crear el registro manual');
    err.codigo = 500;
    throw err;
  }

  if (enviarCorreo) {
    await intentarEnviarCorreoReclamo(pago);
    const actualizado = await pagosRepository.obtenerPorId(pago.id);
    return respuestaDesdePago(actualizado || pago);
  }

  return respuestaDesdePago(pago);
}

module.exports = {
  registrarManualAprobado,
  ORIGENES_VALIDOS,
};
