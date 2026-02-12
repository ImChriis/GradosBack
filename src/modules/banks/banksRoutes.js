const express = require('express');
const router = express.Router();
const banksController = require('./banksController');

router.get('/', banksController.getBanks);
router.post('/add', banksController.addBank);
router.put('/update/:id', banksController.updateBank);

module.exports = router;