"use strict";

const path = require("path");
const fs = require("fs");
const multer = require("multer");
const SupervisiAmend = require("../../models/SupervisiAmend");
const SupervisiJob = require("../../models/SupervisiJob");
const {
  hasSupervisiAccess,
  isSupervisiScheduler,
  canAccessSupervisiJob,
  forbiddenMessage,
} = require("./supervisiAccess");

// ── File upload config ────────────────────────────────────────────────────────
const uploadDir = path.join(__dirname, "../../../uploads/supervisi");
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `sv_amend_${Date.now()}_${Math.random().toString(36).slice(2)}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 20 * 1024 * 1024 }, // 20 MB max per file
});

const uploadAmendDocuments = upload.array("documents", 10);

// ── Helpers ───────────────────────────────────────────────────────────────────
function parseStringArray(value) {
  if (Array.isArray(value)) return value.filter(Boolean);
  if (value === null || value === "" || value === undefined) return [];
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) return parsed.filter(Boolean);
    } catch (_) {}
  }
  return [];
}

// POST /api/inspection/supervisi/jobs/:jobId/amends
async function createAmend(req, res) {
  try {
    if (!isSupervisiScheduler(req.user)) {
      return res.status(403).json({
        success: false,
        message: "Hanya pembuat jadwal supervisi yang dapat menambahkan amend.",
      });
    }

    const jobId = parseInt(req.params.jobId, 10);
    if (isNaN(jobId)) {
      return res.status(400).json({ success: false, message: "jobId tidak valid." });
    }

    const job = await SupervisiJob.findByPk(jobId);
    if (!job) {
      return res.status(404).json({ success: false, message: "Job tidak ditemukan." });
    }

    const { nomorAmend, amendMulai, amendBerakhir } = req.body;

    if (!nomorAmend || !amendMulai || !amendBerakhir) {
      return res.status(400).json({
        success: false,
        message: "nomorAmend, amendMulai, dan amendBerakhir wajib diisi.",
      });
    }

    if (new Date(amendBerakhir) <= new Date(amendMulai)) {
      return res.status(400).json({
        success: false,
        message: "Tanggal akhir amend harus setelah tanggal mulai amend.",
      });
    }

    // Kumpulkan paths dokumen yang diupload
    const uploadedPaths = ((req.files) || []).map(
      (f) => `/uploads/supervisi/${f.filename}`,
    );

    const amend = await SupervisiAmend.create({
      jobId,
      nomorAmend: String(nomorAmend).trim(),
      amendMulai: String(amendMulai),
      amendBerakhir: String(amendBerakhir),
      documents: uploadedPaths,
    });

    res.status(201).json({
      success: true,
      message: "Amend berhasil ditambahkan.",
      data: amend,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}

// PUT /api/inspection/supervisi/jobs/:jobId/amends/:amendId
async function updateAmend(req, res) {
  try {
    if (!isSupervisiScheduler(req.user)) {
      return res.status(403).json({
        success: false,
        message: "Hanya pembuat jadwal supervisi yang dapat memperbarui amend.",
      });
    }

    const jobId = parseInt(req.params.jobId, 10);
    const amendId = parseInt(req.params.amendId, 10);

    if (isNaN(jobId) || isNaN(amendId)) {
      return res.status(400).json({ success: false, message: "Parameter tidak valid." });
    }

    const amend = await SupervisiAmend.findOne({ where: { id: amendId, jobId } });
    if (!amend) {
      return res.status(404).json({ success: false, message: "Amend tidak ditemukan." });
    }

    const { nomorAmend, amendMulai, amendBerakhir, existingDocuments } = req.body;

    if (amendMulai && amendBerakhir && new Date(amendBerakhir) <= new Date(amendMulai)) {
      return res.status(400).json({
        success: false,
        message: "Tanggal akhir amend harus setelah tanggal mulai amend.",
      });
    }

    // Gabungkan dokumen lama yang dipertahankan + dokumen baru
    const keptDocs = parseStringArray(existingDocuments);
    const newDocs = ((req.files) || []).map(
      (f) => `/uploads/supervisi/${f.filename}`,
    );
    const allDocs = [...keptDocs, ...newDocs];

    await amend.update({
      ...(nomorAmend !== undefined && { nomorAmend: String(nomorAmend).trim() }),
      ...(amendMulai !== undefined && { amendMulai: String(amendMulai) }),
      ...(amendBerakhir !== undefined && { amendBerakhir: String(amendBerakhir) }),
      documents: allDocs,
    });

    res.json({ success: true, message: "Amend berhasil diperbarui.", data: amend });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}

// DELETE /api/inspection/supervisi/jobs/:jobId/amends/:amendId
async function deleteAmend(req, res) {
  try {
    if (!isSupervisiScheduler(req.user)) {
      return res.status(403).json({
        success: false,
        message: "Hanya pembuat jadwal supervisi yang dapat menghapus amend.",
      });
    }

    const jobId = parseInt(req.params.jobId, 10);
    const amendId = parseInt(req.params.amendId, 10);

    const amend = await SupervisiAmend.findOne({ where: { id: amendId, jobId } });
    if (!amend) {
      return res.status(404).json({ success: false, message: "Amend tidak ditemukan." });
    }

    await amend.destroy();
    res.json({ success: true, message: "Amend berhasil dihapus." });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}

// GET /api/inspection/supervisi/jobs/:jobId/amends
async function listAmends(req, res) {
  try {
    const jobId = parseInt(req.params.jobId, 10);
    if (!hasSupervisiAccess(req.user)) {
      return res.status(403).json({
        success: false,
        message: forbiddenMessage(),
      });
    }

    const job = await SupervisiJob.findByPk(jobId);
    if (!job) {
      return res.status(404).json({
        success: false,
        message: "Job tidak ditemukan.",
      });
    }

    if (!canAccessSupervisiJob(req.user, job)) {
      return res.status(403).json({
        success: false,
        message: forbiddenMessage(),
      });
    }

    const amends = await SupervisiAmend.findAll({
      where: { jobId },
      order: [["amendMulai", "ASC"]],
    });
    res.json({ success: true, data: amends });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}

module.exports = {
  uploadAmendDocuments,
  createAmend,
  updateAmend,
  deleteAmend,
  listAmends,
};
