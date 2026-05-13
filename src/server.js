"use strict";

require("dotenv").config();
const express = require("express");
const cors = require("cors");
const path = require("path");
const multer = require("multer");

const authRoutes = require("./routes/auth");
const usersRoutes = require("./routes/users");
const {
  spkRouter,
  equipmentRouter,
  mapsRouter,
  submissionsRouter,
  funcLocRouter,
  taskListRouter,
  plantRouter,
  mappingRouter,
  scheduleRouter,
} = require("./routes/preventive");
const correctiveRoutes = require("./routes/corrective");
const sapSpkRoutes = require("./routes/sapSpkRoutes");
const inspectionRoutes = require("./routes/inspection");
const notificationRoutes = require("./routes/notification");
const k3SafetyRoutes = require("./routes/k3_safety");
const materialRoutes = require("./routes/material");
const errorHandler = require("./middleware/errorHandler");
const { syncDatabase } = require("./config/syncMode");
const { ensureSupervisiJobSchema } = require("./models/SupervisiJob");
const { ensureSupervisiVisitSchema } = require("./models/SupervisiVisit");
const {
  ensureGeneralTaskListActivitySchema,
  ensureSpkActivitySchema,
  ensureSubmissionActivityResultSchema,
  ensureInspectionScheduleRecurringSchema,
  ensureMaterialSchema,
} = require("./models/ensureMeasurementSchema");
const { ensureInspectionEnums } = require("./migrate_inspection_enums");
const { markMissedVisitsAsPelanggaran } = require("./controllers/inspection/supervisiController");
const { sendInspectionReminders } = require("./controllers/inspection/scheduleController");
const cron = require("node-cron");

// Register all Sequelize model associations (must run before any query)
require("./models/associations");

const app = express();
const PORT = process.env.PORT || 3000;

// Catch unhandled promise rejections to pinpoint the mystery crash
process.on('unhandledRejection', (reason, promise) => {
  console.error('🚨 UNHANDLED PROMISE REJECTION DETECTED!');
  console.error('Promise:', promise);
  console.error('Reason:', reason);
  console.error('Stack Trace:', reason && reason.stack ? reason.stack : 'No stack');
  process.exit(1);
});

// ── Middleware ──────────────────────────────────────────────────────────────
const corsOptions = {
  origin: (origin, callback) => {
    // Allow requests with no origin (mobile apps, curl, Postman)
    // and any devlabfortirta.cloud subdomain
    if (!origin || origin.endsWith('.devlabfortirta.cloud') || origin === 'http://localhost:3001') {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
};
app.options('*', cors(corsOptions));
app.use(cors(corsOptions));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

app.use("/uploads", express.static(path.join(__dirname, "..", "uploads")));
app.use("/api/uploads", express.static(path.join(__dirname, "..", "uploads"))); // nginx-proxied alias
app.use("/storage", express.static(path.join(__dirname, "..", "storage")));

// ── Photo Upload Configuration ───────────────────────────────────────────────
const storage = multer.diskStorage({
  destination: path.join(__dirname, "..", "uploads"),
  filename: (req, file, cb) => {
    cb(null, `${Date.now()}_${file.originalname}`);
  },
});

// 2MB file size limit for corrective maintenance photos
const CORRECTIVE_PHOTO_MAX_SIZE = 2 * 1024 * 1024; // 2MB
// 5MB limit for preventive photos (watermarked + compressed by Flutter)
const PREVENTIVE_PHOTO_MAX_SIZE = 5 * 1024 * 1024; // 5MB

const upload = multer({
  storage,
  limits: { fileSize: CORRECTIVE_PHOTO_MAX_SIZE },
  fileFilter: (req, file, cb) => {
    if (!file.mimetype.startsWith('image/')) {
      return cb(new Error('Only image files are allowed'), false);
    }
    cb(null, true);
  },
});

const preventiveUpload = multer({
  storage,
  limits: { fileSize: PREVENTIVE_PHOTO_MAX_SIZE },
  fileFilter: (req, file, cb) => {
    if (!file.mimetype.startsWith('image/')) {
      return cb(new Error('Only image files are allowed'), false);
    }
    cb(null, true);
  },
});

// Multiple photos upload (for corrective maintenance - max 2 photos, 2MB each)
const uploadCorrectivePhotos = multer({
  storage,
  limits: {
    fileSize: CORRECTIVE_PHOTO_MAX_SIZE,
    files: 2, // Max 2 files per upload
  },
  fileFilter: (req, file, cb) => {
    if (!file.mimetype.startsWith('image/')) {
      return cb(new Error('Only image files are allowed'), false);
    }
    cb(null, true);
  },
});

// Storage for inspection media (images/videos)
const inspectionStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, "..", "uploads", "inspection");
    // Create directory if not exists
    require('fs').mkdirSync(uploadDir, { recursive: true });
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    cb(null, `${Date.now()}_${file.originalname}`);
  },
});

