'use strict';

const express = require('express');
const usersController = require('../controllers/users/usersController');
const { verifyToken } = require('../middleware/auth');

const router = express.Router();

// GET /api/users
router.get('/', verifyToken, usersController.getAll);

// POST /api/users/bulk-delete
router.post('/bulk-delete', verifyToken, usersController.bulkDelete);

// POST /api/users
router.post('/', verifyToken, usersController.create);

// PUT /api/users/:id
router.put('/:id', verifyToken, usersController.update);

// DELETE /api/users/:id
router.delete('/:id', verifyToken, usersController.remove);

module.exports = router;
