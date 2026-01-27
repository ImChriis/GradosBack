const express = require('express');
const router = express.Router();
const specialitiesController = require('./specialitiesController');

router.get('/', specialitiesController.getSpecialities);

module.exports = router;