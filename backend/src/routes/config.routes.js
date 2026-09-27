const express = require('express');
const { getConfigPublica, getCiudades } = require('../controllers/config.controller');

const router = express.Router();

router.get('/publica', getConfigPublica);
router.get('/ciudades', getCiudades);

module.exports = router;
