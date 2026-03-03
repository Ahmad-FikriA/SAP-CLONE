'use strict';

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const multer = require('multer');

const authRoutes = require('./routes/auth');
const lkRoutes = require('./routes/lembarKerja');
const spkRoutes = require('./routes/spk');
const equipmentRoutes = require('./routes/equipment');
const usersRoutes = require('./routes/users');
const submissionsRoutes = require('./routes/submissions');
const mapsRoutes = require('./routes/maps');
const errorHandler = require('./middleware/errorHandler');

const app = express();
const PORT = process.env.PORT || 3000;

// ── Middleware ──────────────────────────────────────────────────────────────
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ── Static Admin UI ─────────────────────────────────────────────────────────
app.use(express.static(path.join(__dirname, '..', 'public')));
app.use('/uploads', express.static(path.join(__dirname, '..', 'uploads')));

// ── Photo Upload ─────────────────────────────────────────────────────────────
const storage = multer.diskStorage({
  destination: path.join(__dirname, '..', 'uploads'),
  filename: (req, file, cb) => {
    cb(null, `${Date.now()}_${file.originalname}`);
  }
});
const upload = multer({ storage });

const { verifyToken } = require('./middleware/auth');

app.post('/api/upload/photo', verifyToken, upload.single('photo'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
  res.json({ path: `uploads/${req.file.filename}` });
});

// ── API Routes ───────────────────────────────────────────────────────────────
app.use('/api/auth', authRoutes);
app.use('/api/lk', lkRoutes);
app.use('/api/spk', spkRoutes);
app.use('/api/equipment', equipmentRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/submissions', submissionsRoutes);
app.use('/api/maps', mapsRoutes);

// ── SPA fallback: serve index.html for any non-API GET ───────────────────────
app.get(/^(?!\/api).*$/, (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
});

// ── Error Handler ────────────────────────────────────────────────────────────
app.use(errorHandler);

// ── Database Connection Test ─────────────────────────────────────────────────
const sequelize = require('./config/database');

sequelize.authenticate()
  .then(() => {
    console.log('Connection to database has been established successfully.');
  })
  .catch((err) => {
    console.error('Unable to connect to the database:', err);
  });

// ── Start Server ─────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`\n  KTI SAP Mock Server`);
  console.log(`  ───────────────────────────────`);
  console.log(`  API:      http://localhost:${PORT}/api`);
  console.log(`  Admin UI: http://localhost:${PORT}\n`);
});

module.exports = app;
