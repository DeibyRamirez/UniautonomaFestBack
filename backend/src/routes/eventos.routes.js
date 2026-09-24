const express = require('express');
const rateLimit = require('express-rate-limit');
const { postInscripcion } = require('../controllers/eventos.controller');

const router = express.Router();

const limiteInscripcion = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { mensaje: 'Demasiados intentos. Intenta más tarde.' },
});

router.post('/inscripcion', limiteInscripcion, postInscripcion);

module.exports = router;
