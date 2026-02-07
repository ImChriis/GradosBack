const express = require('express');
const router = express.Router();
const institutionsController = require('./institutionsController');

router.get('/', institutionsController.getInstitutions);
router.post('/add', institutionsController.addInstitution);
router.put('/update/:CodigoInst', institutionsController.updateInstitution);
module.exports = router;