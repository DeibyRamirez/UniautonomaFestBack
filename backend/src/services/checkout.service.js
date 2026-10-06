const pagosRepository = require('../repositories/pagos.repository');
const configuracionWompi = require('../config/wompi');
const { variablesEntorno } = require('../config/variablesEntorno');
const { construirRedirectUrl } = require('../utilidades/resolverUrlPublica');
const {
  esKitInstitucional,
  DOMINIO_INSTITUCIONAL,
  tituloComponente,
} = require('../config/catalogoKits');
const {
  validarSolicitudCheckout,
  obtenerMontoCentavos,
  normalizarInformacionPersonal,
  normalizarKitType,
  normalizarKitComponents,
} = require('./validacionKit.service');
const { generarReferenciaPago } = require('./codigoReclamo.service');
const { calcularFirmaIntegridad } = require('./wompiIntegridad.service');
const { validarFormatoLlavePublica } = require('./wompiValidacion.service');
const { intentarEnviarCorreoReclamo } = require('./correoReclamo.service');
const { aplicarEstadoTransaccion } = require('./confirmacionPago.service');
const { consultarTransaccionPorId } = require('./wompiTransaccion.service');

function construirRespuestaInicio({
  pago,
  reference,
  amount,
  urlBase,
  retomandoPagoPendiente = false,
}) {
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
    redirectUrl: construirRedirectUrl(urlBase),
    checkoutUrl: configuracionWompi.urlCheckout,
    retomandoPagoPendiente: Boolean(retomandoPagoPendiente),
  };
}

function esCheckoutInstitucional(kitType, email) {
  return (
    esKitInstitucional(kitType) ||
    String(email || '').trim().toLowerCase().endsWith(DOMINIO_INSTITUCIONAL)
  );
}

async function validarDisponibilidadCompraPorCorreo({
  kitType,
  kitComponents,
  email,
  esInstitucional,
}) {
  const tipoNormalizado = normalizarKitType(kitType);
  const componentesNormalizados = normalizarKitComponents(kitComponents);

  if (tipoNormalizado === 'uniautonomo' && esInstitucional) {
    const pagoSangreAzul = await pagosRepository.buscarPagoUniautonomoAprobado(email);
    if (pagoSangreAzul) {
      const err = new Error('Este correo ya tiene un kit Sangre Azul registrado.');
      err.codigo = 409;
      throw err;
    }
  }

  if (tipoNormalizado === 'personalizado' && esInstitucional) {
    const pagoSangreAzul = await pagosRepository.buscarPagoUniautonomoAprobado(email);
    if (pagoSangreAzul) {
      const err = new Error(
        'Este correo ya tiene un kit Sangre Azul registrado. No puedes comprar Arma tu kit.'
      );
      err.codigo = 409;
      throw err;
    }

    const componentesAprobados =
      await pagosRepository.obtenerComponentesPersonalizadosAprobados(email);
    const duplicados = componentesNormalizados.filter((c) => componentesAprobados.has(c));
    if (duplicados.length) {
      const nombres = duplicados.map((id) => tituloComponente(id)).join(', ');
      const err = new Error(`Ya registraste ${nombres} con este correo.`);
      err.codigo = 409;
      throw err;
    }
  }
}

async function iniciarCheckout({ kitType, kitComponents, personalInfo, urlBase }) {
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

  validarFormatoLlavePublica(configuracionWompi.llavePublica);

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

  if (tipoNormalizado === 'uniautonomo' && esInstitucional) {
    const pendienteUniautonomo = await pagosRepository.buscarPendienteUniautonomoPorCorreo(
      info.email,
      { horasMaximas: variablesEntorno.pendingReutilizarHoras }
    );

    if (pendienteUniautonomo) {
      await pagosRepository.actualizarInformacionPendiente(pendienteUniautonomo.id, {
        personalInfo: info,
        kitComponents: componentesNormalizados,
        kitType: tipoNormalizado,
        amount,
      });

      const pagoActualizado = {
        ...pendienteUniautonomo,
        personalInfo: info,
        kitComponents: componentesNormalizados,
        kitType: tipoNormalizado,
        amount,
      };

      return construirRespuestaInicio({
        pago: pagoActualizado,
        reference: pendienteUniautonomo.reference,
        amount,
        urlBase,
        retomandoPagoPendiente: true,
      });
    }
  }

  if (tipoNormalizado === 'personalizado' && esInstitucional) {
    const pendientePersonalizado =
      await pagosRepository.buscarPendientePersonalizadoPorCorreo(
        info.email,
        componentesNormalizados
      );

    if (pendientePersonalizado) {
      await pagosRepository.actualizarInformacionPendiente(pendientePersonalizado.id, {
        personalInfo: info,
        kitComponents: componentesNormalizados,
        kitType: tipoNormalizado,
        amount,
      });

      const pagoActualizado = {
        ...pendientePersonalizado,
        personalInfo: info,
        kitComponents: componentesNormalizados,
        kitType: tipoNormalizado,
        amount,
      };

      return construirRespuestaInicio({
        pago: pagoActualizado,
        reference: pendientePersonalizado.reference,
        amount,
        urlBase,
        retomandoPagoPendiente: true,
      });
    }
  }

  let pago = await pagosRepository.buscarPendienteReciente({
    email: info.email,
    kitType: tipoNormalizado,
    kitComponents: componentesNormalizados,
    amount,
  });

  let reference;

  if (pago) {
    reference = pago.reference;
    await pagosRepository.actualizarInformacionPendiente(pago.id, {
      personalInfo: info,
      kitComponents: componentesNormalizados,
      kitType: tipoNormalizado,
      amount,
    });
  } else {
    reference = generarReferenciaPago();
    pago = await pagosRepository.crearPagoPendiente({
      reference,
      personalInfo: info,
      kitType: tipoNormalizado,
      kitComponents: componentesNormalizados,
      amount,
    });
  }

  return construirRespuestaInicio({ pago, reference, amount, urlBase });
}

function respuestaEstadoDesdePago(pago) {
  return {
    status: pago.status,
    uniqueClaimCode: pago.uniqueClaimCode,
    numeroCorredor: pago.numeroCorredor || null,
    kitType: pago.kitType,
    kitComponents: pago.kitComponents || [],
    emailEnviado: Boolean(pago.emailEnviadoEn),
    emailError: pago.emailError || null,
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

  const resultado = await aplicarEstadoTransaccion({
    reference: referenciaLimpia,
    transactionId: transaccion.id,
    estado: transaccion.status,
    montoCentavos: transaccion.amount_in_cents,
    moneda: transaccion.currency,
  });

  if (resultado.motivo === 'discrepancia') {
    const err = new Error('El monto de la transacción no coincide con el kit');
    err.codigo = 400;
    throw err;
  }

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

module.exports = {
  iniciarCheckout,
  obtenerEstadoCheckout,
  confirmarPagoCheckout,
  validarDisponibilidadCompraPorCorreo,
  esCheckoutInstitucional,
};
