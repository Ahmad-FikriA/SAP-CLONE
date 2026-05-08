'use strict';

const express = require('express');
const usersController = require('../controllers/users/usersController');
const { verifyToken } = require('../middleware/auth');

const router = express.Router();


router.get('/', verifyToken, usersController.getAll);


router.get('/stats', verifyToken, usersController.getStats);





router.post('/', verifyToken, usersController.create);


router.put('/:id', verifyToken, usersController.update);

router.delete('/:id', verifyToken, usersController.remove);

module.exports = router;