// 50MB file size limit for inspection media (images and videos).
// Keep this aligned with the Flutter inspection video validator.
const INSPECTION_MEDIA_MAX_SIZE_MB = 50;
const INSPECTION_MEDIA_MAX_SIZE = INSPECTION_MEDIA_MAX_SIZE_MB * 1024 * 1024;
const INSPECTION_MEDIA_MAX_COUNT = 10;
const INSPECTION_MEDIA_ALLOWED_EXTENSIONS = new Set([
  ".jpg",
  ".jpeg",
  ".jfif",
  ".png",
  ".gif",
  ".webp",
  ".heic",
  ".heif",
  ".mp4",
  ".m4v",
  ".mpeg",
  ".mpg",
  ".3gp",
  ".3gpp",
  ".mov",
  ".avi",
  ".mkv",
  ".webm",
  // Document extensions — for inspection report attachments
  ".pdf",
  ".doc",
  ".docx",
  ".xls",
  ".xlsx",
]);

function isInspectionMediaAllowed(file) {
  const mimeType = String(file?.mimetype || "").toLowerCase();
  const originalName = String(file?.originalname || "");
  const extension = path.extname(originalName).toLowerCase();
  const hasAllowedMimePrefix =
    mimeType.startsWith("image/") || mimeType.startsWith("video/");
  const hasAllowedExtension = INSPECTION_MEDIA_ALLOWED_EXTENSIONS.has(extension);
  const looksLikeBlobUpload =
    mimeType === "application/octet-stream" &&
    (originalName.toLowerCase() === "blob" || originalName.toLowerCase().startsWith("image_picker"));
  // Accept document MIME types (PDF, Word, Excel) for inspection attachments
  const isDocumentMime =
    mimeType === "application/pdf" ||
    mimeType === "application/msword" ||
    mimeType.includes("officedocument") ||
    mimeType === "application/vnd.ms-excel";

  return hasAllowedMimePrefix || hasAllowedExtension || looksLikeBlobUpload || isDocumentMime;
}

const uploadInspectionMedia = multer({
  storage: inspectionStorage,
  limits: {
    fileSize: INSPECTION_MEDIA_MAX_SIZE,
    files: INSPECTION_MEDIA_MAX_COUNT,
  },
  fileFilter: (req, file, cb) => {
    // Accept images/videos by MIME type OR by known file extension
    // (some clients send application/octet-stream for camera files).
    if (!isInspectionMediaAllowed(file)) {
      return cb(new Error("Only image and video files are allowed"), false);
    }
    cb(null, true);
  },
});

function handleInspectionMediaUpload(req, res, next) {
  uploadInspectionMedia.array("media", INSPECTION_MEDIA_MAX_COUNT)(req, res, (err) => {
    if (!err) {
      return next();
    }

    if (err instanceof multer.MulterError) {
      if (err.code === "LIMIT_FILE_SIZE") {
        return res.status(400).json({
          success: false,
          error: `Ukuran file maksimal ${INSPECTION_MEDIA_MAX_SIZE_MB}MB per file.`,
        });
      }

      if (err.code === "LIMIT_FILE_COUNT") {
        return res.status(400).json({
          success: false,
          error: "Maksimal 5 file dalam sekali upload.",
        });
      }

      if (err.code === "LIMIT_UNEXPECTED_FILE") {
        return res.status(400).json({
          success: false,
          error: "Field upload tidak valid. Gunakan field 'media'.",
        });
      }
    }

    return res.status(400).json({
      success: false,
      error: err.message || "Gagal upload media.",
    });
  });
}

const { verifyToken } = require("./middleware/auth");

// Preventive maintenance photo upload endpoint (5MB, served under /api/uploads/)
app.post(
  "/api/upload/photo",
  verifyToken,
  preventiveUpload.single("photo"),
  (req, res) => {
    if (!req.file) return res.status(400).json({ error: "No file uploaded" });
    res.json({ path: `api/uploads/${req.file.filename}` });
  },
);

// Multiple photos upload endpoint for corrective maintenance
app.post('/api/upload/photos', verifyToken, uploadCorrectivePhotos.array('photos', 2), (req, res) => {
  if (!req.files || req.files.length === 0) {
    return res.status(400).json({ error: 'No files uploaded' });
  }
  const paths = req.files.map(file => `uploads/${file.filename}`);
  res.json({ paths });
});

