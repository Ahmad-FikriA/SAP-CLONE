"use strict";

const { Op } = require("sequelize");
const User = require("../../models/User");
const NotificationService = require("../../services/notificationService");
const {
  normalizeName,
  normalizeNullableString,
} = require("./supervisiHelpers");

const SUPERVISI_MONITOR_NIK = "10000191";

async function findExecutorRecipientIds(picSupervisi) {
  const targetName = normalizeNullableString(picSupervisi);
  if (!targetName) return [];

  const exactUsers = await User.findAll({
    where: {
      name: targetName,
      [Op.or]: [
        { group: { [Op.like]: "%supervisi%" } },
        { group: { [Op.like]: "%inspeksi%" } },
      ],
    },
    attributes: ["id"],
  });

  if (exactUsers.length > 0) {
    return [...new Set(exactUsers.map((user) => user.id))];
  }

  const fallbackUsers = await User.findAll({
    where: {
      [Op.or]: [
        { group: { [Op.like]: "%supervisi%" } },
        { group: { [Op.like]: "%inspeksi%" } },
      ],
    },
    attributes: ["id", "name"],
  });

  return [
    ...new Set(
      fallbackUsers
        .filter((user) => normalizeName(user.name) === normalizeName(targetName))
        .map((user) => user.id),
    ),
  ];
}

async function findSupervisorRecipientIds(job) {
  const targetNiks = [
    normalizeNullableString(job && job.createdBy),
    SUPERVISI_MONITOR_NIK,
  ].filter(Boolean);

  if (targetNiks.length === 0) return [];

  const users = await User.findAll({
    where: { nik: { [Op.in]: targetNiks } },
    attributes: ["id"],
  });

  return [...new Set(users.map((user) => user.id))];
}

async function notifyExecutorAssignment(job, { updated = false } = {}) {
  try {
    const recipientIds = await findExecutorRecipientIds(job.picSupervisi);
    if (recipientIds.length === 0) return;

    const title = updated ? "Jadwal Supervisi Diperbarui" : "Jadwal Supervisi Baru";
    const body = updated
      ? `Jadwal ${job.nomorJo || "-"} telah diperbarui dan ditugaskan ke Anda.`
      : `Anda mendapat jadwal supervisi ${job.nomorJo || "-"} (${job.namaKerja || "-"}).`;

    await NotificationService.notify({
      module: "supervisi",
      type: updated ? "job_updated" : "job_assigned",
      title,
      body,
      data: {
        jobId: String(job.id || ""),
        nomorJo: String(job.nomorJo || ""),
        deepLink: "supervisi/dashboard",
      },
      recipientIds,
    });
  } catch (err) {
    console.error("[Supervisi] Failed to notify executor assignment:", err.message);
  }
}

async function notifySupervisorVisitUpdate({
  job,
  visitStatus,
  visitDate,
  executorName,
  isUndo = false,
}) {
  try {
    const recipientIds = await findSupervisorRecipientIds(job);
    if (recipientIds.length === 0) return;

    const isHadir = visitStatus === "hadir";
    let type;
    let title;
    let body;

    if (isUndo) {
      type = "visit_undone";
      title = "Laporan Ditarik (Draft)";
      body = `${executorName} membatalkan submit laporan untuk ${job.nomorJo || "-"} dan mengembalikannya ke draft.`;
    } else {
      type = isHadir ? "visit_submitted" : "visit_absent";
      title = isHadir ? "Laporan Kunjungan Masuk" : "Ketidakhadiran Supervisi";
      body = isHadir
        ? `${executorName} mengirim laporan kunjungan untuk ${job.nomorJo || "-"}.`
        : `${executorName} melaporkan tidak hadir untuk ${job.nomorJo || "-"}.`;
    }

    await NotificationService.notify({
      module: "supervisi",
      type,
      title,
      body,
      data: {
        jobId: String(job.id || ""),
        nomorJo: String(job.nomorJo || ""),
        visitDate: String(visitDate || ""),
        status: String(visitStatus || ""),
        deepLink: "supervisi/dashboard",
      },
      recipientIds,
    });
  } catch (err) {
    console.error("[Supervisi] Failed to notify visit update:", err.message);
  }
}

module.exports = {
  notifyExecutorAssignment,
  notifySupervisorVisitUpdate,
};
