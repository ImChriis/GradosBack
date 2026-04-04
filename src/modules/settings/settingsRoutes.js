const express = require('express');
const router = express.Router();
const settingsController = require('./settingsController');

router.get('/', settingsController.getSettings);
router.put('/update/:id', settingsController.updateSettings);

module.exports = router;