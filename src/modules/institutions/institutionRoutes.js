const express = require('express');
const router = express.Router();
const institutionsController = require('./institutionsController');

router.get('/', institutionsController.getInstitutions);

module.exports = router;