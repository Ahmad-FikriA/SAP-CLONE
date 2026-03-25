"use strict";

const InspectionRequest = require("../../models/InspectionRequest");
const InspectionSchedule = require("../../models/InspectionSchedule");

/**
 * InspectionRequest Controller
 * Handles permintaan kunjungan inspeksi dari role User.
 * Planner bisa review, approve (→ buat jadwal otomatis), atau reject.
 */

// GET /api/inspection/requests
async function listRequests(req, res) {
  try {
    const where = {};

    // Filter by status
    if (req.query.status) where.status = req.query.status;

    // Filter by requestedBy (User lihat punya sendiri)
    if (req.query.requestedBy) where.requestedBy = req.query.requestedBy;

    const data = await InspectionRequest.findAll({
      where,
      order: [["createdAt", "DESC"]],
    });

    res.json({ success: true, message: "Requests retrieved.", data });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}

// GET /api/inspection/requests/:id
async function getRequest(req, res) {
  try {
    const request = await InspectionRequest.findByPk(req.params.id);

    if (!request) {
      return res
        .status(404)
        .json({ success: false, message: "Request not found." });
    }

    res.json({ success: true, message: "Request retrieved.", data: request });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}

// POST /api/inspection/requests
async function createRequest(req, res) {
  try {
    const {
      judul,
      lokasi,
      jenisInspeksi,
      tanggalDiinginkan,
      asapMungkin,
      deskripsi,
      mediaPaths,
    } = req.body;

    if (!judul || !lokasi || !jenisInspeksi) {
      return res.status(400).json({
        success: false,
        message: "judul, lokasi, dan jenisInspeksi wajib diisi.",
      });
    }

    const request = await InspectionRequest.create({
      judul,
      lokasi,
      jenisInspeksi,
      tanggalDiinginkan: asapMungkin ? null : tanggalDiinginkan,
      asapMungkin: asapMungkin ?? false,
      deskripsi,
      mediaPaths: mediaPaths ?? [],
      requestedBy: req.user?.username ?? "unknown",
      status: "pending",
    });

    res.status(201).json({
      success: true,
      message: "Permintaan inspeksi berhasil dibuat.",
      data: request,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}

// PUT /api/inspection/requests/:id/approve
// Body: { notes?, scheduledDate?, assignedTo?, title?, unitKerja?, nomorPoJo? }
async function approveRequest(req, res) {
  try {
    const request = await InspectionRequest.findByPk(req.params.id);

    if (!request) {
      return res
        .status(404)
        .json({ success: false, message: "Request not found." });
    }

    if (request.status !== "pending") {
      return res.status(400).json({
        success: false,
        message: `Request sudah di-${request.status}, tidak bisa di-approve lagi.`,
      });
    }

    const { notes, scheduledDate, assignedTo, title, unitKerja, nomorPoJo } =
      req.body;

    // Tentukan tanggal jadwal: dari req.body atau dari tanggalDiinginkan user
    const finalDate =
      scheduledDate ||
      request.tanggalDiinginkan ||
      new Date().toISOString().split("T")[0];

    // Tentukan assignedTo berdasarkan jenisInspeksi
    const finalAssignedTo =
      assignedTo ||
      (request.jenisInspeksi === "k3" ? "dinas_hse" : "dinas_inspeksi");

    // Auto-create InspectionSchedule
    const schedule = await InspectionSchedule.create({
      type: request.jenisInspeksi === "k3" ? "k3" : "rutin",
      title: title || request.judul,
      unitKerja: unitKerja || null,
      location: request.lokasi,
      scheduledDate: finalDate,
      createdBy: req.user?.username ?? "planner",
      assignedTo: finalAssignedTo,
      triggerSource: "planner",
      nomorPoJo: nomorPoJo || null,
      notes: request.deskripsi,
      status: "scheduled",
    });

    // Update request
    await request.update({
      status: "approved",
      approvedBy: req.user?.username,
      approvedAt: new Date(),
      notes,
      scheduleId: schedule.id,
    });

    res.json({
      success: true,
      message: "Permintaan inspeksi disetujui. Jadwal otomatis dibuat.",
      data: { request, schedule },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}

// PUT /api/inspection/requests/:id/reject
// Body: { notes }
async function rejectRequest(req, res) {
  try {
    const request = await InspectionRequest.findByPk(req.params.id);

    if (!request) {
      return res
        .status(404)
        .json({ success: false, message: "Request not found." });
    }

    if (request.status !== "pending") {
      return res.status(400).json({
        success: false,
        message: `Request sudah di-${request.status}.`,
      });
    }

    await request.update({
      status: "rejected",
      approvedBy: req.user?.username,
      approvedAt: new Date(),
      notes: req.body.notes,
    });

    res.json({
      success: true,
      message: "Permintaan inspeksi ditolak.",
      data: request,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}

// PUT /api/inspection/requests/:id/cancel
// Body: { notes }
async function cancelRequest(req, res) {
  try {
    const request = await InspectionRequest.findByPk(req.params.id);

    if (!request) {
      return res
        .status(404)
        .json({ success: false, message: "Request not found." });
    }

    if (request.requestedBy !== req.user?.username) {
      return res.status(403).json({
        success: false,
        message: "Anda hanya dapat membatalkan permintaan milik sendiri.",
      });
    }

    if (request.status !== "pending") {
      return res.status(400).json({
        success: false,
        message: "Permintaan hanya dapat dibatalkan selama status masih proses.",
      });
    }

    const cancellationNote = req.body?.notes?.toString().trim();

    await request.update({
      status: "cancelled",
      notes:
        cancellationNote && cancellationNote.length > 0
          ? `[Dibatalkan User] ${cancellationNote}`
          : "[Dibatalkan User]",
    });

    res.json({
      success: true,
      message: "Permintaan inspeksi berhasil dibatalkan.",
      data: request,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}

module.exports = {
  listRequests,
  getRequest,
  createRequest,
  approveRequest,
  rejectRequest,
  cancelRequest,
};
