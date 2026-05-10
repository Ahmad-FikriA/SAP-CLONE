"use strict";

const InspectionRequest = require("../../models/InspectionRequest");
const InspectionSchedule = require("../../models/InspectionSchedule");
const { buildAccessProfile } = require("../../services/accessProfile");
const { notify } = require("../../services/notificationService");

// NIK Planner & Approver yang menerima notifikasi request baru
const INSPECTION_PLANNER_NIK = "10000262";

/**
 * InspectionRequest Controller
 * Handles permintaan kunjungan inspeksi dari role User.
 * Planner bisa review, approve (→ buat jadwal otomatis), atau reject.
 */

function normalizeNik(value) {
  return String(value || "").trim();
}

function buildRequestRejectionNotification(request, notes) {
  const trimmedNotes =
    typeof notes === "string" && notes.trim().length > 0 ? notes.trim() : null;

  return {
    type: "request_rejected",
    title: "Permintaan Inspeksi Ditolak",
    body: `Permintaan inspeksi Anda untuk "${request.judul}" ditolak.${
      trimmedNotes ? ` Catatan: ${trimmedNotes}` : ""
    }`,
    deepLink: "inspection/riwayat",
    responseMessage: "Permintaan inspeksi ditolak.",
  };
}

function canViewAllRequests(user) {
  const profile = buildAccessProfile(user || {});
  const appRole = profile?.appRole;
  const flags = profile?.flags || {};

  return (
    appRole === "kasie" ||
    Boolean(
      flags.isInspectionPlanner ||
      flags.isPlanner ||
      flags.isInspectionApprover,
    )
  );
}

function canReviewRequests(user) {
  return canViewAllRequests(user);
}

