const express = require('express');
const router = express.Router();
const actContractsController = require('./actContractsController');

router.get('/', actContractsController.getActs);
router.get('/abonos/:NoContrato/:NuCedula/:NoRecibo', actContractsController.getAbonosByUserContract); 
router.get('/:CodigoActo/users', actContractsController.getActsUsersByCodigoActo);
router.get('/:CodigoActo/total', actContractsController.getActTotal);
router.get('/:CodigoActo/totalPaid', actContractsController.totalPaid);
router.get('/:CodigoActo/saldo', actContractsController.saldo);
router.get('/:CodigoActo/usersAmount', actContractsController.getActUsersAmount);
router.get('/:CodigoActo/:NuCedula/:NoContrato', actContractsController.getPaymentDataByContract);
router.get('/:NoContrato', actContractsController.getRecibosByUserContract);
router.post('/recalculateTotal', actContractsController.recalculateActTotal);
router.post('/addUser', actContractsController.addUserToAct);
router.post ('/createRecibo', actContractsController.createReciboPago);
// router.post('/add', actContractsController.addActContract);
// router.put('/update/:CoContrato', actContractsController.updateActContract);

module.exports = router;