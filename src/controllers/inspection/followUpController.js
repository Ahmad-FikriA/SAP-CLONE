"use strict";

const InspectionFollowUp = require("../../models/InspectionFollowUp");

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
      description,
      deadline,
    } = req.body;

    const followUp = await InspectionFollowUp.create({
      reportId,
      assignedTechnician,
      kategoriTeknisi,
      description,
      deadline,
      status: "pending",
      assignedBy: req.user.username,
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
    if (req.body.status === "completed") updates.completedDate = new Date();

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

module.exports = { listFollowUps, getFollowUp, createFollowUp, updateFollowUp };
