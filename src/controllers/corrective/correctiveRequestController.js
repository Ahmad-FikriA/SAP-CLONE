"use strict";

const { Op } = require("sequelize");
const { v4: uuid } = require("uuid");
const Notification = require("../../models/Notification");
const User = require("../../models/User");
// Legacy SpkCorrective models have been removed — no longer needed here.
const {
  KADIS_ROLE,
  KADIS_PUSAT_ROLE,
} = require("../../middleware/correctiveAccess");
const NotificationService = require("../../services/notificationService");

/**
 * Normalize a date string to YYYY-MM-DD format.
 * Accepts dd/MM/yyyy, yyyy-MM-dd, ISO 8601, or any JS-parseable date string.
 * Returns null if the input is falsy or unparseable.
 */
function toDateOnly(raw) {
  if (!raw) return null;
  const str = String(raw).trim();
  if (!str) return null;

  // Try dd/MM/yyyy first (the format the mobile app sends)
  const slashParts = str.match(/^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{4})$/);
  if (slashParts) {
    const [, day, month, year] = slashParts;
    const d = new Date(Number(year), Number(month) - 1, Number(day));
    if (!isNaN(d.getTime())) {
      return d.toISOString().slice(0, 10); // YYYY-MM-DD
    }
  }

  // Fallback: try native Date parsing (handles ISO, yyyy-MM-dd, etc.)
  const d = new Date(str);
  if (!isNaN(d.getTime())) {
    return d.toISOString().slice(0, 10);
  }

  return null; // unparseable → let the DB decide (will be NULL)
}

function fmtRequest(notif) {
  const n = notif.toJSON ? notif.toJSON() : notif;
  const spk = n.spkCorrective || {};

  // Format images
  const images = [];
  if (n.photo1) images.push(n.photo1);
  if (n.photo2) images.push(n.photo2);

  const beforeImages = (spk.photos || [])
    .filter((p) => p.photoType === "before")
    .map((p) => p.photoPath);
  const afterImages = (spk.photos || [])
    .filter((p) => p.photoType === "after")
    .map((p) => p.photoPath);

  const materials = (spk.items || [])
    .filter((i) => i.itemType === "material")
    .map((i) => i.itemName);
  const tools = (spk.items || [])
    .filter((i) => i.itemType === "tool")
    .map((i) => i.itemName);

  // Determine equipment and location
  // If SPK exists, prioritize the planner's selected functional location and equipment.
  // The planner's equipment name could be parsed from location if location format is "FuncLoc | EquipName"
  let finalFuncLoc = n.functionalLocation;
  let finalEq = n.equipmentName || n.equipment;

  if (spk.spkId && spk.location) {
    if (spk.location.includes(" | ")) {
      const parts = spk.location.split(" | ");
      finalFuncLoc = parts[0].trim();
      finalEq = parts[1].trim();
    } else {
      finalFuncLoc = spk.location;
    }
  }

  return {
    id: n.notificationId || n.id,
    notificationDate: n.notificationDate,
    notificationType: n.notificationType,
    description: n.description,
    functionalLocation: finalFuncLoc,
    equipment: finalEq,
    requiredStart: n.requiredStart,
    requiredEnd: n.requiredEnd,
    reportedBy: n.reportedBy,
    longText: n.longText,
    submittedBy: n.submittedBy,
    submittedAt: n.submittedAt,
    status: n.status,
    approvalStatus:
      n.status === "closed" ? "selesai" : n.approvalStatus || "pending",
    workCenter: spk.workCenter || n.workCenter,
    sapOrderNumber: n.sapOrderNumber,
    rejectionReason: n.rejectionReason,
    images,

    // SPK mapped fields
    spkId: spk.spkId,
    spkNumber: spk.spkNumber,
    priority: spk.priority,
    targetDate: spk.requestedFinishDate,
    classification: spk.damageClassification,
    personnelCount: spk.plannedWorker,
    estimatedDuration: spk.totalPlannedHour,
    instructions: spk.jobDescription,

    // Execution fields
    beforeImages,
    afterImages,
    materials,
    tools,
    actualPersonnelCount: spk.actualWorker,
    actualDuration: spk.totalActualHour,
    executionResultText: spk.jobResultDescription,
  };
}

