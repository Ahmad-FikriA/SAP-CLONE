"use strict";

const {
  InspectionReport,
  InspectionReportPhoto,
} = require("../../models/InspectionReport");
const InspectionSchedule = require("../../models/InspectionSchedule");
const InspectionFollowUp = require("../../models/InspectionFollowUp");
const sequelize = require("../../config/database");
const { buildAccessProfile } = require("../../services/accessProfile");
const {
  resolveSupportedStatus,
  invalidateStatusEnumCache,
} = require("../../services/inspectionStatusSupport");
const { notify } = require("../../services/notificationService");

// NIK Approver yang menerima notifikasi laporan baru
const INSPECTION_APPROVER_NIK = "10000262";

const FOLLOW_UP_TARGET_DINAS_HSE = "dinas_hse";
const FOLLOW_UP_TARGET_DINAS_PERAWATAN = "dinas_perawatan";

function normalizeNik(value) {
  return String(value || "").trim();
}

function isStatusColumnTruncationError(error) {
  return String(error?.message || "")
    .toLowerCase()
    .includes("data truncated for column 'status'");
}

async function applyRejectedReportStatus(report, user, notes, transaction) {
  const nextRejectedStatus = await resolveSupportedStatus(
    "inspection_reports",
    "revisions_required",
    "rejected",
  );

  try {
    await report.update(
      {
        status: nextRejectedStatus,
        approvedBy: user?.nik,
        approvalDate: new Date(),
        approvalNotes: notes || null,
      },
      { transaction },
    );
    return nextRejectedStatus;
  } catch (error) {
    if (!isStatusColumnTruncationError(error)) {
      throw error;
    }

    invalidateStatusEnumCache("inspection_reports");
    await report.update(
      {
        status: "rejected",
        approvedBy: user?.nik,
        approvalDate: new Date(),
        approvalNotes: notes || null,
      },
      { transaction },
    );
    return "rejected";
  }
}

function buildReportRejectionNotification(finalStatus, notes) {
  const trimmedNotes =
    typeof notes === "string" && notes.trim().length > 0 ? notes.trim() : null;
  const noteSuffix = trimmedNotes ? ` Catatan: ${trimmedNotes}` : "";

  if (finalStatus === "rejected") {
    return {
      type: "report_rejected",
      title: "Laporan Inspeksi Ditolak",
      body: `Laporan inspeksi Anda ditolak.${noteSuffix}`,
      responseMessage: "Report ditolak.",
    };
  }

  return {
    type: "report_revisions_required",
    title: "Laporan Inspeksi Perlu Direvisi",
    body: `Laporan inspeksi Anda dikembalikan untuk direvisi.${noteSuffix}`,
    responseMessage: "Report dikembalikan ke eksekutor untuk revisi.",
  };
}

function canViewAllReports(user) {
  const profile = buildAccessProfile(user || {});
  const appRole = profile?.appRole;
  const flags = profile?.flags || {};

  return (
    appRole === "kasie" ||
    appRole === "kadis" ||
    appRole === "kadiv" ||
    Boolean(
      flags.isInspectionPlanner ||
        flags.isInspectionApprover ||
        flags.isInspectionMonitor,
    )
  );
}

function normalizeReportStatus(status, fallback = "draft") {
  if (status === "submitted") return "submitted";
  if (status === "draft") return "draft";
  if (status === "revisions_required") return "revisions_required";
  return fallback;
}

function canMutateReport(report, userNik) {
  const requesterNik = normalizeNik(userNik);
  if (!requesterNik) return false;

  const reportSubmittedBy = normalizeNik(report?.submittedBy);
  if (reportSubmittedBy) {
    return reportSubmittedBy === requesterNik;
  }

  const scheduleCreatedBy = normalizeNik(report?.schedule?.createdBy);
  const scheduleAssignedTo = normalizeNik(report?.schedule?.assignedTo);
  return (
    scheduleCreatedBy === requesterNik || scheduleAssignedTo === requesterNik
  );
}

function parsePhotoRecords(photos, reportId) {
  if (!Array.isArray(photos)) return [];

  return photos
    .map((photo) => {
      if (typeof photo === "string") {
        const cleanPath = photo.trim();
        if (!cleanPath) return null;
        return {
          reportId,
          photoPath: cleanPath,
          caption: null,
        };
      }

      if (!photo || typeof photo !== "object") return null;

      const cleanPath = String(photo.photoPath || "").trim();
      if (!cleanPath) return null;

      return {
        reportId,
        photoPath: cleanPath,
        caption: photo.caption || null,
      };
    })
    .filter(Boolean);
}

