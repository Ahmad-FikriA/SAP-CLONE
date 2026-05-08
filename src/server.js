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
const errorHandler = require("./middleware/errorHandler");
const { syncDatabase } = require("./config/syncMode");
const { ensureSupervisiJobSchema } = require("./models/SupervisiJob");
const { ensureSupervisiVisitSchema } = require("./models/SupervisiVisit");
const {
  ensureGeneralTaskListActivitySchema,
  ensureSpkActivitySchema,
  ensureSubmissionActivityResultSchema,
  ensureInspectionScheduleRecurringSchema,
} = require("./models/ensureMeasurementSchema");
const { ensureInspectionEnums } = require("./migrate_inspection_enums");
const {
  markMissedVisitsAsPelanggaran,
} = require("./controllers/inspection/supervisiController");
const {
  sendInspectionReminders,
} = require("./controllers/inspection/scheduleController");
const cron = require("node-cron");

require("./models/associations");

const app = express();
const PORT = process.env.PORT || 3000;

process.on("unhandledRejection", (reason, promise) => {
  console.error("UNHANDLED PROMISE REJECTION DETECTED!");
  console.error("Promise:", promise);
  console.error("Reason:", reason);
  console.error(
    "Stack Trace:",
    reason && reason.stack ? reason.stack : "No stack",
  );
  process.exit(1);
});

const corsOptions = {
  origin: (origin, callback) => {
    if (
      !origin ||
      origin.endsWith(".devlabfortirta.cloud") ||
      origin === "http://localhost:3001"
    ) {
      callback(null, true);
    } else {
      callback(new Error("Not allowed by CORS"));
    }
  },
  credentials: true,
};
app.options("*", cors(corsOptions));
app.use(cors(corsOptions));
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

app.use("/uploads", express.static(path.join(__dirname, "..", "uploads")));
app.use("/api/uploads", express.static(path.join(__dirname, "..", "uploads")));
app.use("/storage", express.static(path.join(__dirname, "..", "storage")));

const storage = multer.diskStorage({
  destination: path.join(__dirname, "..", "uploads"),
  filename: (req, file, cb) => {
    cb(null, `${Date.now()}_${file.originalname}`);
  },
});

const CORRECTIVE_PHOTO_MAX_SIZE = 2 * 1024 * 1024;
const PREVENTIVE_PHOTO_MAX_SIZE = 5 * 1024 * 1024;

const upload = multer({
  storage,
  limits: { fileSize: CORRECTIVE_PHOTO_MAX_SIZE },
  fileFilter: (req, file, cb) => {
    if (!file.mimetype.startsWith("image/")) {
      return cb(new Error("Only image files are allowed"), false);
    }
    cb(null, true);
  },
});

const preventiveUpload = multer({
  storage,
  limits: { fileSize: PREVENTIVE_PHOTO_MAX_SIZE },
  fileFilter: (req, file, cb) => {
    if (!file.mimetype.startsWith("image/")) {
      return cb(new Error("Only image files are allowed"), false);
    }
    cb(null, true);
  },
});

const uploadCorrectivePhotos = multer({
  storage,
  limits: {
    fileSize: CORRECTIVE_PHOTO_MAX_SIZE,
    files: 2,
  },
  fileFilter: (req, file, cb) => {
    if (!file.mimetype.startsWith("image/")) {
      return cb(new Error("Only image files are allowed"), false);
    }
    cb(null, true);
  },
});

const inspectionStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, "..", "uploads", "inspection");
    require("fs").mkdirSync(uploadDir, { recursive: true });
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    cb(null, `${Date.now()}_${file.originalname}`);
  },
});

const INSPECTION_MEDIA_MAX_SIZE_MB = 50;
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
  const hasAllowedExtension =
    INSPECTION_MEDIA_ALLOWED_EXTENSIONS.has(extension);
  const looksLikeBlobUpload =
    mimeType === "application/octet-stream" &&
    (originalName.toLowerCase() === "blob" ||
      originalName.toLowerCase().startsWith("image_picker"));

  return hasAllowedMimePrefix || hasAllowedExtension || looksLikeBlobUpload;
}

const uploadInspectionMedia = multer({
  storage: inspectionStorage,
  limits: {
    fileSize: INSPECTION_MEDIA_MAX_SIZE,
    files: INSPECTION_MEDIA_MAX_COUNT,
  },
  fileFilter: (req, file, cb) => {
    if (!isInspectionMediaAllowed(file)) {
      return cb(new Error("Only image and video files are allowed"), false);
    }
    cb(null, true);
  },
});

function handleInspectionMediaUpload(req, res, next) {
  uploadInspectionMedia.array("media", INSPECTION_MEDIA_MAX_COUNT)(
    req,
    res,
    (err) => {
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
    },
  );
}

const { verifyToken } = require("./middleware/auth");

app.post(
  "/api/upload/photo",
  verifyToken,
  preventiveUpload.single("photo"),
  (req, res) => {
    if (!req.file) return res.status(400).json({ error: "No file uploaded" });
    res.json({ path: `api/uploads/${req.file.filename}` });
  },
);

app.post(
  "/api/upload/photos",
  verifyToken,
  uploadCorrectivePhotos.array("photos", 2),
  (req, res) => {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: "No files uploaded" });
    }
    const paths = req.files.map((file) => `uploads/${file.filename}`);
    res.json({ paths });
  },
);

app.post(
  "/api/upload/inspection-media",
  verifyToken,
  handleInspectionMediaUpload,
  (req, res) => {
    if (!req.files || req.files.length === 0) {
      return res
        .status(400)
        .json({ success: false, error: "No files uploaded" });
    }
    const paths = req.files.map(
      (file) => `uploads/inspection/${file.filename}`,
    );
    res.json({ success: true, paths });
  },
);

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

const settingsController = require("./controllers/settings/settingsController");
app.get(
  "/api/settings/role-templates",
  verifyToken,
  settingsController.getRoleTemplates,
);
app.put(
  "/api/settings/role-templates",
  verifyToken,
  settingsController.updateRoleTemplates,
);

app.get("/", (req, res) => {
  res.send("KTI MANTIS API is running");
});

app.use(errorHandler);

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
    return ensureInspectionEnums({ shouldAuthenticate: false });
  })
  .then(() => {
    console.log("Inspection enum schema ensured.");
    return syncDatabase(sequelize, "server startup");
  })
  .then(() => {
    console.log("Database models synced successfully.");
    markMissedVisitsAsPelanggaran();
    cron.schedule("1 0 * * *", markMissedVisitsAsPelanggaran, {
      timezone: "Asia/Jakarta",
    });
    console.log(
      "[Supervisi Cron] Scheduled daily missed-visit check at 00:01 Asia/Jakarta.",
    );

    sendInspectionReminders();
    cron.schedule("0 7 * * *", sendInspectionReminders, {
      timezone: "Asia/Jakarta",
    });
    console.log(
      "[Inspection Cron] Scheduled daily reminders at 07:00 Asia/Jakarta.",
    );
  })
  .catch((err) => {
    console.error("Unable to connect to the database:", err);
  });

if (process.env.NODE_ENV !== "test") {
  app.listen(PORT, () => {
    console.log(`\n  KTI MANTIS Server`);
    console.log(`  ───────────────────────────────`);
    console.log(`  API:      http://localhost:${PORT}/api`);
    console.log(`  Admin UI: http://localhost:${PORT}\n`);
  });
}

module.exports = app;