// SPK_INCLUDE removed — legacy SpkCorrective tables no longer exist.

// GET /api/corrective/requests
const getAll = async (req, res) => {
  const { userId, role } = req.user;
  const where = {};

  if (req.query.status) where.status = req.query.status;

  // Kadis Pelapor can only see own notifications, TAPI Kadis PP bisa lihat semua
  if (role === KADIS_ROLE) {
    const { dinas } = req.user;
    const isKadisPusat =
      dinas && dinas.toLowerCase().includes("pusat perawatan");
    if (!isKadisPusat) {
      where.kadisPelaporId = userId;
    }
  }

  const data = await Notification.findAll({
    where,
    order: [["submittedAt", "DESC"]],
  });

  res.json(data.map(fmtRequest));
};

// GET /api/corrective/requests/:id
const getOne = async (req, res) => {
  const notification = await Notification.findByPk(req.params.id);

  if (!notification)
    return res.status(404).json({ error: "Notification not found" });
  res.json(fmtRequest(notification));
};

// POST /api/corrective/requests
const create = async (req, res) => {
  const {
    notificationDate,
    notificationType,
    description,
    functionalLocation,
    equipment,
    equipmentId,
    requiredStart,
    requiredEnd,
    reportedBy,
    longText,
    workCenter,
  } = req.body;

  const { userId, role } = req.user;

  const photos = req.files || [];
  if (photos.length < 1 || photos.length > 2) {
    return res
      .status(400)
      .json({ error: "Notification requires 1-2 photos (max 2MB each)" });
  }

  const photoPaths = photos.map(
    (file) => `uploads/corrective/${file.filename}`,
  );
  const id = `NOTIF-${uuid().slice(0, 8).toUpperCase()}`;

  await Notification.create({
    notificationId: id, // using correct primary key mapped to id in the payload
    notificationDate: toDateOnly(notificationDate),
    notificationType,
    description,
    functionalLocation,
    equipmentName: equipment, // Map from equipment to equipmentName in DB model
    equipmentId,
    requiredStart: toDateOnly(requiredStart),
    requiredEnd: toDateOnly(requiredEnd),
    reportedBy,
    longText,
    photo1: photoPaths[0] || null,
    photo2: photoPaths[1] || null,
    kadisPelaporId: userId,
    submittedBy: userId,
    submittedAt: new Date(),
    status: "submitted",
    approvalStatus: "pending",
    workCenter: workCenter || null,
  });

  const fresh = await Notification.findByPk(id);
  res.status(201).json(fmtRequest(fresh));

  // 🔔 Notify all Planners about new corrective request
  const planners = await User.findAll({
    where: {
      [Op.or]: [{ role: "planner" }, { group: { [Op.like]: "%perencanaan%" } }],
    },
    attributes: ["id"],
  });
  await NotificationService.notify({
    module: "corrective",
    type: "new_request",
    title: "Laporan Corrective Baru",
    body: `Laporan baru dari ${reportedBy || "Kadis"}: ${description || "-"}`,
    data: { requestId: id, deepLink: "corrective/request-detail" },
    recipientIds: planners.map((u) => u.id),
  });
};

// PUT /api/corrective/requests/:id
const update = async (req, res) => {
  const { userId, role } = req.user;
  const notification = await Notification.findByPk(req.params.id);

  if (!notification)
    return res.status(404).json({ error: "Notification not found" });

  if (role === "planner") {
    return res
      .status(403)
      .json({ error: "Planner cannot modify notification fields directly." });
  }

  if (role === KADIS_ROLE) {
    if (
      notification.status === "spk_created" ||
      notification.status === "closed"
    ) {
      return res.status(400).json({
        error: "Cannot modify notification after SPK is created or closed",
      });
    }
  }

  // Transform mapped fields and dates for update
  const payload = { ...req.body };
  if (payload.equipment !== undefined)
    payload.equipmentName = payload.equipment;
  if (payload.notificationDate)
    payload.notificationDate = toDateOnly(payload.notificationDate);
  if (payload.requiredStart)
    payload.requiredStart = toDateOnly(payload.requiredStart);
  if (payload.requiredEnd)
    payload.requiredEnd = toDateOnly(payload.requiredEnd);

  await notification.update(payload);

  const fresh = await Notification.findByPk(
    notification.notificationId || notification.id,
  );
  res.json(fmtRequest(fresh));
};

