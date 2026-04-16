"use strict";

const InspectionSchedule = require("../../models/InspectionSchedule");
const InspectionRequest = require("../../models/InspectionRequest");

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
      include: [
        {
          model: InspectionRequest,
          as: "userRequest",
          attributes: ["id", "deskripsi", "mediaPaths", "requestedBy", "judul"],
          required: false,
        },
      ],
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
      include: [
        { association: "reports" },
        {
          model: InspectionRequest,
          as: "userRequest",
          attributes: ["id", "deskripsi", "mediaPaths", "requestedBy", "judul"],
          required: false,
        },
      ],
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
      kategoriK3,
      triggerSource,
      vendorInfo,
      nomorPoJo,
      darurat,
      notes,
      intervalPeriod,
    } = req.body;

    const schedule = await InspectionSchedule.create({
      type: type || "rutin",
      title,
      unitKerja,
      location,
      scheduledDate,
      scheduledEndDate,
      createdBy: req.user.nik,
      assignedTo,
      kategoriTeknisi,
      kategoriK3: kategoriK3 || null,
      triggerSource: triggerSource || "self",
      vendorInfo,
      nomorPoJo,
      darurat: darurat || false,
      notes,
      intervalPeriod,
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

// GET /api/inspection/schedules/next-spk
async function getNextSpkNumber(req, res) {
  try {
    const now = new Date();
    const yearSuffix = String(now.getFullYear()).slice(-2); // '26' dari 2026
    const prefix = `SPK-INSP${yearSuffix}-`;

    // Cari nomor SPK tertinggi dengan prefix tahun ini
    const { Op } = require('sequelize');
    const lastSchedule = await InspectionSchedule.findOne({
      where: {
        nomorPoJo: {
          [Op.like]: `${prefix}%`,
        },
      },
      order: [['nomorPoJo', 'DESC']],
    });

    let nextCounter = 1;
    if (lastSchedule && lastSchedule.nomorPoJo) {
      const parts = lastSchedule.nomorPoJo.split('-');
      const lastNum = parseInt(parts[parts.length - 1], 10);
      if (!isNaN(lastNum)) {
        nextCounter = lastNum + 1;
      }
    }

    const nextSpk = `${prefix}${String(nextCounter).padStart(4, '0')}`;

    res.json({ success: true, data: { nextSpk } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}

module.exports = { listSchedules, getSchedule, createSchedule, updateSchedule, getNextSpkNumber };
