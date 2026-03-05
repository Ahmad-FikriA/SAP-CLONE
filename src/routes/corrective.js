'use strict';

const express = require('express');
const multer  = require('multer');
const { verifyToken } = require('../middleware/auth');
const { parseExcel } = require('../controllers/corrective/parseExcelController');
const reqCtrl = require('../controllers/corrective/correctiveRequestController');

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } }); // max 10MB

// ── Parse Excel ──────────────────────────────────────────────────────────────
router.post('/parse-excel', verifyToken, upload.single('file'), parseExcel);

// ── Corrective Requests CRUD ─────────────────────────────────────────────────
router.get('/requests',        verifyToken, reqCtrl.getAll);
router.get('/requests/:id',    verifyToken, reqCtrl.getOne);
router.post('/requests',       verifyToken, reqCtrl.create);
router.put('/requests/:id',    verifyToken, reqCtrl.update);
router.delete('/requests/:id', verifyToken, reqCtrl.remove);
router.post('/requests/bulk-delete', verifyToken, reqCtrl.bulkDelete);

// ── Approval Flow ────────────────────────────────────────────────────────────
router.post('/requests/:id/approve', verifyToken, reqCtrl.approve);
router.post('/requests/:id/reject',  verifyToken, reqCtrl.reject);

module.exports = router;
