const crypto = require('crypto');
const configuracionWompi = require('../config/wompi');
const { obtenerValorRuta } = require('../utilidades/obtenerValorRuta');
const { compararHashesHex } = require('../utilidades/comparacionSegura');

function calcularChecksumEvento(cuerpo, secreto) {
  const propiedades = cuerpo?.signature?.properties || [];
  const datos = cuerpo?.data || {};
  let cadena = '';

  for (const propiedad of propiedades) {
    const valor = obtenerValorRuta(datos, propiedad);
    cadena += valor === undefined || valor === null ? '' : String(valor);
  }

  cadena += String(cuerpo.timestamp ?? '');
  cadena += secreto;

  return crypto.createHash('sha256').update(cadena).digest('hex');
}

function verifyWebhookSignature(req, res, next) {
  const secreto = configuracionWompi.secretoEventos;

  if (!secreto) {
    return res.status(500).json({
      mensaje: 'Webhook no configurado: falta WOMPI_EVENTS_SECRET',
    });
  }

  const checksumRecibido =
    req.headers['x-event-checksum'] || req.body?.signature?.checksum;

  if (!checksumRecibido) {
    return res.status(401).json({ mensaje: 'Firma de evento ausente' });
  }

  const checksumCalculado = calcularChecksumEvento(req.body, secreto);

  if (!compararHashesHex(checksumCalculado, checksumRecibido)) {
    return res.status(401).json({ mensaje: 'Firma de evento inválida' });
  }

  next();
}

module.exports = { verifyWebhookSignature, calcularChecksumEvento };
