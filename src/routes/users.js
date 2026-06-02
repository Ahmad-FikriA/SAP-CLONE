'use strict';

const express = require('express');
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const usersController = require('../controllers/users/usersController');
const profileController = require('../controllers/users/profileController');
const { verifyToken } = require('../middleware/auth');

const router = express.Router();

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = path.join(__dirname, '../../uploads/profiles');
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${req.user.userId}_${Date.now()}${ext}`);
  }
});

const uploadProfile = multer({
  storage,
  limits: { fileSize: 2 * 1024 * 1024 }, // 2MB
  fileFilter: (req, file, cb) => {
    if (!file.mimetype.startsWith('image/')) {
      return cb(new Error('Hanya file gambar yang diperbolehkan!'), false);
    }
    cb(null, true);
  }
});

// Profile routes
router.get('/profile/me', verifyToken, profileController.getMyProfile);
router.put('/profile/me', verifyToken, profileController.updateMyProfile);
router.put('/profile/password', verifyToken, profileController.updatePassword);
router.post('/profile/photo', verifyToken, uploadProfile.single('photo'), profileController.uploadProfilePhoto);

// Error handler for multer
router.use((err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ error: 'Ukuran file maksimal 2MB' });
    }
    return res.status(400).json({ error: err.message });
  } else if (err) {
    return res.status(400).json({ error: err.message });
  }
  next();
});

// GET /api/users
router.get('/', verifyToken, usersController.getAll);

// GET /api/users/stats
router.get('/stats', verifyToken, usersController.getStats);

// POST /api/users/bulk-delete
router.post('/bulk-delete', verifyToken, usersController.bulkDelete);

// Multer config for Excel uploads
const uploadExcelDir = path.join(__dirname, '../../uploads');
if (!fs.existsSync(uploadExcelDir)) {
  fs.mkdirSync(uploadExcelDir, { recursive: true });
}
const uploadExcelFile = multer({ dest: uploadExcelDir });

// POST /api/users/upload-excel
router.post('/upload-excel', verifyToken, uploadExcelFile.single('excelFile'), usersController.uploadExcel);

// POST /api/users/bulk-insert
router.post('/bulk-insert', verifyToken, usersController.bulkInsert);

// POST /api/users
router.post('/', verifyToken, usersController.create);

// PUT /api/users/:id
router.put('/:id', verifyToken, usersController.update);

// DELETE /api/users/:id
router.delete('/:id', verifyToken, usersController.remove);

module.exports = router;