// POST /api/corrective/requests/:id/approve
const approveKadisPusat = async (req, res) => {
  const notification = await Notification.findByPk(req.params.id);

  if (!notification)
    return res.status(404).json({ error: "Notification not found" });

  if (notification.approvalStatus !== "menunggu_review_awal_kadis_pp") {
    return res
      .status(400)
      .json({ error: "Notification is not awaiting awal review" });
  }

  await notification.update({
    status: "spk_created",
    approvalStatus: "spk_issued",
  });

  const fresh = await Notification.findByPk(
    notification.notificationId || notification.id,
    { include: [SPK_INCLUDE] },
  );
  res.json(fmtRequest(fresh));

  // 🔔 Notify Teknisi matching the workCenter that SPK is ready
  const wc = notification.workCenter;
  const groupMap = {
    mechanical: "mekanik",
    electrical: "listrik",
    civil: "sipil",
    automation: "otomasi",
  };
  const groupKeyword = groupMap[wc] || wc || "";
  const teknisiWhere = { role: { [Op.in]: ["teknisi", "kasie"] } };
  if (groupKeyword) teknisiWhere.group = { [Op.like]: `%${groupKeyword}%` };
  const teknisiUsers = await User.findAll({
    where: teknisiWhere,
    attributes: ["id"],
  });
  await NotificationService.notify({
    module: "corrective",
    type: "spk_ready",
    title: "SPK Siap Dikerjakan",
    body: `SPK untuk ${notification.equipmentName || "-"} sudah disetujui dan siap dikerjakan.`,
    data: {
      requestId: notification.notificationId,
      deepLink: "corrective/request-detail",
    },
    recipientIds: teknisiUsers.map((u) => u.id),
  });
};

// POST /api/corrective/requests/:id/reject
const rejectKadisPusat = async (req, res) => {
  const notification = await Notification.findByPk(req.params.id);

  if (!notification)
    return res.status(404).json({ error: "Notification not found" });

  if (notification.approvalStatus !== "menunggu_review_awal_kadis_pp") {
    return res
      .status(400)
      .json({ error: "Notification is not awaiting awal review" });
  }

  await notification.update({
    status: "spk_created",
    approvalStatus: "ditolak_kadis_pp_awal",
  });

  const fresh = await Notification.findByPk(
    notification.notificationId || notification.id,
    { include: [SPK_INCLUDE] },
  );
  res.json(fmtRequest(fresh));

  // 🔔 Notify Planners that SPK was rejected
  const plannerUsers = await User.findAll({
    where: {
      [Op.or]: [{ role: "planner" }, { group: { [Op.like]: "%perencanaan%" } }],
    },
    attributes: ["id"],
  });
  await NotificationService.notify({
    module: "corrective",
    type: "spk_rejected_pp",
    title: "SPK Ditolak oleh Kadis PP",
    body: `SPK untuk ${notification.equipmentName || "-"} ditolak. Silakan revisi.`,
    data: {
      requestId: notification.notificationId,
      deepLink: "corrective/request-detail",
    },
    recipientIds: plannerUsers.map((u) => u.id),
  });
};

// DELETE /api/corrective/requests/:id
const remove = async (req, res) => {
  const notification = await Notification.findByPk(req.params.id);
  if (!notification)
    return res.status(404).json({ error: "Notification not found" });

  if (notification.status === "spk_created") {
    return res
      .status(400)
      .json({ error: "Cannot delete notification after SPK is created" });
  }

  await notification.destroy();
  res.json({ message: "Notification deleted" });
};

// POST /api/corrective/requests/bulk-delete
const bulkDelete = async (req, res) => {
  const { ids } = req.body;
  if (!Array.isArray(ids) || !ids.length) {
    return res.status(400).json({ error: "ids array required" });
  }

  const count = await Notification.destroy({
    where: {
      notificationId: { [Op.in]: ids },
      status: { [Op.ne]: "spk_created" },
    },
  });

  res.json({ message: `Deleted ${count} notification(s)` });
};

