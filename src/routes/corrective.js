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
// Deprecated: const spkCtrl = require('../controllers/corrective/spkCorrectiveController');

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

// DELETE /api/corrective/requests
router.delete('/requests', verifyToken, requirePlanner, reqCtrl.deleteAll);

// DELETE /api/corrective/requests/:id
router.delete('/requests/:id', verifyToken, canViewNotification, reqCtrl.remove);

// POST /api/corrective/requests/bulk-delete
router.post('/requests/bulk-delete', verifyToken, reqCtrl.bulkDelete);

// POST /api/corrective/requests/:id/approve-planner
// Rules: Planner changes pending to approved
router.post("/requests/:id/approve-planner", verifyToken, requirePlanner, reqCtrl.approvePlanner);
router.post("/requests/:id/reject-planner", verifyToken, requirePlanner, reqCtrl.rejectPlanner);
router.post("/requests/:id/update-sap-number", verifyToken, requirePlanner, reqCtrl.updateSapNumber);

// POST /api/corrective/requests/:id/approve
router.post('/requests/:id/approve', verifyToken, reqCtrl.approveKadisPusat);

// POST /api/corrective/requests/:id/reject
router.post('/requests/:id/reject', verifyToken, reqCtrl.rejectKadisPusat);

// ── Corrective SPK (LEGACY - DEPRECATED) ──────────────────────────────────────
// This entire path is deprecated since the migration to SAP SPK.
// Returning 410 Gone to prevent the app from crashing due to dropped tables and associations.
router.use('/spk', (req, res) => {
  res.status(410).json({ error: 'This endpoint is deprecated. Use SAP SPK workflow (/api/corrective/sap-spk) instead.' });
});

module.exports = router;
