'use strict';

const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { verifyToken } = require('../middleware/auth');
const k3SafetyCtrl = require('../controllers/k3_safety/k3SafetyController');

const router = express.Router();

// ── Multer Config for K3 Safety Photos ────────────────
const uploadDir = path.join(__dirname, '..', '..', 'uploads', 'k3_safety');

// Ensure directory exists
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    cb(null, `${Date.now()}_${file.originalname}`);
  }
});

const uploadK3Photos = multer({
  storage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit per photo (adjustable)
    files: 2, // Max 2 files
  },
  fileFilter: (req, file, cb) => {
    if (!file.mimetype.startsWith('image/')) {
      return cb(new Error('Only image files are allowed'), false);
    }
    cb(null, true);
  },
});

// ── K3 Safety Routes ────────────────────────────────────────────────────────────

// POST /api/k3-safety
// Supports multipart form-data because of multiple images
// Expects field name "foto" or "images" (using "foto" here based on standard, but flutter can use any, let's use "foto")
// Let's accept both by using .fields or just .array('foto')? the prompt mentioned 'images' or 'foto'. Let's use 'foto'.
router.post(
  '/', 
  verifyToken, 
  uploadK3Photos.array('foto', 2), 
  (req, res, next) => {
    // If flutter decided to send with 'images' instead of 'foto', handle dynamically or ensure standard is 'foto'.
    // If multer array mapping fails for a different field, it will throw an error or just keep req.files empty.
    // It's recommended that the client sticks to 'foto'
    next();
  },
  k3SafetyCtrl.createReport
);

// GET /api/k3-safety
router.get('/', verifyToken, k3SafetyCtrl.getAll);

// PUT /api/k3-safety/:id/validasi-awal
router.put('/:id/validasi-awal', verifyToken, k3SafetyCtrl.validasiAwal);

// PUT /api/k3-safety/:id/perbaikan
router.put('/:id/perbaikan', verifyToken, uploadK3Photos.array('fotoPerbaikan', 2), k3SafetyCtrl.actionPerbaikan);

// PUT /api/k3-safety/:id/validasi-hasil
router.put('/:id/validasi-hasil', verifyToken, k3SafetyCtrl.validasiHasil);

// PUT /api/k3-safety/:id/validasi-akhir
router.put('/:id/validasi-akhir', verifyToken, k3SafetyCtrl.validasiAkhir);

module.exports = router;
