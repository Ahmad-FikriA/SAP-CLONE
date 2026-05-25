'use strict';

const express = require('express');
const router = express.Router();
const { verifyToken, verifyRoleOrHse } = require('../middleware/auth');
const k3SettingsController = require('../controllers/k3_safety/k3SettingsController');

// GET settings (public/semua user butuh untuk dashboard)
router.get('/', verifyToken, k3SettingsController.getSettings);

// PUT update settings (Hanya admin/HSE staff)
router.put('/', verifyToken, verifyRoleOrHse, k3SettingsController.updateSettings);

module.exports = router;
