const express = require('express');
const router = express.Router();
const specialitiesController = require('./specialitiesController');

router.get('/', specialitiesController.getSpecialities);
router.post('/add', specialitiesController.addSpeciality);
router.put('/update/:CodigoEsp', specialitiesController.updateSpeciality);

module.exports = router;