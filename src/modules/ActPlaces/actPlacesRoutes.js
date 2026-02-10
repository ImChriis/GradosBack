const express = require('express');
const router = express.Router();
const actPlacesController = require('./actPlacesController');

router.get('/', actPlacesController.getActPlaces);
router.post('/add', actPlacesController.addActPlace);
router.put('/update/:CoLugar', actPlacesController.updateActPlace);

module.exports = router;