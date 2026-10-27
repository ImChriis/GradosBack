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
router.post('/actListExcel', reportsController.actListExcel);
router.post('/actListTxt', reportsController.actListTxt);
router.post('/generateClosingPdf', reportsController.generateClosingPdf);

// Contratos de anillos
router.post('/contractsByStatusPdf', reportsController.contractsByStatusPdf);
router.post('/contractsByStatusExcel', reportsController.contractsByStatusExcel);
router.post('/ringExpiringPdf', reportsController.ringExpiringPdf);
router.post('/ringExpiringExcel', reportsController.ringExpiringExcel);

module.exports = router;