// DELETE /api/corrective/requests
const deleteAll = async (req, res) => {
  try {
    const count = await Notification.destroy({
      where: {
        status: { [Op.ne]: "spk_created" }, // Prevent deleting notifications tied to old SPKs if any
      },
    });
    res.json({ message: `Berhasil menghapus ${count} notifikasi.` });
  } catch (error) {
    console.error("Error deleting all requests:", error);
    res.status(500).json({ error: error.message });
  }
};

// POST /api/corrective/requests/:id/approve-planner
const approvePlanner = async (req, res) => {
  const { sapOrderNumber } = req.body;
  if (!sapOrderNumber) {
    return res.status(400).json({ error: "No. Order SPK SAP wajib diisi" });
  }

  const notification = await Notification.findByPk(req.params.id);

  if (!notification)
    return res.status(404).json({ error: "Notification not found" });

  if (
    notification.status !== "submitted" &&
    notification.approvalStatus !== "pending"
  ) {
    return res
      .status(400)
      .json({ error: "Notification is not currently pending" });
  }

  await notification.update({
    sapOrderNumber,
    status: "approved",
    approvalStatus: "approved",
  });

  const fresh = await Notification.findByPk(
    notification.notificationId || notification.id,
  );
  res.json(fmtRequest(fresh));

  // 🔔 Notify Pelapor (Kadis Pelapor) that their report has been approved
  if (notification.kadisPelaporId) {
    // kadisPelaporId stores the user `id`, but NotificationService queries by `nik`
    const pelaporUser = await User.findByPk(notification.kadisPelaporId, {
      attributes: ["nik"],
    });
    if (pelaporUser?.nik) {
      await NotificationService.notify({
        module: "corrective",
        type: "request_approved_for_reporter",
        title: "Laporan Anda Telah Disetujui",
        body: `Laporan corrective ${notification.notificationId} (${notification.description || ""}) telah disetujui oleh Planner. Proses selanjutnya menunggu pembuatan SPK.`,
        data: {
          requestId: notification.notificationId,
          deepLink: "corrective/request-detail",
        },
        recipientIds: [pelaporUser.nik],
      });
    }
  }
};

// POST /api/corrective/requests/:id/reject-planner
const rejectPlanner = async (req, res) => {
  const { rejectionReason } = req.body;
  const notification = await Notification.findByPk(req.params.id);

  if (!notification)
    return res.status(404).json({ error: "Notification not found" });

  if (
    notification.status !== "submitted" &&
    notification.approvalStatus !== "pending"
  ) {
    return res
      .status(400)
      .json({ error: "Notification is not currently pending" });
  }

  await notification.update({
    status: "rejected",
    approvalStatus: "rejected",
    rejectionReason: rejectionReason || "Tidak ada alasan spesifik",
  });

  const fresh = await Notification.findByPk(
    notification.notificationId || notification.id,
  );
  res.json(fresh ? fmtRequest(fresh) : { success: true });

  // 🔔 Notify Pelapor (Kadis Pelapor) that their report has been rejected
  if (notification.kadisPelaporId) {
    const pelaporUser = await User.findByPk(notification.kadisPelaporId, {
      attributes: ["nik"],
    });
    if (pelaporUser?.nik) {
      await NotificationService.notify({
        module: "corrective",
        type: "request_rejected_for_reporter",
        title: "Laporan Anda Ditolak",
        body: `Laporan corrective ${notification.notificationId} (${notification.description || ""}) telah ditolak oleh Planner. Alasan: ${rejectionReason || "-"}`,
        data: {
          requestId: notification.notificationId,
          deepLink: "corrective/request-detail",
        },
        recipientIds: [pelaporUser.nik],
      });
    }
  }
};

module.exports = {
  getAll,
  getOne,
  create,
  update,
  remove,
  bulkDelete,
  deleteAll,
  approveKadisPusat,
  rejectKadisPusat,
  approvePlanner,
  rejectPlanner,
};
