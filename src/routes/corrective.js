'use strict';

const express = require('express');
const multer = require('multer');
const path = require('path');
const { verifyToken } = require('../middleware/auth');
const {
  requireKadis,
  canViewNotification,
  requirePlanner,
  canViewSpkCorrective,
  validateSpkUpdate,
  TEKNISI_FIELDS,
  KASIE_FIELDS,
  KADIS_PUSAT_FIELDS,
  KADIS_PELAPOR_FIELDS,
} = require('../middleware/correctiveAccess');
const reqCtrl = require('../controllers/corrective/correctiveRequestController');


const router = express.Router();


const storage = multer.diskStorage({
  destination: path.join(__dirname, '..', '..', 'uploads', 'corrective'),
  filename: (req, file, cb) => {
    cb(null, `${Date.now()}_${file.originalname}`);
  }
});

const uploadCorrective = multer({
  storage,
  limits: {
    fileSize: 2 * 1024 * 1024,
    files: 2,
  },
  fileFilter: (req, file, cb) => {
    if (!file.mimetype.startsWith('image/')) {
      return cb(new Error('Only image files are allowed'), false);
    }
    cb(null, true);
  },
});



router.get('/requests', verifyToken, reqCtrl.getAll);


router.get('/requests/:id', verifyToken, canViewNotification, reqCtrl.getOne);


router.post('/requests', verifyToken, requireKadis, uploadCorrective.array('photos', 2), reqCtrl.create);


router.put('/requests/:id', verifyToken, canViewNotification, reqCtrl.update);

router.delete('/requests', verifyToken, requirePlanner, reqCtrl.deleteAll);

router.delete('/requests/:id', verifyToken, canViewNotification, reqCtrl.remove);


router.post('/requests/bulk-delete', verifyToken, reqCtrl.bulkDelete);


router.post("/requests/:id/approve-planner", verifyToken, requirePlanner, reqCtrl.approvePlanner);
router.post("/requests/:id/reject-planner", verifyToken, requirePlanner, reqCtrl.rejectPlanner);
router.post("/requests/:id/update-sap-number", verifyToken, requirePlanner, reqCtrl.updateSapNumber);


router.post('/requests/:id/approve', verifyToken, reqCtrl.approveKadisPusat);


router.post('/requests/:id/reject', verifyToken, reqCtrl.rejectKadisPusat);



router.use('/spk', (req, res) => {
  res.status(410).json({ error: 'This endpoint is deprecated. Use SAP SPK workflow (/api/corrective/sap-spk) instead.' });
});

module.exports = router;
