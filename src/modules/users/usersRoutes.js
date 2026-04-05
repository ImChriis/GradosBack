const express = require('express');
const router = express.Router();
const usersController = require('./usersController');

router.get('/', usersController.getUsers);
router.post('/add', usersController.createUser);
router.put('/update/:CodUsuario', usersController.updateUser);

module.exports = router;