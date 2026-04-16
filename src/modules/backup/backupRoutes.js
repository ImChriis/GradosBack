const express = require('express');
const router = express.Router();
const multer = require('multer');
const backupController = require('./backupController');

const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

router.get('/download', backupController.downloadBackup);
router.post('/restore', upload.single('sqlFile'), backupController.uploadBackup);


module.exports = router;