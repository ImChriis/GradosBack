const express = require('express');
const router = express.Router();
const ringContractController = require('./ringContractController');

router.get('/', ringContractController.getContracts);

module.exports = router;