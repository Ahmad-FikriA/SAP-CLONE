'use strict';

const express = require('express');
const router = express.Router();
const materialController = require('../controllers/materialController');
const { verifyToken } = require('../middleware/auth');
const multer = require('multer');
const path = require('path');

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, '../../uploads'));
  },
  filename: (req, file, cb) => {
    cb(null, `material_import_${Date.now()}_${file.originalname}`);
  }
});

const upload = multer({ storage });

router.use(verifyToken);

router.get('/', materialController.getAllMaterials);
router.post('/', materialController.createMaterial);
router.put('/:id', materialController.updateMaterial);
router.delete('/:id', materialController.deleteMaterial);

// Excel Import
router.post('/import', upload.single('file'), materialController.importMaterials);

module.exports = router;
