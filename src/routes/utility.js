'use strict';

const express = require('express');
const router = express.Router();
const utilityController = require('../controllers/utility/utilityController');
const { verifyToken } = require('../middleware/auth');

// Middleware to restrict access to ADMIN only
function isAdmin(req, res, next) {
  if (req.user && req.user.role === 'admin') {
    next();
  } else {
    res.status(403).json({ success: false, error: 'Akses ditolak: Hanya untuk role Admin' });
  }
}

// All utility endpoints require authentication and admin role
router.use(verifyToken);
router.use(isAdmin);

router.get('/status', utilityController.getSystemStatus);
router.get('/logs', utilityController.getLogs);
router.post('/command', utilityController.runCommand);
router.get('/export', utilityController.exportData);

router.get('/module/export', utilityController.exportModuleData);
router.post('/module/import', utilityController.importModuleData);
router.delete('/module/clear', utilityController.clearModuleData);

module.exports = router;
