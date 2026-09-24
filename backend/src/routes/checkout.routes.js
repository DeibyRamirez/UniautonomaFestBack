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

router.post('/initiate', limiteInicio, postIniciarCheckout);
router.post('/confirmar', limiteInicio, postConfirmarCheckout);
router.get('/estado', getEstadoCheckout);

module.exports = router;
