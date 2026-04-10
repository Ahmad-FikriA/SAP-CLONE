'use strict';

const express = require('express');
const authController = require('../controllers/auth/authController');
const { verifyToken } = require('../middleware/auth');

const router = express.Router();

// POST /api/auth/login
router.post('/login', authController.login);

// POST /api/auth/fcm-token
router.post('/fcm-token', verifyToken, authController.registerFcmToken);

module.exports = router;