// Multiple media upload endpoint for inspection requests (images & videos)
app.post('/api/upload/inspection-media', verifyToken, handleInspectionMediaUpload, (req, res) => {
  if (!req.files || req.files.length === 0) {
    return res.status(400).json({ success: false, error: 'No files uploaded' });
  }
  const paths = req.files.map(file => `uploads/inspection/${file.filename}`);
  res.json({ success: true, paths });
});

// ── API Routes ───────────────────────────────────────────────────────────────
app.use("/api/auth", authRoutes);
app.use("/api/users", usersRoutes);
app.use("/api/spk", spkRouter);
app.use("/api/equipment", equipmentRouter);
app.use("/api/maps", mapsRouter);
app.use("/api/plants", plantRouter);
app.use("/api/submissions", submissionsRouter);
app.use("/api/corrective", correctiveRoutes);
app.use("/api/corrective/sap-spk", sapSpkRoutes);
app.use("/api/inspection", inspectionRoutes);
app.use("/api/functional-locations", funcLocRouter);
app.use("/api/task-lists", taskListRouter);
app.use("/api/equipment-mappings", mappingRouter);
app.use("/api/preventive-schedule", scheduleRouter);
app.use("/api/notifications", notificationRoutes);
app.use("/api/k3-safety", k3SafetyRoutes);
app.use("/api/materials", materialRoutes);

// ── Settings ─────────────────────────────────────────────────────────────────
const settingsController = require('./controllers/settings/settingsController');
app.get('/api/settings/role-templates', verifyToken, settingsController.getRoleTemplates);
app.put('/api/settings/role-templates', verifyToken, settingsController.updateRoleTemplates);

// ── Error Handler ────────────────────────────────────────────────────────────
app.use(errorHandler);

// ── Database Connection Test ─────────────────────────────────────────────────
const sequelize = require("./config/database");

sequelize
  .authenticate()
  .then(() => {
    console.log("Connection to database has been established successfully.");
    return ensureSupervisiJobSchema();
  })
  .then(() => {
    console.log("Supervisi job schema ensured.");
    return ensureSupervisiVisitSchema();
  })
  .then(() => {
    console.log("Supervisi visit schema ensured.");
    return ensureGeneralTaskListActivitySchema();
  })
  .then(() => {
    console.log("General task list activity measurement schema ensured.");
    return ensureSpkActivitySchema();
  })
  .then(() => {
    console.log("SPK activity measurement schema ensured.");
    return ensureSubmissionActivityResultSchema();
  })
  .then(() => {
    console.log("Submission activity result measurement schema ensured.");
    return ensureInspectionScheduleRecurringSchema();
  })
  .then(() => {
    console.log("Inspection schedule recurring schema ensured.");
    return ensureMaterialSchema();
  })
  .then(() => {
    console.log("Material schema ensured.");
    return ensureInspectionEnums({ shouldAuthenticate: false });
  })
  .then(() => {
    console.log("Inspection enum schema ensured.");
    return syncDatabase(sequelize, "server startup");
  })
  .then(() => {
    console.log("Database models synced successfully.");
    // ── Supervisi: Cron job — tandai kunjungan yang terlewat sebagai Pelanggaran
    // Jalankan sekali saat server start (untuk menangkap backlog)
    markMissedVisitsAsPelanggaran();
    // Jadwalkan setiap hari pukul 00:01 server time
    cron.schedule("1 0 * * *", markMissedVisitsAsPelanggaran, {
      timezone: "Asia/Jakarta",
    });
    console.log("[Supervisi Cron] Scheduled daily missed-visit check at 00:01 Asia/Jakarta.");

    // ── Inspeksi: Cron job — kirim pengingat jadwal hari ini dan overdue
    sendInspectionReminders();
    // Jadwalkan setiap hari pukul 07:00 server time
    cron.schedule("0 7 * * *", sendInspectionReminders, {
      timezone: "Asia/Jakarta",
    });
    console.log("[Inspection Cron] Scheduled daily reminders at 07:00 Asia/Jakarta.");
  })
  .catch((err) => {
    console.error("Unable to connect to the database:", err);
  });

// ── Start Server ─────────────────────────────────────────────────────────────
// Only start server if not in test environment
if (process.env.NODE_ENV !== 'test') {
  app.listen(PORT, () => {
    console.log(`\n  KTI SAP Mock Server`);
    console.log(`  ───────────────────────────────`);
    console.log(`  API:      http://localhost:${PORT}/api`);
    console.log(`  Admin UI: http://localhost:${PORT}\n`);
  });
}

module.exports = app;
