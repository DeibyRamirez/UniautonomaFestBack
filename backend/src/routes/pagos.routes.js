const express = require('express');
const { postWebhook } = require('../controllers/pagos.controller');
const { verifyWebhookSignature } = require('../middlewares/verifyWebhookSignature');

const router = express.Router();

router.post('/webhook', verifyWebhookSignature, postWebhook);

module.exports = router;
