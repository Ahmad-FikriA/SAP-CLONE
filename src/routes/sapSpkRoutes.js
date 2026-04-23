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

// Routes
router.get("/", verifyToken, sapSpkController.getSapSpkList);

// Upload Excel endpoint
router.post(
  "/upload-excel",
  verifyToken,
  upload.single("excelFile"),
  sapSpkController.uploadExcel
);

// Teknisi Execute SPK (Upload Photo Before and After)
router.put(
  "/:order_number/execute",
  verifyToken,
  upload.fields([
    { name: "photoBefore", maxCount: 1 },
    { name: "photoAfter", maxCount: 1 },
  ]),
  sapSpkController.executeSapSpk
);

// Delete Endpoints
router.delete("/", verifyToken, sapSpkController.deleteAllSapSpk);
router.delete("/:order_number", verifyToken, sapSpkController.deleteSapSpk);

module.exports = router;
