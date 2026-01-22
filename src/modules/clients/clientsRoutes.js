const express = require('express');
const router = express.Router();
const clientsController = require('./clientsController');

router.get('/', clientsController.getClients);
router.post('/add', clientsController.addClient);
router.put('/update/:id', clientsController.updateClient);

module.exports = router;