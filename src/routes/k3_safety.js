'use strict';

const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { verifyToken } = require('../middleware/auth');
const k3SafetyCtrl = require('../controllers/k3_safety/k3SafetyController');

const router = express.Router();


const uploadDir = path.join(__dirname, '..', '..', 'uploads', 'k3_safety');


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
    fileSize: 5 * 1024 * 1024,
    files: 2,
  },
  fileFilter: (req, file, cb) => {
    if (!file.mimetype.startsWith('image/')) {
      return cb(new Error('Only image files are allowed'), false);
    }
    cb(null, true);
  },
});


const uploadInvestigasi = multer({
  storage,
  limits: {
    fileSize: 5 * 1024 * 1024,
    files: 3,
  },
  fileFilter: (req, file, cb) => {

    if (file.fieldname === 'fotoInvestigasi') {
      if (!file.mimetype.startsWith('image/')) {
        return cb(new Error('Foto harus berupa file gambar'), false);
      }
    }

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




router.post(
  '/', 
  verifyToken, 
  uploadK3Photos.array('foto', 2), 
  (req, res, next) => {
    next();
  },
  k3SafetyCtrl.createReport
);


router.get('/', verifyToken, k3SafetyCtrl.getAll);


router.put('/:id/validasi-awal', verifyToken, k3SafetyCtrl.validasiAwal);


router.put('/:id/perbaikan', verifyToken, uploadK3Photos.array('fotoPerbaikan', 2), k3SafetyCtrl.actionPerbaikan);


router.put('/:id/validasi-hasil', verifyToken, k3SafetyCtrl.validasiHasil);


router.put('/:id/validasi-akhir', verifyToken, k3SafetyCtrl.validasiAkhir);

router.delete('/:id', verifyToken, k3SafetyCtrl.deleteReport);

router.delete('/', verifyToken, k3SafetyCtrl.deleteAllReports);




router.put(
  '/:id/investigasi',
  verifyToken,
  uploadInvestigasi.fields([
    { name: 'fotoInvestigasi', maxCount: 2 },
    { name: 'dokumenInvestigasi', maxCount: 1 },
  ]),
  k3SafetyCtrl.submitInvestigasi
);


router.put('/:id/verifikasi-investigasi', verifyToken, k3SafetyCtrl.verifikasiInvestigasi);


router.put('/:id/validasi-investigasi-kadiv', verifyToken, k3SafetyCtrl.validasiInvestigasiKadiv);

module.exports = router;

