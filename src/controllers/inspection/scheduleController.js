"use strict";

const InspectionSchedule = require("../../models/InspectionSchedule");

/**
 * Schedule Controller — CRUD for inspection schedules.
 */

// GET /api/inspection/schedules
async function listSchedules(req, res) {
  try {
    const where = {};

    if (req.query.type) where.type = req.query.type;
    if (req.query.status) where.status = req.query.status;
    if (req.query.createdBy) where.createdBy = req.query.createdBy;
    if (req.query.assignedTo) where.assignedTo = req.query.assignedTo;

    const schedules = await InspectionSchedule.findAll({
      where,
      order: [["scheduledDate", "DESC"]],
    });

    res.json({
      success: true,
      message: "Schedules retrieved successfully.",
      data: schedules,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}

// GET /api/inspection/schedules/:id
async function getSchedule(req, res) {
  try {
    const schedule = await InspectionSchedule.findByPk(req.params.id, {
      include: [{ association: "reports" }],
    });

    if (!schedule) {
      return res
        .status(404)
        .json({ success: false, message: "Schedule not found." });
    }

    res.json({ success: true, message: "Schedule retrieved.", data: schedule });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}

// POST /api/inspection/schedules
async function createSchedule(req, res) {
  try {
    const {
      type,
      title,
      unitKerja,
      location,
      scheduledDate,
      scheduledEndDate,
      assignedTo,
      kategoriTeknisi,
      triggerSource,
      vendorInfo,
      nomorPoJo,
      darurat,
      notes,
    } = req.body;

    const schedule = await InspectionSchedule.create({
      type: type || "rutin",
      title,
      unitKerja,
      location,
      scheduledDate,
      scheduledEndDate,
      createdBy: req.user.username,
      assignedTo,
      kategoriTeknisi,
      triggerSource: triggerSource || "self",
      vendorInfo,
      nomorPoJo,
      darurat: darurat || false,
      notes,
    });

    res.status(201).json({
      success: true,
      message: "Schedule created successfully.",
      data: schedule,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}

// PUT /api/inspection/schedules/:id
async function updateSchedule(req, res) {
  try {
    const schedule = await InspectionSchedule.findByPk(req.params.id);
    if (!schedule) {
      return res
        .status(404)
        .json({ success: false, message: "Schedule not found." });
    }

    await schedule.update(req.body);

    res.json({ success: true, message: "Schedule updated.", data: schedule });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}

module.exports = { listSchedules, getSchedule, createSchedule, updateSchedule };
