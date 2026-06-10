const express = require("express");
const router = express.Router();
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const sapSpkController = require("../controllers/corrective/sapSpkController");
const { verifyToken } = require("../middleware/auth");

const uploadDir = path.join(__dirname, "../../uploads");
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, file.fieldname + "-" + uniqueSuffix + path.extname(file.originalname));
  },
});

const upload = multer({ storage });

// ── Analytics ────────────────────────────────────────────────────────────────
router.get("/stats", verifyToken, sapSpkController.getCorrectiveStats);

// ── List SPKs ────────────────────────────────────────────────────────────────
router.get("/", verifyToken, sapSpkController.getSapSpkList);


router.get("/reason-codes", verifyToken, sapSpkController.getReasonOfVarianceCodes);

// ── Export History to Excel (IW49 format) ────────────────────────────────────
router.get("/export-history", verifyToken, sapSpkController.exportHistory);
router.post("/export-history", verifyToken, sapSpkController.exportHistory);

// ── Upload Excel endpoint (Returns Preview) ──────────────────────────────────
router.post(
  "/upload-excel",
  verifyToken,
  upload.single("excelFile"),
  sapSpkController.uploadExcel
);

// ── Upload History Excel endpoint (TECO directly to Selesai) ─────────────────
router.post(
  "/upload-history",
  verifyToken,
  upload.single("excelFile"),
  sapSpkController.uploadHistoryExcel
);

// ── Bulk Insert endpoint (Confirms Upload) ───────────────────────────────────
router.post(
  "/bulk-insert",
  verifyToken,
  sapSpkController.bulkInsertSapSpk
);


router.post(
  "/manual",
  verifyToken,
  sapSpkController.createManualSapSpk
);

// ── Update SPK (Planner only) ────────────────────────────────────────────────
router.patch(
  "/:orderNumber",
  verifyToken,
  sapSpkController.updateSapSpk
);

// ── Step 1: Claim SPK (Photo Before + Lock to NIK) ──────────────────────────
router.post(
  "/:order_number/claim",
  verifyToken,
  upload.single("photoBefore"),
  sapSpkController.claimSapSpk
);


router.put(
  "/:order_number/execute",
  verifyToken,
  upload.single("photoAfter"),
  sapSpkController.executeSapSpk
);


router.post("/:order_number/approve-kadis-pp", verifyToken, sapSpkController.approveKadisPp);
router.post("/:order_number/reject-kadis-pp", verifyToken, sapSpkController.rejectKadisPp);


router.post("/:order_number/approve-kadis-pelapor", verifyToken, sapSpkController.approveKadisPelapor);
router.post("/:order_number/reject-kadis-pelapor", verifyToken, sapSpkController.rejectKadisPelapor);

const { requirePlanner } = require("../middleware/correctiveAccess");

// ── Delete Endpoints (Admin + Planner only) ──────────────────────────────────
router.delete("/", verifyToken, requirePlanner, sapSpkController.deleteAllSapSpk);
router.delete("/:order_number", verifyToken, requirePlanner, sapSpkController.deleteSapSpk);

// ── SPK Material Management (Admin + Planner only) ───────────────────────────
router.post("/:order_number/materials", verifyToken, requirePlanner, sapSpkController.addMaterialToSpk);
router.delete("/:order_number/materials/:materialRecordId", verifyToken, requirePlanner, sapSpkController.removeMaterialFromSpk);

module.exports = router;

