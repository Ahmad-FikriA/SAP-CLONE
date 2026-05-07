const express = require("express");
const router = express.Router();
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const sapSpkController = require("../controllers/corrective/sapSpkController");
const { verifyToken } = require("../middleware/auth");

// Configure multer storage
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

// ── List SPKs ────────────────────────────────────────────────────────────────
router.get("/", verifyToken, sapSpkController.getSapSpkList);

// ── Reason of Variance codes (for dropdown) ──────────────────────────────────
router.get("/reason-codes", verifyToken, sapSpkController.getReasonOfVarianceCodes);

// ── Export History to Excel (IW49 format) ────────────────────────────────────
router.get("/export-history", verifyToken, sapSpkController.exportHistory);

// ── Upload Excel endpoint (Returns Preview) ──────────────────────────────────
router.post(
  "/upload-excel",
  verifyToken,
  upload.single("excelFile"),
  sapSpkController.uploadExcel
);

// ── Bulk Insert endpoint (Confirms Upload) ───────────────────────────────────
router.post(
  "/bulk-insert",
  verifyToken,
  sapSpkController.bulkInsertSapSpk
);

// ── Manual Create SPK ────────────────────────────────────────────────────────
router.post(
  "/manual",
  verifyToken,
  sapSpkController.createManualSapSpk
);

// ── Step 1: Claim SPK (Photo Before + Lock to NIK) ──────────────────────────
router.post(
  "/:order_number/claim",
  verifyToken,
  upload.single("photoBefore"),
  sapSpkController.claimSapSpk
);

// ── Step 2: Complete SPK (Form + Photo After — only by claimer) ──────────────
router.put(
  "/:order_number/execute",
  verifyToken,
  upload.single("photoAfter"),
  sapSpkController.executeSapSpk
);

// ── Step 3: Approval Kadis PP ────────────────────────────────────────────────
router.post("/:order_number/approve-kadis-pp", verifyToken, sapSpkController.approveKadisPp);
router.post("/:order_number/reject-kadis-pp", verifyToken, sapSpkController.rejectKadisPp);

// ── Step 4: Approval Kadis Pelapor ───────────────────────────────────────────
router.post("/:order_number/approve-kadis-pelapor", verifyToken, sapSpkController.approveKadisPelapor);
router.post("/:order_number/reject-kadis-pelapor", verifyToken, sapSpkController.rejectKadisPelapor);

// ── Delete Endpoints ─────────────────────────────────────────────────────────
router.delete("/", verifyToken, sapSpkController.deleteAllSapSpk);
router.delete("/:order_number", verifyToken, sapSpkController.deleteSapSpk);

module.exports = router;

