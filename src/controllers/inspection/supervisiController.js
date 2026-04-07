"use strict";

const path = require("path");
const fs = require("fs");
const multer = require("multer");
const { Op } = require("sequelize");
const SupervisiJob = require("../../models/SupervisiJob");
const SupervisiVisit = require("../../models/SupervisiVisit");

// ── File upload config ────────────────────────────────────────────────────────
const uploadDir = path.join(__dirname, "../../../uploads/supervisi");
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `sv_${Date.now()}_${Math.random().toString(36).slice(2)}${ext}`);
  },
});
const upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 }, // 50 MB max per file
});

// Export multer middleware untuk dipakai di routes
const uploadPhotos = upload.array("photos", 20);

// ─────────────────────────────────────────────────────────────────────────────
// JOBS
// ─────────────────────────────────────────────────────────────────────────────

// GET /api/inspection/supervisi/jobs
async function listJobs(req, res) {
  try {
    const where = {};
    if (req.query.status) where.status = req.query.status;
    if (req.query.createdBy) where.createdBy = req.query.createdBy;
    if (req.query.picSupervisi) where.picSupervisi = req.query.picSupervisi;

    const jobs = await SupervisiJob.findAll({
      where,
      order: [["waktuMulai", "DESC"]],
      include: [{ model: SupervisiVisit, as: "visits" }],
    });

    res.json({ success: true, data: jobs });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}

// GET /api/inspection/supervisi/jobs/:id
async function getJob(req, res) {
  try {
    const job = await SupervisiJob.findByPk(req.params.id, {
      include: [{ model: SupervisiVisit, as: "visits", order: [["visitDate", "ASC"]] }],
    });
    if (!job) return res.status(404).json({ success: false, message: "Job tidak ditemukan." });
    res.json({ success: true, data: job });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}

// POST /api/inspection/supervisi/jobs
async function createJob(req, res) {
  try {
    const {
      namaKerja,
      nomorJo,
      nilaiPekerjaan,
      pelaksana,
      waktuMulai,
      waktuBerakhir,
      namaPengawas,
      picSupervisi,
    } = req.body;

    if (!namaKerja || !nomorJo || !pelaksana || !waktuMulai || !waktuBerakhir) {
      return res.status(400).json({ success: false, message: "Field wajib belum lengkap." });
    }

    const job = await SupervisiJob.create({
      namaKerja,
      nomorJo,
      nilaiPekerjaan: nilaiPekerjaan ? parseFloat(nilaiPekerjaan) : null,
      pelaksana,
      waktuMulai,
      waktuBerakhir,
      namaPengawas,
      picSupervisi,
      createdBy: req.user.username,
    });

    res.status(201).json({ success: true, message: "Pekerjaan supervisi berhasil dibuat.", data: job });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}

// PUT /api/inspection/supervisi/jobs/:id
async function updateJob(req, res) {
  try {
    const job = await SupervisiJob.findByPk(req.params.id);
    if (!job) return res.status(404).json({ success: false, message: "Job tidak ditemukan." });

    await job.update(req.body);
    res.json({ success: true, message: "Job diperbarui.", data: job });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// VISITS
// ─────────────────────────────────────────────────────────────────────────────

// GET /api/inspection/supervisi/jobs/:id/visits
async function listVisits(req, res) {
  try {
    const visits = await SupervisiVisit.findAll({
      where: { jobId: req.params.id },
      order: [["visitDate", "ASC"]],
    });
    res.json({ success: true, data: visits });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}

// POST /api/inspection/supervisi/visits
// Multipart form: jobId, visitDate, status, keterangan/alasanTidakHadir + photos[]
async function submitVisit(req, res) {
  // multer sudah dijalankan di middleware sebelum controller ini
  try {
    const { jobId, visitDate, status, keterangan, alasanTidakHadir } = req.body;

    if (!jobId || !visitDate || !status) {
      return res.status(400).json({ success: false, message: "jobId, visitDate, dan status wajib diisi." });
    }

    if (!["hadir", "tidak_hadir"].includes(status)) {
      return res.status(400).json({ success: false, message: "Status harus 'hadir' atau 'tidak_hadir'." });
    }

    if (status === "hadir" && !keterangan) {
      return res.status(400).json({ success: false, message: "Keterangan wajib diisi jika hadir." });
    }

    if (status === "tidak_hadir" && !alasanTidakHadir) {
      return res.status(400).json({ success: false, message: "Alasan tidak hadir wajib diisi." });
    }

    // Cek job ada
    const job = await SupervisiJob.findByPk(jobId);
    if (!job) return res.status(404).json({ success: false, message: "Job tidak ditemukan." });

    // Kumpulkan paths foto yang diupload
    const photoPaths = (req.files || []).map(
      (f) => `/uploads/supervisi/${f.filename}`
    );

    // Upsert — jika sudah ada visit untuk hari ini, update; jika belum, buat baru
    const [visit, created] = await SupervisiVisit.findOrCreate({
      where: { jobId: parseInt(jobId), visitDate },
      defaults: {
        status,
        keterangan: status === "hadir" ? keterangan : null,
        alasanTidakHadir: status === "tidak_hadir" ? alasanTidakHadir : null,
        photos: photoPaths,
        submittedBy: req.user.username,
        submittedAt: new Date(),
        isPelanggaran: status === "tidak_hadir",
      },
    });

    if (!created) {
      // Update existing visit
      await visit.update({
        status,
        keterangan: status === "hadir" ? keterangan : null,
        alasanTidakHadir: status === "tidak_hadir" ? alasanTidakHadir : null,
        photos: photoPaths.length > 0 ? photoPaths : visit.photos,
        submittedBy: req.user.username,
        submittedAt: new Date(),
        isPelanggaran: status === "tidak_hadir",
      });
    }

    res.status(created ? 201 : 200).json({
      success: true,
      message: created ? "Kunjungan berhasil dicatat." : "Kunjungan berhasil diperbarui.",
      data: visit,
    });
  } catch (err) {
    // Handle unique constraint violation
    if (err.name === "SequelizeUniqueConstraintError") {
      return res.status(409).json({ success: false, message: "Kunjungan untuk hari ini sudah tercatat." });
    }
    res.status(500).json({ success: false, message: err.message });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// PELANGGARAN
// ─────────────────────────────────────────────────────────────────────────────

// GET /api/inspection/supervisi/pelanggaran
async function listPelanggaran(req, res) {
  try {
    const where = { isPelanggaran: true };
    if (req.query.jobId) where.jobId = req.query.jobId;

    const pelanggaran = await SupervisiVisit.findAll({
      where,
      order: [["visitDate", "DESC"]],
      include: [{ model: SupervisiJob, as: "job", attributes: ["id", "namaKerja", "nomorJo", "pelaksana"] }],
    });

    res.json({ success: true, data: pelanggaran });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}

module.exports = {
  uploadPhotos,
  listJobs,
  getJob,
  createJob,
  updateJob,
  listVisits,
  submitVisit,
  listPelanggaran,
};
