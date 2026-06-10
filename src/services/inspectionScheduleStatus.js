"use strict";

const { Op } = require("sequelize");
const { InspectionReport } = require("../models/InspectionReport");

function toDateOnlyString(value) {
  if (!value) return null;
  if (typeof value === "string") return value.slice(0, 10);
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return String(value).slice(0, 10);
}

function getScheduleDateRange(schedule) {
  const startStr = toDateOnlyString(schedule?.scheduledDate);
  if (!startStr) return [];

  const endStr = toDateOnlyString(schedule?.scheduledEndDate) || startStr;
  const start = new Date(`${startStr}T00:00:00.000Z`);
  const end = new Date(`${endStr}T00:00:00.000Z`);

  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return [startStr];
  }

  if (end < start) return [startStr];

  const days = [];
  const cursor = new Date(start);
  while (cursor <= end) {
    days.push(cursor.toISOString().slice(0, 10));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }

  return days;
}

async function resolveScheduleStatusFromReports(schedule, transaction) {
  const requiredDays = getScheduleDateRange(schedule);
  if (requiredDays.length === 0) return schedule?.status || "scheduled";

  const reports = await InspectionReport.findAll({
    where: {
      scheduleId: schedule.id,
      status: { [Op.in]: ["submitted", "approved"] },
      inspectionDate: {
        [Op.between]: [
          requiredDays[0],
          requiredDays[requiredDays.length - 1],
        ],
      },
    },
    attributes: ["inspectionDate"],
    raw: true,
    transaction,
  });

  const reportedDays = new Set(
    reports
      .map((report) => toDateOnlyString(report.inspectionDate))
      .filter(Boolean),
  );

  if (requiredDays.every((day) => reportedDays.has(day))) {
    return "completed";
  }

  if (reportedDays.size > 0 || schedule.status === "completed") {
    return "in_progress";
  }

  return schedule.status || "scheduled";
}

async function updateScheduleStatusFromReports(schedule, transaction) {
  if (!schedule || schedule.status === "cancelled") return schedule;

  const nextStatus = await resolveScheduleStatusFromReports(
    schedule,
    transaction,
  );

  if (schedule.status !== nextStatus) {
    await schedule.update({ status: nextStatus }, { transaction });
  }

  return schedule;
}

module.exports = {
  getScheduleDateRange,
  resolveScheduleStatusFromReports,
  updateScheduleStatusFromReports,
};
