const express = require('express');
const { getConfigPublica } = require('../controllers/config.controller');

const router = express.Router();

router.get('/publica', getConfigPublica);

module.exports = router;
