'use strict';

const express = require('express');
const multer  = require('multer');
const { verifyToken } = require('../middleware/auth');
const { parseExcel } = require('../controllers/corrective/parseExcelController');

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } }); // max 10MB

// POST /api/corrective/parse-excel
router.post('/parse-excel', verifyToken, upload.single('file'), parseExcel);

module.exports = router;
