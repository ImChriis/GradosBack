const express = require('express');
const router = express.Router();
const actContractsController = require('./actContractsController');

router.get('/', actContractsController.getActs);
router.get('/:CodigoActo/users', actContractsController.getActsUsersByCodigoActo);
router.get('/:CodigoActo/total', actContractsController.getActTotal);
router.post('/recalculateTotal', actContractsController.recalculateActTotal);
router.get('/:CodigoActo/totalPaid', actContractsController.totalPaid);
router.get('/:CodigoActo/saldo', actContractsController.saldo);
router.get('/:CodigoActo/usersAmount', actContractsController.getActUsersAmount);
// router.post('/add', actContractsController.addActContract);
// router.put('/update/:CoContrato', actContractsController.updateActContract);

module.exports = router;