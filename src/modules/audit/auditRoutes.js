const express = require('express');
const router = express.Router();
const auditController = require('./auditController');

// Rutas específicas PRIMERO (para que no las coma /:id)
router.get('/', auditController.getAudit);
router.get('/tables', auditController.getAuditTables);
router.get('/stats', auditController.getAuditStats);
router.get('/record/:tabla/:idRegistro', auditController.getRecordHistory);
router.get('/:id', auditController.getAuditById);

module.exports = router;
