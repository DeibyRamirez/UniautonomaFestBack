const { procesarEventoWompi } = require('../services/wompiWebhook.service');

async function postWebhook(req, res) {
  try {
    await procesarEventoWompi(req.body);
    return res.sendStatus(200);
  } catch (error) {
    console.error('[webhook wompi]', error);
    return res.sendStatus(200);
  }
}

module.exports = { postWebhook };
