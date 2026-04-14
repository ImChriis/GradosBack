const express = require('express');
const router = express.Router();
const reportsController = require('./reportsController');

router.get('/specialitiesPdf/:usuarioReporte', reportsController.specialitiesPdf);
router.get('/specialitiesExcel/:usuarioReporte', reportsController.specialitiesExcel);
router.get('/institutionsPdf/:usuarioReporte', reportsController.institutionsPdf);
router.get('/institutionsExcel/:usuarioReporte', reportsController.institutionsExcel);
router.get('/actPlacesPdf/:usuarioReporte', reportsController.actPlacesPdf);
router.get('/actPlacesExcel/:usuarioReporte', reportsController.actPlacesExcel);
router.post('/clientsPdf', reportsController.clientsPdf);
router.post('/clientsExcel', reportsController.clientsExcel);
router.post('/actListPdf', reportsController.actListPdf);

module.exports = router;