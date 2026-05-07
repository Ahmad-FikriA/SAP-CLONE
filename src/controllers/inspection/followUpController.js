"use strict";

const InspectionFollowUp = require("../../models/InspectionFollowUp");
const SuratPelanggaran = require("../../models/SuratPelanggaran");

/**
 * FollowUp Controller — Teknisi tindak lanjut kerusakan.
 */

// GET /api/inspection/follow-ups
async function listFollowUps(req, res) {
  try {
    const where = {};

    if (req.query.status) where.status = req.query.status;
    if (req.query.assignedTechnician)
      where.assignedTechnician = req.query.assignedTechnician;

    const followUps = await InspectionFollowUp.findAll({
      where,
      include: [
        {
          association: "report",
          attributes: [
            "id",
            "inspectorName",
            "findings",
            "hasKerusakan",
            "kerusakanDetail",
            "inspectionDate",
          ],
          include: [
            {
              association: "schedule",
              attributes: [
                "id",
                "type",
                "title",
                "unitKerja",
                "location",
                "nomorPoJo",
              ],
            },
          ],
        },
      ],
      order: [["createdAt", "DESC"]],
    });

    res.json({
      success: true,
      message: "Follow-ups retrieved.",
      data: followUps,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}

// GET /api/inspection/follow-ups/:id
async function getFollowUp(req, res) {
  try {
    const followUp = await InspectionFollowUp.findByPk(req.params.id, {
      include: [
        {
          association: "report",
          include: [{ association: "schedule" }, { association: "photos" }],
        },
        {
          association: "suratPelanggaran",
        },
      ],
    });

    if (!followUp) {
      return res
        .status(404)
        .json({ success: false, message: "Follow-up not found." });
    }

    res.json({
      success: true,
      message: "Follow-up retrieved.",
      data: followUp,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}

// POST /api/inspection/follow-ups
async function createFollowUp(req, res) {
  try {
    const {
      reportId,
      assignedTechnician,
      kategoriTeknisi,
      kategoriK3,
      description,
      deadline,
    } = req.body;

    const followUp = await InspectionFollowUp.create({
      reportId,
      assignedTechnician,
      kategoriTeknisi,
      kategoriK3: kategoriK3 || null,
      description,
      deadline,
      status: "pending",
      assignedBy: req.user.nik,
    });

    res.status(201).json({
      success: true,
      message: "Follow-up created and assigned to technician.",
      data: followUp,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}

// PUT /api/inspection/follow-ups/:id
async function updateFollowUp(req, res) {
  try {
    const followUp = await InspectionFollowUp.findByPk(req.params.id);

    if (!followUp) {
      return res
        .status(404)
        .json({ success: false, message: "Follow-up not found." });
    }

    const updates = {};
    if (req.body.status) updates.status = req.body.status;
    if (req.body.feedback) updates.feedback = req.body.feedback;
    if (req.body.beforePhotos) updates.beforePhotos = req.body.beforePhotos;
    if (req.body.afterPhotos) updates.afterPhotos = req.body.afterPhotos;
    if (
      req.body.status === "waiting_approval" ||
      req.body.status === "completed"
    ) {
      updates.completedDate = new Date();
    }

    await followUp.update(updates);

    res.json({
      success: true,
      message: "Follow-up updated.",
      data: followUp,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}

// PUT /api/inspection/follow-ups/:id/approve
async function approveFollowUp(req, res) {
  try {
    const followUp = await InspectionFollowUp.findByPk(req.params.id);

    if (!followUp) {
      return res
        .status(404)
        .json({ success: false, message: "Follow-up not found." });
    }

    await followUp.update({
      status: "approved",
      approvalNotes: req.body.notes || null,
    });

    res.json({
      success: true,
      message: "Follow-up approved.",
      data: followUp,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}

// PUT /api/inspection/follow-ups/:id/reject
async function rejectFollowUp(req, res) {
  try {
    const followUp = await InspectionFollowUp.findByPk(req.params.id);

    if (!followUp) {
      return res
        .status(404)
        .json({ success: false, message: "Follow-up not found." });
    }

    await followUp.update({
      status: "rejected",
      approvalNotes: req.body.notes || null,
    });

    res.json({
      success: true,
      message: "Follow-up rejected.",
      data: followUp,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}

module.exports = {
  listFollowUps,
  getFollowUp,
  createFollowUp,
  updateFollowUp,
  approveFollowUp,
  rejectFollowUp,
};
