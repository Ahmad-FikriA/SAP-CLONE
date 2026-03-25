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
  lkRouter,
  equipmentRouter,
  mapsRouter,
  submissionsRouter,
  funcLocRouter,
  taskListRouter,
} = require("./routes/preventive");
const correctiveRoutes = require("./routes/corrective");
const inspectionRoutes = require("./routes/inspection");
const errorHandler = require("./middleware/errorHandler");

// Register all Sequelize model associations (must run before any query)
require("./models/associations");

const app = express();
const PORT = process.env.PORT || 3000;

// ── Middleware ──────────────────────────────────────────────────────────────
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// ── Static Admin UI ─────────────────────────────────────────────────────────
// No-cache in dev so every refresh gets the latest files.
// In production, short maxAge (5 min) with ETag so browsers revalidate quickly.
const IS_DEV = process.env.NODE_ENV !== "production";
app.use(
  express.static(path.join(__dirname, "..", "public"), {
    etag: true,
    lastModified: true,
    maxAge: IS_DEV ? 0 : "5m",
    setHeaders(res) {
      if (IS_DEV) {
        res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate");
        res.setHeader("Pragma", "no-cache");
      }
    },
  }),
);
app.use("/uploads", express.static(path.join(__dirname, "..", "uploads")));
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

const upload = multer({
  storage,
  limits: {
    fileSize: CORRECTIVE_PHOTO_MAX_SIZE,
  },
  fileFilter: (req, file, cb) => {
    // Accept only image files
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

// 25MB file size limit for inspection media (images and videos)
const INSPECTION_MEDIA_MAX_SIZE_MB = 25;
const INSPECTION_MEDIA_MAX_SIZE = INSPECTION_MEDIA_MAX_SIZE_MB * 1024 * 1024;
const INSPECTION_MEDIA_MAX_COUNT = 5;
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

  return hasAllowedMimePrefix || hasAllowedExtension || looksLikeBlobUpload;
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

// Generic photo upload endpoint
app.post(
  "/api/upload/photo",
  verifyToken,
  upload.single("photo"),
  (req, res) => {
    if (!req.file) return res.status(400).json({ error: "No file uploaded" });
    res.json({ path: `uploads/${req.file.filename}` });
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
app.use("/api/lk", lkRouter);
app.use("/api/equipment", equipmentRouter);
app.use("/api/maps", mapsRouter);
app.use("/api/submissions", submissionsRouter);
app.use("/api/corrective", correctiveRoutes);
app.use("/api/inspection", inspectionRoutes);
app.use("/api/functional-locations", funcLocRouter);
app.use("/api/task-lists", taskListRouter);

// ── SPA fallback: serve index.html for any non-API GET ───────────────────────
app.get(/^(?!\/api).*$/, (req, res) => {
  res.sendFile(path.join(__dirname, "..", "public", "index.html"));
});

// ── Error Handler ────────────────────────────────────────────────────────────
app.use(errorHandler);

// ── Database Connection Test ─────────────────────────────────────────────────
const sequelize = require("./config/database");

sequelize
  .authenticate()
  .then(() => {
    console.log("Connection to database has been established successfully.");
    // Sync models (alter: true to add new columns/enums without dropping data)
    return sequelize.sync({ alter: true });
  })
  .then(() => {
    console.log("Database models synced successfully.");
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
