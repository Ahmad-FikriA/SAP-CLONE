'use strict';

const express = require('express');
const authController = require('../controllers/auth/authController');
const { verifyToken } = require('../middleware/auth');

const router = express.Router();


router.post('/login', authController.login);


router.post('/fcm-token', verifyToken, authController.registerFcmToken);

module.exports = router;
