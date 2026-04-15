const express = require('express');
const router = express.Router();
const backupController = require('./backupController');

router.get('/download', backupController.downloadBackup);

module.exports = router;