const {
  iniciarCheckout,
  obtenerEstadoCheckout,
  confirmarPagoCheckout,
} = require('../services/checkout.service');

async function getEstadoCheckout(req, res) {
  try {
    const { reference } = req.query;
    const resultado = await obtenerEstadoCheckout(reference);
    return res.json(resultado);
  } catch (error) {
    const codigo = error.codigo || 500;
    return res.status(codigo).json({
      mensaje: error.message || 'Error al consultar estado',
    });
  }
}

async function postConfirmarCheckout(req, res) {
  try {
    const { reference, transactionId } = req.body || {};
    const resultado = await confirmarPagoCheckout({ reference, transactionId });
    return res.json(resultado);
  } catch (error) {
    const codigo = error.codigo || 500;
    if (codigo >= 500) {
      console.error('[checkout confirmar]', error);
    }
    return res.status(codigo).json({
      mensaje: error.message || 'Error al confirmar el pago',
    });
  }
}

async function postIniciarCheckout(req, res) {
  try {
    const { kitType, personalInfo } = req.body;
    const resultado = await iniciarCheckout({ kitType, personalInfo });
    return res.status(201).json(resultado);
  } catch (error) {
    const codigo = error.codigo || 500;
    if (codigo === 500) {
      console.error('[checkout initiate]', error);
    }
    return res.status(codigo).json({
      mensaje: error.message || 'Error al iniciar el checkout',
    });
  }
}

module.exports = { postIniciarCheckout, getEstadoCheckout, postConfirmarCheckout };
