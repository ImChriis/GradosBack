const express = require('express');
const router = express.Router();
const metodoPagoController = require('./metodoPagoController');

router.get('/', metodoPagoController.getMetodoPagos);

module.exports = router;