// GET /api/inspection/requests
async function listRequests(req, res) {
  try {
    const where = {};
    const requesterNik = normalizeNik(req.user?.nik);
    const hasGlobalAccess = canViewAllRequests(req.user);
    const requestedByQuery = normalizeNik(req.query.requestedBy);

    // Filter by status
    if (req.query.status) where.status = req.query.status;

    // Filter by requestedBy (User lihat punya sendiri)
    if (requestedByQuery) {
      if (!hasGlobalAccess && requestedByQuery !== requesterNik) {
        return res.status(403).json({
          success: false,
          message: "Anda hanya dapat melihat permintaan milik akun sendiri.",
        });
      }
      where.requestedBy = requestedByQuery;
    } else if (!hasGlobalAccess) {
      if (!requesterNik) {
        return res.status(403).json({
          success: false,
          message: "Akun tidak memiliki identitas NIK yang valid.",
        });
      }
      where.requestedBy = requesterNik;
    }

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
    const requesterNik = normalizeNik(req.user?.nik);
    const hasGlobalAccess = canViewAllRequests(req.user);

    const request = await InspectionRequest.findByPk(req.params.id);

    if (!request) {
      return res
        .status(404)
        .json({ success: false, message: "Request not found." });
    }

    if (!hasGlobalAccess && normalizeNik(request.requestedBy) !== requesterNik) {
      return res.status(403).json({
        success: false,
        message: "Anda tidak memiliki akses ke permintaan ini.",
      });
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
      kategoriInspeksi,
      tanggalDiinginkan,
      asapMungkin,
      deskripsi,
      mediaPaths,
      requestedBy,
    } = req.body;

    if (!judul || !lokasi || !jenisInspeksi || !kategoriInspeksi) {
      return res.status(400).json({
        success: false,
        message: "judul, lokasi, jenisInspeksi, dan kategoriInspeksi wajib diisi.",
      });
    }

    // Validate kategori based on jenis
    const validRutinKategories = ["sipil", "mekanik", "elektrik", "otomasi"];
    const validK3Kategories = ["safety", "environment"];
    
    if (jenisInspeksi === "rutin" && !validRutinKategories.includes(kategoriInspeksi)) {
      return res.status(400).json({
        success: false,
        message: "Kategori tidak valid untuk jenis inspeksi rutin.",
      });
    }
    
    if (jenisInspeksi === "k3" && !validK3Kategories.includes(kategoriInspeksi)) {
      return res.status(400).json({
        success: false,
        message: "Kategori tidak valid untuk jenis inspeksi K3.",
      });
    }

    const requesterNik = normalizeNik(req.user?.nik);
    const requestedByBody = normalizeNik(requestedBy);

    // Ambil requesterNik yang valid dari token JWT (paling aman).
    // Jika tidak ada, gunakan body payload (untuk backward compatibility).
    const finalRequestedBy = requesterNik || requestedByBody || "unknown";

    const request = await InspectionRequest.create({
      judul,
      lokasi,
      jenisInspeksi,
      kategoriInspeksi,
      tanggalDiinginkan: asapMungkin ? null : tanggalDiinginkan,
      asapMungkin: asapMungkin ?? false,
      deskripsi,
      mediaPaths: mediaPaths ?? [],
      requestedBy: finalRequestedBy,
      status: "pending",
    });

    // Kirim FCM push notification ke Planner
    notify({
      module: 'inspection',
      type: 'request_created',
      title: 'Permintaan Inspeksi Baru',
      body: `Permintaan "${judul}" dari ${finalRequestedBy} menunggu persetujuan Anda.`,
      data: {
        deepLink: 'inspection/permintaan',
        requestId: String(request.id),
      },
      recipientIds: [INSPECTION_PLANNER_NIK],
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
// Body: { notes?, scheduledDate?, assignedTo?, title?, nomorPoJo? }
async function approveRequest(req, res) {
  try {
    if (!canReviewRequests(req.user)) {
      return res.status(403).json({
        success: false,
        message: "Anda tidak memiliki akses untuk meninjau permintaan inspeksi.",
      });
    }

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

    const { notes, scheduledDate, assignedTo, title, nomorPoJo } = req.body;
    const plannerNotes =
      typeof notes === "string" && notes.trim().length > 0
        ? notes.trim()
        : null;

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
      location: request.lokasi,
      scheduledDate: finalDate,
      createdBy: req.user?.nik ?? "planner",
      assignedTo: finalAssignedTo,
      triggerSource: "planner",
      nomorPoJo: nomorPoJo || null,
      notes: plannerNotes,
      status: "scheduled",
    });

    // Update request
    await request.update({
      status: "approved",
      approvedBy: req.user?.nik,
      approvedAt: new Date(),
      notes: plannerNotes,
      scheduleId: schedule.id,
    });

    // Notifikasi ke pemohon bahwa request-nya disetujui
    notify({
      module: 'inspection',
      type: 'request_approved',
      title: 'Permintaan Inspeksi Disetujui',
      body: `Permintaan inspeksi Anda untuk "${request.judul}" telah disetujui dan dijadwalkan.`,
      data: {
        deepLink: 'inspection/riwayat',
        requestId: String(request.id),
      },
      recipientIds: [String(request.requestedBy)],
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
    if (!canReviewRequests(req.user)) {
      return res.status(403).json({
        success: false,
        message: "Anda tidak memiliki akses untuk meninjau permintaan inspeksi.",
      });
    }

    const request = await InspectionRequest.findByPk(req.params.id);

    if (!request) {
      return res
        .status(404)
        .json({ success: false, message: "Request not found." });
    }

    if (request.status !== "pending" && request.status !== "revisions_required") {
      return res.status(400).json({
        success: false,
        message: `Request sudah di-${request.status} dan tidak dapat diproses lagi.`,
      });
    }

    const notification = buildRequestRejectionNotification(
      request,
      req.body.notes,
    );

    await request.update({
      status: "rejected",
      approvedBy: req.user?.nik,
      approvedAt: new Date(),
      notes: req.body.notes,
    });

    // Notifikasi ke pemohon bahwa request-nya ditolak
    notify({
      module: 'inspection',
      type: notification.type,
      title: notification.title,
      body: notification.body,
      data: {
        deepLink: notification.deepLink,
        requestId: String(request.id),
      },
      recipientIds: [String(request.requestedBy)],
    });

    res.json({
      success: true,
      message: notification.responseMessage,
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

    if (request.requestedBy !== req.user?.nik) {
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

    // Notifikasi ke Planner bahwa request dibatalkan
    notify({
      module: 'inspection',
      type: 'request_cancelled',
      title: 'Permintaan Inspeksi Dibatalkan',
      body: `Permintaan "${request.judul}" telah dibatalkan oleh pemohon.`,
      data: {
        deepLink: 'inspection/permintaan',
        requestId: String(request.id),
      },
      recipientIds: [INSPECTION_PLANNER_NIK],
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
