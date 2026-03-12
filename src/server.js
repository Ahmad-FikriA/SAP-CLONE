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

// ── Photo Upload ─────────────────────────────────────────────────────────────
const storage = multer.diskStorage({
  destination: path.join(__dirname, "..", "uploads"),
  filename: (req, file, cb) => {
    cb(null, `${Date.now()}_${file.originalname}`);
  },
});
const upload = multer({ storage });

const { verifyToken } = require("./middleware/auth");

app.post(
  "/api/upload/photo",
  verifyToken,
  upload.single("photo"),
  (req, res) => {
    if (!req.file) return res.status(400).json({ error: "No file uploaded" });
    res.json({ path: `uploads/${req.file.filename}` });
  },
);

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
app.listen(PORT, () => {
  console.log(`\n  KTI SAP Mock Server`);
  console.log(`  ───────────────────────────────`);
  console.log(`  API:      http://localhost:${PORT}/api`);
  console.log(`  Admin UI: http://localhost:${PORT}\n`);
});

module.exports = app;
