"use strict";

const { Op } = require("sequelize");
const InspectionSchedule = require("../../models/InspectionSchedule");
const InspectionRequest = require("../../models/InspectionRequest");
const {
  updateScheduleStatusFromReports,
} = require("../../services/inspectionScheduleStatus");
const { notify } = require("../../services/notificationService");


const INSPECTION_PLANNER_NIK = "10000262";
const FINAL_SCHEDULE_STATUSES = ["completed", "cancelled"];

function isTruthyQuery(value) {
  return ["1", "true", "yes", "y"].includes(String(value || "").toLowerCase());
}

function parsePositiveInt(value, fallback, max = 100) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed < 1) return fallback;
  return Math.min(parsed, max);
}

function parseQueryList(value) {
  return String(value || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function buildDateRangeWhere(dateFrom, dateTo) {
  const range = {};
  if (dateFrom) range[Op.gte] = dateFrom;
  if (dateTo) range[Op.lte] = dateTo;
  return Object.keys(range).length > 0 ? range : null;
}

function buildPagination(query) {
  if (!query.page && !query.limit) return null;
  const page = parsePositiveInt(query.page, 1, 100000);
  const limit = parsePositiveInt(query.limit, 20, 100);
  return {
    page,
    limit,
    offset: (page - 1) * limit,
  };
}




async function listSchedules(req, res) {
  try {
    const where = {};
    const archiveMode =
      req.query.mode === "archive" || isTruthyQuery(req.query.archive);

    if (req.query.type) where.type = req.query.type;
    if (req.query.status) {
      const statuses = parseQueryList(req.query.status);
      if (statuses.length > 0) {
        where.status = statuses.length > 1 ? { [Op.in]: statuses } : statuses[0];
      }
    } else if (archiveMode) {
      where.status = { [Op.in]: FINAL_SCHEDULE_STATUSES };
    }
    if (req.query.createdBy) where.createdBy = req.query.createdBy;
    if (req.query.assignedTo) where.assignedTo = req.query.assignedTo;

    const dateRange = buildDateRangeWhere(req.query.dateFrom, req.query.dateTo);
    if (dateRange) where.scheduledDate = dateRange;

    const q = String(req.query.q || "").trim();
    if (q) {
      const like = `%${q}%`;
      where[Op.or] = [
        { title: { [Op.like]: like } },
        { location: { [Op.like]: like } },
        { nomorPoJo: { [Op.like]: like } },
        { createdBy: { [Op.like]: like } },
        { assignedTo: { [Op.like]: like } },
      ];
    }

    const include = [
      {
        model: InspectionRequest,
        as: "userRequest",
        attributes: ["id", "deskripsi", "mediaPaths", "requestedBy", "judul"],
        required: false,
      },
    ];
    const pagination = buildPagination(req.query);
    const queryOptions = {
      where,
      order: [["scheduledDate", "DESC"]],
      include,
    };

    const result = pagination
      ? await InspectionSchedule.findAndCountAll({
          ...queryOptions,
          limit: pagination.limit,
          offset: pagination.offset,
          distinct: true,
        })
      : { rows: await InspectionSchedule.findAll(queryOptions), count: null };

    const schedules = result.rows;

    await Promise.all(
      schedules.map((schedule) => updateScheduleStatusFromReports(schedule)),
    );

    const response = {
      success: true,
      message: "Schedules retrieved successfully.",
      data: schedules,
    };

    if (pagination) {
      response.meta = {
        page: pagination.page,
        limit: pagination.limit,
        total: result.count,
        totalPages: Math.max(1, Math.ceil(result.count / pagination.limit)),
      };
    }

    res.json(response);
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}


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

    await updateScheduleStatusFromReports(schedule);

    res.json({ success: true, message: "Schedule retrieved.", data: schedule });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}


async function createSchedule(req, res) {
  try {
    const {
      type,
      title,
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
      intervalPeriod,
    } = req.body;

    const start = new Date(scheduledDate);
    start.setHours(0, 0, 0, 0);

    let end = new Date(scheduledEndDate || scheduledDate);
    end.setHours(0, 0, 0, 0);

    const schedule = await InspectionSchedule.create({
      type: type || "rutin",
      title,
      location,
      scheduledDate,
      scheduledEndDate,
      createdBy: req.user.nik,
      assignedTo,
      kategoriTeknisi,
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


    const recipientNik = String(assignedTo || INSPECTION_PLANNER_NIK);
    notify({
      module: 'inspection',
      type: 'schedule_created',
      title: 'Jadwal Inspeksi Baru',
      body: `Jadwal inspeksi "${title || schedule.title}" telah dibuat untuk Anda.`,
      data: {
        deepLink: 'inspection/draft',
        scheduleId: String(schedule.id),
      },
      recipientIds: [recipientNik],
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}


async function updateSchedule(req, res) {
  try {
    const schedule = await InspectionSchedule.findByPk(req.params.id);
    if (!schedule) {
      return res
        .status(404)
        .json({ success: false, message: "Schedule not found." });
    }

    await schedule.update(req.body);

    const recipientNik = String(schedule.assignedTo || INSPECTION_PLANNER_NIK);
    notify({
      module: 'inspection',
      type: 'schedule_updated',
      title: 'Update Jadwal Inspeksi',
      body: `Jadwal inspeksi "${schedule.title}" telah diperbarui. Status: ${schedule.status}.`,
      data: {
        deepLink: 'inspection/draft',
        scheduleId: String(schedule.id),
      },
      recipientIds: [recipientNik],
    });

    res.json({ success: true, message: "Schedule updated.", data: schedule });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}


async function getNextSpkNumber(req, res) {
  try {
    const now = new Date();
    const yearSuffix = String(now.getFullYear()).slice(-2);
    const prefix = `SPK-INSP${yearSuffix}-`;

    // Cari nomor SPK tertinggi dengan prefix tahun ini
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


async function createRecurringSchedules(req, res) {
  try {
    const { baseSchedule, recurringType, startDate, endDate } = req.body;
    
    if (!baseSchedule || !recurringType || !startDate || !endDate) {
      return res.status(400).json({ success: false, message: "Missing required parameters." });
    }

    const start = new Date(startDate);
    const end = new Date(endDate);
    const groupId = `REC-${Date.now()}`;
    const schedulesToCreate = [];
    
    let currentDate = new Date(start);
    let instanceNumber = 1;
    
    let intervalMonths = 1;
    switch (recurringType) {
      case 'monthly': intervalMonths = 1; break;
      case 'bimonthly': intervalMonths = 2; break;
      case 'quarterly': intervalMonths = 3; break;
      case 'semester': intervalMonths = 6; break;
      case 'yearly': intervalMonths = 12; break;
      default: intervalMonths = 1;
    }

    while (currentDate <= end) {
      const scheduledDate = new Date(currentDate);
      
      const schedule = {
        type: baseSchedule.type || "rutin",
        title: `${baseSchedule.title} #${instanceNumber}`,
        unitKerja: baseSchedule.unitKerja,
        location: baseSchedule.location,
        scheduledDate: scheduledDate,
        createdBy: req.user.nik || baseSchedule.createdBy,
        assignedTo: baseSchedule.assignedTo,
        kategoriTeknisi: baseSchedule.kategoriTeknisi,
        vendorInfo: baseSchedule.vendorInfo,
        nomorPoJo: baseSchedule.nomorPoJo,
        triggerSource: baseSchedule.triggerSource || "planner",
        isRecurring: true,
        recurringGroupId: groupId,
        recurringType: recurringType,
        recurringEndDate: end,
        recurringInstance: instanceNumber
      };
      
      schedulesToCreate.push(schedule);


      currentDate.setMonth(currentDate.getMonth() + intervalMonths);
      instanceNumber++;
    }

    const createdSchedules = await InspectionSchedule.bulkCreate(schedulesToCreate);


    const executorNik = String(baseSchedule.assignedTo || INSPECTION_PLANNER_NIK);
    notify({
      module: 'inspection',
      type: 'schedule_recurring_created',
      title: 'Jadwal Inspeksi Berulang Baru',
      body: `${createdSchedules.length} jadwal inspeksi berulang "${baseSchedule.title}" telah dibuat untuk Anda.`,
      data: {
        deepLink: 'inspection/draft',
      },
      recipientIds: [executorNik],
    });

    res.status(201).json({
      success: true,
      message: `${createdSchedules.length} recurring schedules created successfully.`,
      data: createdSchedules,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}

// DELETE /api/inspection/schedules/:id
async function deleteSchedule(req, res) {
  try {
    const schedule = await InspectionSchedule.findByPk(req.params.id);
    if (!schedule) {
      return res
        .status(404)
        .json({ success: false, message: "Schedule not found." });
    }

    await schedule.destroy();
    res.json({ success: true, message: "Schedule deleted successfully." });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}

// CRON JOB — Send reminders for today and overdue schedules
async function sendInspectionReminders() {
  const LABEL = "[Inspection Cron]";
  try {
    const { Op } = require("sequelize");
    const todayStr = new Date().toISOString().slice(0, 10);

    const activeSchedules = await InspectionSchedule.findAll({
      where: {
        status: { [Op.in]: ["scheduled", "in_progress"] },
        assignedTo: { [Op.not]: null },
        scheduledDate: { [Op.not]: null },
      },
      attributes: ["id", "title", "scheduledDate", "assignedTo", "status"],
    });

    if (!activeSchedules.length) {
      console.log(`${LABEL} No active schedules need reminders.`);
      return;
    }

    let todayCount = 0;
    let overdueCount = 0;

    for (const schedule of activeSchedules) {
      const scheduleDateStr = schedule.scheduledDate;

      if (scheduleDateStr === todayStr) {

        notify({
          module: 'inspection',
          type: 'schedule_reminder_today',
          title: 'Pengingat Inspeksi Hari Ini',
          body: `Anda memiliki jadwal inspeksi hari ini: "${schedule.title}".`,
          data: {
            deepLink: 'inspection/draft',
            scheduleId: String(schedule.id),
          },
          recipientIds: [String(schedule.assignedTo)],
        });
        todayCount++;
      } else if (scheduleDateStr < todayStr) {

        notify({
          module: 'inspection',
          type: 'schedule_reminder_overdue',
          title: 'Inspeksi Terlewat (Overdue)',
          body: `Jadwal inspeksi "${schedule.title}" telah terlewat dari tanggal ${scheduleDateStr}. Mohon segera ditindaklanjuti.`,
          data: {
            deepLink: 'inspection/draft',
            scheduleId: String(schedule.id),
          },
          recipientIds: [String(schedule.assignedTo)],
        });
        overdueCount++;
      }
    }

    console.log(`${LABEL} Sent reminders: ${todayCount} today, ${overdueCount} overdue.`);
  } catch (error) {
    console.error(`${LABEL} Failed to run reminder cron:`, error.message);
  }
}

module.exports = { listSchedules, getSchedule, createSchedule, updateSchedule, deleteSchedule, getNextSpkNumber, createRecurringSchedules, sendInspectionReminders };
