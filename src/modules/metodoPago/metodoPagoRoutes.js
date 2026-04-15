const express = require('express');
const router = express.Router();
const metodoPagoController = require('./metodoPagoController');

router.get('/', metodoPagoController.getMetodoPagos);
router.post('/add', metodoPagoController.createMetodoPago);
router.put('/update/:idMetodoPago', metodoPagoController.updateMetodoPago);

module.exports = router;