/**
 * Report Controller — Submit, list, approve/reject inspection reports.
 */

// GET /api/inspection/reports
async function listReports(req, res) {
  try {
    const where = {};
    const requesterNik = normalizeNik(req.user?.nik);
    const hasGlobalAccess = canViewAllReports(req.user);
    const requestedSubmittedBy = normalizeNik(req.query.submittedBy);

    if (req.query.status) where.status = req.query.status;

    if (requestedSubmittedBy) {
      if (!hasGlobalAccess && requestedSubmittedBy !== requesterNik) {
        return res.status(403).json({
          success: false,
          message: "Anda hanya dapat melihat laporan milik akun sendiri.",
        });
      }
      where.submittedBy = requestedSubmittedBy;
    } else if (!hasGlobalAccess) {
      if (!requesterNik) {
        return res.status(403).json({
          success: false,
          message: "Akun tidak memiliki identitas NIK yang valid.",
        });
      }
      where.submittedBy = requesterNik;
    }

    if (req.query.hasKerusakan !== undefined) {
      where.hasKerusakan = req.query.hasKerusakan === "true";
    }

    const reports = await InspectionReport.findAll({
      where,
      include: [
        {
          association: "schedule",
          attributes: ["id", "type", "title", "unitKerja", "nomorPoJo"],
        },
        { association: "photos" },
      ],
      order: [["createdAt", "DESC"]],
    });

    res.json({ success: true, message: "Reports retrieved.", data: reports });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}

// GET /api/inspection/reports/:id
async function getReport(req, res) {
  try {
    const requesterNik = normalizeNik(req.user?.nik);
    const hasGlobalAccess = canViewAllReports(req.user);

    const report = await InspectionReport.findByPk(req.params.id, {
      include: [
        { association: "schedule" },
        { association: "photos" },
        { association: "followUps" },
      ],
    });

    if (!report) {
      return res
        .status(404)
        .json({ success: false, message: "Report not found." });
    }

    if (!hasGlobalAccess && normalizeNik(report.submittedBy) !== requesterNik) {
      return res.status(403).json({
        success: false,
        message: "Anda tidak memiliki akses ke laporan ini.",
      });
    }

    res.json({ success: true, message: "Report retrieved.", data: report });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}

// POST /api/inspection/reports
async function createReport(req, res) {
  const t = await sequelize.transaction();

  try {
    const {
      scheduleId,
      inspectorName,
      inspectionDate,
      location,
      tools,
      findings,
      hasKerusakan,
      kerusakanDetail,
      kriteria,
      kategoriK3,
      signaturePath,
      photos,
      status,
    } = req.body;

    const reportStatus = normalizeReportStatus(status, "submitted");
    const isSubmitted = reportStatus === "submitted";

    // Verify schedule exists
    const schedule = await InspectionSchedule.findByPk(scheduleId, {
      transaction: t,
    });
    if (!schedule) {
      await t.rollback();
      return res
        .status(404)
        .json({ success: false, message: "Schedule not found." });
    }

    // Draft should be savable at any time without field requirements.
    const normalizedInspectorName =
      typeof inspectorName === "string" && inspectorName.trim().length > 0
        ? inspectorName.trim()
        : String(req.user?.name || req.user?.nik || "Inspector").trim();
    const normalizedInspectionDate =
      typeof inspectionDate === "string" && inspectionDate.trim().length > 0
        ? inspectionDate.trim()
        : new Date().toISOString().slice(0, 10);
    const normalizedLocation =
      typeof location === "string" && location.trim().length > 0
        ? location.trim()
        : String(schedule.location || schedule.title || "-");

    const report = await InspectionReport.create(
      {
        scheduleId,
        inspectorName: normalizedInspectorName,
        inspectionDate: normalizedInspectionDate,
        location: normalizedLocation,
        tools: Array.isArray(tools) ? tools : [],
        findings:
          typeof findings === "string" && findings.trim().length > 0
            ? findings.trim()
            : null,
        hasKerusakan: hasKerusakan || false,
        kerusakanDetail,
        kriteria,
        kategoriK3: kategoriK3 || null,
        signaturePath: signaturePath || null,
        status: reportStatus,
        submittedBy: req.user.nik,
        submittedAt: isSubmitted ? new Date() : null,
      },
      { transaction: t },
    );

    // Save photos if provided
    const photoRecords = parsePhotoRecords(photos, report.id);
    if (photoRecords.length > 0) {
      await InspectionReportPhoto.bulkCreate(photoRecords, { transaction: t });
    }

    // Update schedule status according to report state.
    if (isSubmitted) {
      await schedule.update({ status: "completed" }, { transaction: t });
    } else if (["scheduled", "in_progress"].includes(schedule.status)) {
      await schedule.update({ status: "in_progress" }, { transaction: t });
    }

    await t.commit();

    const created = await InspectionReport.findByPk(report.id, {
      include: [{ association: "photos" }, { association: "schedule" }],
    });

    res.status(201).json({
      success: true,
      message: isSubmitted
        ? "Report submitted successfully."
        : "Draft report saved successfully.",
      data: created,
    });

    // Kirim notifikasi ke Approver saat laporan di-submit (bukan draft)
    if (isSubmitted) {
      notify({
        module: 'inspection',
        type: 'report_submitted',
        title: 'Laporan Inspeksi Baru',
        body: `Laporan inspeksi dari ${req.user?.nik || 'inspektor'} untuk jadwal #${scheduleId} menunggu persetujuan Anda.`,
        data: {
          deepLink: 'inspection/laporan-masuk',
          reportId: String(created.id),
        },
        recipientIds: [INSPECTION_APPROVER_NIK],
      });
    }
  } catch (err) {
    await t.rollback();
    res.status(500).json({ success: false, message: err.message });
  }
}

// PUT /api/inspection/reports/:id
async function updateReport(req, res) {
  const t = await sequelize.transaction();

  try {
    const report = await InspectionReport.findByPk(req.params.id, {
      include: [{ association: "schedule" }],
      transaction: t,
      lock: t.LOCK.UPDATE,
    });

    if (!report) {
      await t.rollback();
      return res
        .status(404)
        .json({ success: false, message: "Report not found." });
    }

    if (!canMutateReport(report, req.user?.nik)) {
      await t.rollback();
      return res.status(403).json({
        success: false,
        message: "Anda hanya dapat mengubah laporan milik sendiri.",
      });
    }

    // Block mutation only for truly-approved reports
    if (report.status === "approved") {
      await t.rollback();
      return res.status(400).json({
        success: false,
        message: "Laporan yang sudah disetujui tidak dapat diubah.",
      });
    }

    const updatePayload = {};
    const mutableFields = [
      "inspectorName",
      "inspectionDate",
      "location",
      "findings",
      "kerusakanDetail",
      "kriteria",
      "kategoriK3",
      "signaturePath",
    ];

    mutableFields.forEach((field) => {
      if (req.body[field] !== undefined) {
        updatePayload[field] = req.body[field];
      }
    });

    if (req.body.tools !== undefined) {
      updatePayload.tools = Array.isArray(req.body.tools) ? req.body.tools : [];
    }

    if (req.body.hasKerusakan !== undefined) {
      updatePayload.hasKerusakan = Boolean(req.body.hasKerusakan);
    }

    const nextStatus =
      req.body.status !== undefined
        ? normalizeReportStatus(req.body.status, report.status)
        : report.status;

    updatePayload.status = nextStatus;
    updatePayload.submittedBy = normalizeNik(req.user?.nik) || report.submittedBy;
    updatePayload.submittedAt =
      nextStatus === "submitted"
        ? report.submittedAt || new Date()
        : null;

    await report.update(updatePayload, { transaction: t });

    if (req.body.photos !== undefined) {
      await InspectionReportPhoto.destroy({
        where: { reportId: report.id },
        transaction: t,
      });

      const photoRecords = parsePhotoRecords(req.body.photos, report.id);
      if (photoRecords.length > 0) {
        await InspectionReportPhoto.bulkCreate(photoRecords, {
          transaction: t,
        });
      }
    }

    if (report.schedule) {
      if (nextStatus === "submitted") {
        await report.schedule.update({ status: "completed" }, { transaction: t });
      } else if (["scheduled", "in_progress"].includes(report.schedule.status)) {
        await report.schedule.update({ status: "in_progress" }, { transaction: t });
      }
    }

    await t.commit();

    const updated = await InspectionReport.findByPk(report.id, {
      include: [{ association: "schedule" }, { association: "photos" }],
    });

    res.json({
      success: true,
      message:
        nextStatus === "submitted"
          ? "Report submitted successfully."
          : "Draft report saved successfully.",
      data: updated,
    });
  } catch (err) {
    await t.rollback();
    res.status(500).json({ success: false, message: err.message });
  }
}

// PUT /api/inspection/reports/:id/approve
async function approveReport(req, res) {
  const t = await sequelize.transaction();

  try {
    const report = await InspectionReport.findByPk(req.params.id, {
      include: [{ association: "schedule" }],
      transaction: t,
    });

    if (!report) {
      await t.rollback();
      return res
        .status(404)
        .json({ success: false, message: "Report not found." });
    }

    await report.update(
      {
        status: "approved",
        approvedBy: req.user.nik,
        approvalDate: new Date(),
        approvalNotes: req.body.notes || null,
      },
      { transaction: t },
    );

    // If kerusakan found → auto-create follow-up
    // Branching: manusia → assign ke Dinas HSE, selain itu → assign ke Dinas Perawatan
    if (report.hasKerusakan) {
      const kategori = report.kategoriK3 || req.body.kategoriK3;
      const isManusia = kategori === "manusia";
      const autoAssignedTarget = isManusia
        ? FOLLOW_UP_TARGET_DINAS_HSE
        : FOLLOW_UP_TARGET_DINAS_PERAWATAN;

      await InspectionFollowUp.create(
        {
          reportId: report.id,
          assignedTechnician: req.body.assignedTechnician || autoAssignedTarget,
          kategoriTeknisi:
            req.body.kategoriTeknisi || report.schedule?.kategoriTeknisi,
          kategoriK3: kategori || null,
          description:
            report.kerusakanDetail ||
            report.findings ||
            "Tindak lanjut kerusakan",
          deadline: req.body.deadline || null,
          status: "pending",
          assignedBy: req.user.nik,
        },
        { transaction: t },
      );
    }

    await t.commit();

    const updated = await InspectionReport.findByPk(report.id, {
      include: [
        { association: "schedule" },
        { association: "photos" },
        { association: "followUps" },
      ],
    });

    // Notifikasi ke inspektor bahwa laporannya disetujui
    if (report.submittedBy) {
      notify({
        module: 'inspection',
        type: 'report_approved',
        title: 'Laporan Inspeksi Disetujui',
        body: report.hasKerusakan
          ? 'Laporan inspeksi Anda disetujui. Tindak lanjut perbaikan telah ditugaskan.'
          : 'Laporan inspeksi Anda telah disetujui. Tidak ada kerusakan ditemukan.',
        data: {
          deepLink: 'inspection/riwayat',
          reportId: String(report.id),
        },
        recipientIds: [String(report.submittedBy)],
      });
    }

    res.json({
      success: true,
      message: report.hasKerusakan
        ? "Report approved. Follow-up assigned to technician."
        : "Report approved. No damage found — flow completed.",
      data: updated,
    });
  } catch (err) {
    await t.rollback();
    res.status(500).json({ success: false, message: err.message });
  }
}

// PUT /api/inspection/reports/:id/reject
async function rejectReport(req, res) {
  const t = await sequelize.transaction();

  try {
    const report = await InspectionReport.findByPk(req.params.id, {
      include: [{ association: "schedule" }],
      transaction: t,
    });

    if (!report) {
      await t.rollback();
      return res
        .status(404)
        .json({ success: false, message: "Report not found." });
    }

    const finalStatus = await applyRejectedReportStatus(
      report,
      req.user,
      req.body.notes,
      t,
    );
    const notification = buildReportRejectionNotification(
      finalStatus,
      req.body.notes,
    );

    // Revert schedule back to in_progress so it re-appears in the
    // executor's active schedule list.
    if (report.schedule) {
      await report.schedule.update({ status: "in_progress" }, { transaction: t });
    }

    await t.commit();

    const updated = await InspectionReport.findByPk(report.id, {
      include: [{ association: "schedule" }, { association: "photos" }],
    });

    // Notifikasi ke inspektor bahwa laporannya dikembalikan untuk revisi
    if (report.submittedBy) {
      notify({
        module: 'inspection',
        type: notification.type,
        title: notification.title,
        body: notification.body,
        data: {
          deepLink: 'inspection/draft',
          reportId: String(report.id),
        },
        recipientIds: [String(report.submittedBy)],
      });
    }

    res.json({
      success: true,
      message: notification.responseMessage,
      data: updated,
    });
  } catch (err) {
    await t.rollback();
    res.status(500).json({ success: false, message: err.message });
  }
}

module.exports = {
  listReports,
  getReport,
  createReport,
  updateReport,
  approveReport,
  rejectReport,
};
