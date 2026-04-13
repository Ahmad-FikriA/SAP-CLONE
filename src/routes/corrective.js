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
const spkCtrl = require('../controllers/corrective/spkCorrectiveController');

const router = express.Router();

// ── Multer Config for Corrective Photos (2MB max, max 2 files) ────────────────
const storage = multer.diskStorage({
  destination: path.join(__dirname, '..', '..', 'uploads', 'corrective'),
  filename: (req, file, cb) => {
    cb(null, `${Date.now()}_${file.originalname}`);
  }
});

const uploadCorrective = multer({
  storage,
  limits: {
    fileSize: 2 * 1024 * 1024, // 2MB
    files: 2,
  },
  fileFilter: (req, file, cb) => {
    if (!file.mimetype.startsWith('image/')) {
      return cb(new Error('Only image files are allowed'), false);
    }
    cb(null, true);
  },
});

// ── Corrective Requests / Notifications ──────────────────────────────────────
// GET /api/corrective/requests
// Rules: Kadis Pelapor (own), Planner (all), Kadis Pusat (all)
router.get('/requests', verifyToken, reqCtrl.getAll);

// GET /api/corrective/requests/:id
router.get('/requests/:id', verifyToken, canViewNotification, reqCtrl.getOne);

// POST /api/corrective/requests
// Rules: Only Kadis can create
router.post('/requests', verifyToken, requireKadis, uploadCorrective.array('photos', 2), reqCtrl.create);

// PUT /api/corrective/requests/:id
// Rules: Kadis Pelapor can only update own; Planner can update; others read-only
router.put('/requests/:id', verifyToken, canViewNotification, reqCtrl.update);

// DELETE /api/corrective/requests/:id
router.delete('/requests/:id', verifyToken, canViewNotification, reqCtrl.remove);

// POST /api/corrective/requests/bulk-delete
router.post('/requests/bulk-delete', verifyToken, reqCtrl.bulkDelete);

// POST /api/corrective/requests/:id/approve-planner
// Rules: Planner changes pending to approved
router.post('/requests/:id/approve-planner', verifyToken, requirePlanner, reqCtrl.approvePlanner);

// POST /api/corrective/requests/:id/approve
router.post('/requests/:id/approve', verifyToken, reqCtrl.approveKadisPusat);

// POST /api/corrective/requests/:id/reject
router.post('/requests/:id/reject', verifyToken, reqCtrl.rejectKadisPusat);

// ── Corrective SPK ────────────────────────────────────────────────────────────
// GET /api/corrective/spk
// Rules: Teknisi/Kasie (own work center), Planner (all), Kadis Pusat (all), Kadis Pelapor (own)
router.get('/spk', verifyToken, spkCtrl.getAll);

// GET /api/corrective/spk/history
router.get('/spk/history', verifyToken, spkCtrl.getHistory);

// GET /api/corrective/spk/:spkId
router.get('/spk/:spkId', verifyToken, canViewSpkCorrective, spkCtrl.getOne);

// POST /api/corrective/spk
// Rules: Only Planner can create SPK from Notification
router.post('/spk', verifyToken, requirePlanner, spkCtrl.create);

// PUT /api/corrective/spk/:spkId
// Rules: Only Planner can edit if SPK is still draft
router.put('/spk/:spkId', verifyToken, requirePlanner, spkCtrl.updateByPlanner);

// DELETE /api/corrective/spk/:spkId
router.delete('/spk/:spkId', verifyToken, requirePlanner, spkCtrl.remove);

// POST /api/corrective/spk/bulk-delete
router.post('/spk/bulk-delete', verifyToken, requirePlanner, spkCtrl.bulkDelete);

// ── Teknisi Actions ───────────────────────────────────────────────────────────
// POST /api/corrective/spk/:spkId/upload-before-photos
router.post('/spk/:spkId/upload-before-photos', verifyToken, canViewSpkCorrective, uploadCorrective.array('photos', 2), spkCtrl.uploadBeforePhotos);

// POST /api/corrective/spk/:spkId/upload-after-photos
router.post('/spk/:spkId/upload-after-photos', verifyToken, canViewSpkCorrective, uploadCorrective.array('photos', 2), spkCtrl.uploadAfterPhotos);

// PUT /api/corrective/spk/:spkId/update-by-teknisi
// Rules: Teknisi can only update specific fields
router.put('/spk/:spkId/update-by-teknisi', verifyToken, canViewSpkCorrective, validateSpkUpdate(TEKNISI_FIELDS), spkCtrl.updateByTeknisi);

// ── Kadis Pusat Actions ─────────────────────────────────────────────────────
// POST /api/corrective/spk/:spkId/approve-kadis-pusat
router.post('/spk/:spkId/approve-kadis-pusat', verifyToken, canViewSpkCorrective, spkCtrl.approveKadisPusat);

// ── Kadis Pelapor Actions ────────────────────────────────────────────────────
// POST /api/corrective/spk/:spkId/approve-kadis-pelapor
router.post('/spk/:spkId/approve-kadis-pelapor', verifyToken, canViewSpkCorrective, spkCtrl.approveKadisPelapor);

// ── Reject Actions ───────────────────────────────────────────────────────────
// POST /api/corrective/spk/:spkId/reject
router.post('/spk/:spkId/reject', verifyToken, canViewSpkCorrective, spkCtrl.reject);


module.exports = router;
