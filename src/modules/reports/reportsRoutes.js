const express = require('express');
const router = express.Router();
const reportsController = require('./reportsController');

router.get('/actPlacesPdf', reportsController.actPlacesPdf);
router.get('/actPlacesExcel', reportsController.actPlacesExcel);

module.exports = router;