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

// ── Multer Config for Investigasi (photos + document) ────────────────
const uploadInvestigasi = multer({
  storage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB per file
    files: 3, // Max 2 photos + 1 document
  },
  fileFilter: (req, file, cb) => {
    // Accept images for fotoInvestigasi
    if (file.fieldname === 'fotoInvestigasi') {
      if (!file.mimetype.startsWith('image/')) {
        return cb(new Error('Foto harus berupa file gambar'), false);
      }
    }
    // Accept docs for dokumenInvestigasi
    if (file.fieldname === 'dokumenInvestigasi') {
      const allowedMimes = [
        'application/pdf',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'application/vnd.ms-excel',
      ];
      if (!allowedMimes.includes(file.mimetype)) {
        return cb(new Error('Dokumen harus PDF, DOC, DOCX, atau XLSX'), false);
      }
    }
    cb(null, true);
  },
});

// ── K3 Safety Routes ────────────────────────────────────────────────────────────

// POST /api/k3-safety
router.post(
  '/', 
  verifyToken, 
  uploadK3Photos.array('foto', 2), 
  (req, res, next) => {
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

// DELETE /api/k3-safety/:id
router.delete('/:id', verifyToken, k3SafetyCtrl.deleteReport);

// DELETE /api/k3-safety
router.delete('/', verifyToken, k3SafetyCtrl.deleteAllReports);

// ── Investigasi Routes ──────────────────────────────────────────────────────────

// PUT /api/k3-safety/:id/investigasi
// Multipart: fotoInvestigasi (max 2 images) + dokumenInvestigasi (max 1 doc)
router.put(
  '/:id/investigasi',
  verifyToken,
  uploadInvestigasi.fields([
    { name: 'fotoInvestigasi', maxCount: 2 },
    { name: 'dokumenInvestigasi', maxCount: 1 },
  ]),
  k3SafetyCtrl.submitInvestigasi
);

// PUT /api/k3-safety/:id/verifikasi-investigasi
router.put('/:id/verifikasi-investigasi', verifyToken, k3SafetyCtrl.verifikasiInvestigasi);

// PUT /api/k3-safety/:id/validasi-investigasi-kadiv
router.put('/:id/validasi-investigasi-kadiv', verifyToken, k3SafetyCtrl.validasiInvestigasiKadiv);

module.exports = router;

