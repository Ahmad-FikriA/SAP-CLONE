"use strict";

const InspectionRequest = require("../../models/InspectionRequest");
const InspectionSchedule = require("../../models/InspectionSchedule");
const { buildAccessProfile } = require("../../services/accessProfile");
const { notify } = require("../../services/notificationService");


const INSPECTION_PLANNER_NIK = "10000262";



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
  const flags = profile?.flags || {};

  return Boolean(
    flags.isInspectionPlanner ||
      flags.isInspectionApprover ||
      flags.isInspectionMonitor,
  );
}

function canReviewRequests(user) {
  return canViewAllRequests(user);
}
async function listRequests(req, res) {
  try {
    const where = {};
    const requesterNik = normalizeNik(req.user?.nik);
    const hasGlobalAccess = canViewAllRequests(req.user);
    const requestedByQuery = normalizeNik(req.query.requestedBy);

    console.log(`[listRequests] nik=${requesterNik} hasGlobalAccess=${hasGlobalAccess} requestedByQuery="${requestedByQuery}" status="${req.query.status || ''}"`);
    if (req.query.status) where.status = req.query.status;


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


    const validRutinKategories = ["sipil", "mekanik", "elektrik", "otomasi"];
    
    if (jenisInspeksi === "rutin" && !validRutinKategories.includes(kategoriInspeksi)) {
      return res.status(400).json({
        success: false,
        message: "Kategori tidak valid untuk jenis inspeksi rutin.",
      });
    }

    const requesterNik = normalizeNik(req.user?.nik);
    const requestedByBody = normalizeNik(requestedBy);


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

    const finalDate =
      scheduledDate ||
      request.tanggalDiinginkan ||
      new Date().toISOString().split("T")[0];
    // Tentukan assignedTo
    const finalAssignedTo = assignedTo || "dinas_inspeksi";
    const schedule = await InspectionSchedule.create({
      type: "rutin",
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

    await request.update({
      status: "approved",
      approvedBy: req.user?.nik,
      approvedAt: new Date(),
      notes: plannerNotes,
      scheduleId: schedule.id,
    });


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
