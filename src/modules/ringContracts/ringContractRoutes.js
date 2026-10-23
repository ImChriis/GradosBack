const express = require('express');
const router = express.Router();
const ringContractController = require('./ringContractController');

// ---------------- LECTURA ----------------
// Lista con filtros: ?q=...&estado=1..9&todos=1&page=&limit=
router.get('/', ringContractController.getContracts);

// Contratos de un cliente (antes de /:id para no chocar)
router.get('/cliente/:nucedula', ringContractController.getContractsByClient);

// Detalle financiero y pagos de un contrato
router.get('/:id/saldo', ringContractController.getSaldo);
router.get('/:id/recibos', ringContractController.getRecibos);
router.get('/:id/abonos/:noRecibo', ringContractController.getAbonos);

// Detalle completo
router.get('/:id', ringContractController.getContractById);

// ---------------- ESCRITURA ----------------
// Crear contrato (NoContrato lo digita el usuario y se valida)
router.post('/create', ringContractController.createContract);

// Modal de pagos: recibo y depósito por separado (igual que actContracts)
router.post('/createRecibo', ringContractController.createReciboPago);
router.post('/createDeposito', ringContractController.createDeposito);

// Pestañas Detalles + Regalías
router.put('/update/:id', ringContractController.updateContract);

// Pestaña Estado (MaEstado + fechas + orden)
router.put('/updateEstado/:id', ringContractController.updateEstado);

// Pestaña Saldo (montos base, recalcula mnsaldo)
router.put('/updateTotals/:id', ringContractController.updateTotals);

// Anula un recibo: lo marca en '1', devuelve el monto al saldo y se niega
// si el recibo ya pertenece a un cierre
router.put('/:id/anularRecibo', ringContractController.anularRecibo);

// Botón "Efectuar Pago": ReciboPago + Depositos + montos del contrato
router.post('/pay/:id', ringContractController.payContract);

module.exports = router;
