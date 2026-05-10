"use strict";

const SupervisiAmend = require("../../models/SupervisiAmend");
const SupervisiJob = require("../../models/SupervisiJob");
const {
  hasSupervisiAccess,
  isSupervisiScheduler,
  canAccessSupervisiJob,
  forbiddenMessage,
} = require("./supervisiAccess");
const { parseStringArray } = require("./supervisiHelpers");
const {
  filesToSupervisiPaths,
  uploadAmendDocuments,
} = require("./supervisiUpload");

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

    const uploadedPaths = filesToSupervisiPaths(req.files || []);

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
    const keptDocs = parseStringArray(existingDocuments) || [];
    const newDocs = filesToSupervisiPaths(req.files || []);
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
