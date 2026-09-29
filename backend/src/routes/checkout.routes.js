const express = require('express');
const rateLimit = require('express-rate-limit');
const {
  postIniciarCheckout,
  getEstadoCheckout,
  postConfirmarCheckout,
} = require('../controllers/checkout.controller');

const router = express.Router();

const limiteInicio = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { mensaje: 'Demasiados intentos. Intenta más tarde.' },
});

// El navegador consulta cada 3 s durante ~2 min por pago; 120/5 min deja margen para reintentos.
const limiteEstado = rateLimit({
  windowMs: 5 * 60 * 1000,
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
  message: { mensaje: 'Demasiadas consultas. Espera un momento.' },
});

router.post('/initiate', limiteInicio, postIniciarCheckout);
router.post('/confirmar', limiteInicio, postConfirmarCheckout);
router.get('/estado', limiteEstado, getEstadoCheckout);

module.exports = router;
