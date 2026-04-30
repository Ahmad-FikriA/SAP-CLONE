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


router.get("/", verifyToken, sapSpkController.getSapSpkList);


router.get("/reason-codes", verifyToken, sapSpkController.getReasonOfVarianceCodes);


router.post(
  "/upload-excel",
  verifyToken,
  upload.single("excelFile"),
  sapSpkController.uploadExcel
);


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


router.delete("/", verifyToken, sapSpkController.deleteAllSapSpk);
router.delete("/:order_number", verifyToken, sapSpkController.deleteSapSpk);

module.exports = router;

