"use strict";

const {
  InspectionReport,
  InspectionReportPhoto,
} = require("../../models/InspectionReport");
const InspectionSchedule = require("../../models/InspectionSchedule");
const InspectionFollowUp = require("../../models/InspectionFollowUp");
const sequelize = require("../../config/database");

const FOLLOW_UP_TARGET_DINAS_HSE = "dinas_hse";
const FOLLOW_UP_TARGET_DINAS_PERAWATAN = "dinas_perawatan";

/**
 * Report Controller — Submit, list, approve/reject inspection reports.
 */

// GET /api/inspection/reports
async function listReports(req, res) {
  try {
    const where = {};

    if (req.query.status) where.status = req.query.status;
    if (req.query.submittedBy) where.submittedBy = req.query.submittedBy;
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
    } = req.body;

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

    const report = await InspectionReport.create(
      {
        scheduleId,
        inspectorName,
        inspectionDate,
        location,
        tools: tools || [],
        findings,
        hasKerusakan: hasKerusakan || false,
        kerusakanDetail,
        kriteria,
        kategoriK3: kategoriK3 || null,
        signaturePath: signaturePath || null,
        status: "submitted",
        submittedBy: req.user.username,
        submittedAt: new Date(),
      },
      { transaction: t },
    );

    // Save photos if provided
    if (photos && photos.length > 0) {
      const photoRecords = photos.map((p) => ({
        reportId: report.id,
        photoPath: p.photoPath || p,
        caption: p.caption || null,
      }));
      await InspectionReportPhoto.bulkCreate(photoRecords, { transaction: t });
    }

    // Update schedule status
    await schedule.update({ status: "completed" }, { transaction: t });

    await t.commit();

    const created = await InspectionReport.findByPk(report.id, {
      include: [{ association: "photos" }, { association: "schedule" }],
    });

    res.status(201).json({
      success: true,
      message: "Report submitted successfully.",
      data: created,
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
        approvedBy: req.user.username,
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
          assignedBy: req.user.username,
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
  try {
    const report = await InspectionReport.findByPk(req.params.id);

    if (!report) {
      return res
        .status(404)
        .json({ success: false, message: "Report not found." });
    }

    await report.update({
      status: "rejected",
      approvedBy: req.user.username,
      approvalDate: new Date(),
      approvalNotes: req.body.notes || null,
    });

    res.json({ success: true, message: "Report rejected.", data: report });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}

module.exports = {
  listReports,
  getReport,
  createReport,
  approveReport,
  rejectReport,
};
