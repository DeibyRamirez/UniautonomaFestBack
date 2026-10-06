const { procesarEventoWompi } = require('../services/wompiWebhook.service');

function extraerMetadatosEvento(cuerpo) {
  const transaccion = cuerpo?.data?.transaction;
  return {
    evento: cuerpo?.event || null,
    reference: transaccion?.reference || null,
    transactionId: transaccion?.id || null,
    estado: transaccion?.status || null,
  };
}

function debeReintentarWebhook(resultado) {
  if (!resultado) return true;
  if (resultado.error) return true;
  const motivosPermanentes = new Set([
    'evento_ignorado',
    'sin_transaccion',
    'sin_referencia',
    'pago_no_encontrado',
    'discrepancia',
    'estado_pendiente',
  ]);
  if (resultado.procesado) return false;
  return !motivosPermanentes.has(resultado.motivo);
}

async function postWebhook(req, res) {
  const metadatos = extraerMetadatosEvento(req.body);

  try {
    const resultado = await procesarEventoWompi(req.body);

    console.info('[webhook wompi]', {
      ...metadatos,
      procesado: Boolean(resultado?.procesado),
      motivo: resultado?.motivo || null,
      idempotente: Boolean(resultado?.idempotente),
    });

    if (debeReintentarWebhook(resultado)) {
      return res.status(500).json({ mensaje: 'Error al procesar evento Wompi' });
    }

    return res.sendStatus(200);
  } catch (error) {
    console.error('[webhook wompi]', {
      ...metadatos,
      error: error?.message || String(error),
    });
    return res.status(500).json({ mensaje: 'Error interno al procesar webhook' });
  }
}

module.exports = { postWebhook };
