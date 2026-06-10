'use strict';

const express = require('express');
const router = express.Router();
const { verifyToken } = require('../middleware/auth');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const k3SettingsController = require('../controllers/k3_safety/k3SettingsController');

const uploadDir = path.join(__dirname, '..', '..', 'uploads', 'k3-banner');
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

const uploadBannerImage = multer({
  storage,
  limits: { fileSize: 2 * 1024 * 1024 }, // 2MB
  fileFilter: (req, file, cb) => {
    if (!file.mimetype.startsWith('image/')) {
      return cb(new Error('Hanya file gambar yang diperbolehkan'), false);
    }
    cb(null, true);
  }
});

// GET settings (public/semua user butuh untuk dashboard)
router.get('/', verifyToken, k3SettingsController.getSettings);

// PUT update settings (Hanya admin/HSE staff)
router.put('/', verifyToken, k3SettingsController.updateSettings);

// POST /api/k3-settings/banner-image
router.post('/banner-image', verifyToken, (req, res, next) => {
  uploadBannerImage.single('image')(req, res, (err) => {
    if (err) {
      return res.status(400).json({ success: false, message: err.message });
    }
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'Tidak ada file yang diupload' });
    }
    return res.status(200).json({
      success: true,
      path: `uploads/k3-banner/${req.file.filename}`
    });
  });
});

// DELETE /api/k3-settings/banner-image
router.delete('/banner-image', verifyToken, (req, res) => {
  const { path: imagePath } = req.body;
  if (!imagePath) {
    return res.status(400).json({ success: false, message: 'Path gambar tidak boleh kosong' });
  }

  // Safety check: only allow deleting files within uploads/k3-banner
  const baseFilename = path.basename(imagePath);
  const fullPath = path.join(uploadDir, baseFilename);

  if (fs.existsSync(fullPath)) {
    try {
      fs.unlinkSync(fullPath);
      return res.status(200).json({ success: true, message: 'Gambar berhasil dihapus' });
    } catch (e) {
      return res.status(500).json({ success: false, message: 'Gagal menghapus gambar di server: ' + e.message });
    }
  } else {
    return res.status(404).json({ success: false, message: 'File tidak ditemukan di server' });
  }
});

module.exports = router;
