const express = require('express');
const router = express.Router();
const actContractsController = require('./actContractsController');

router.get('/', actContractsController.getActs);
router.get('/:CodigoActo/users', actContractsController.getActsUsersByCodigoActo);
// router.post('/add', actContractsController.addActContract);
// router.put('/update/:CoContrato', actContractsController.updateActContract);

module.exports = router;