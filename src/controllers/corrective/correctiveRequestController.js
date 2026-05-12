"use strict";

const { Op } = require("sequelize");
const { v4: uuid } = require("uuid");
const Notification = require("../../models/Notification");
const User = require("../../models/User");
const SapSpkCorrective = require("../../models/SapSpkCorrective");
const NotificationService = require("../../services/notificationService");
const {
  KADIS_ROLE,
} = require("../../middleware/correctiveAccess");

/**
 * Normalize a date string to YYYY-MM-DD format.
 */
function toDateOnly(raw) {
  if (!raw) return null;
  const str = String(raw).trim();
  if (!str) return null;

  const slashParts = str.match(/^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{4})$/);
  if (slashParts) {
    const [, day, month, year] = slashParts;
    const d = new Date(Number(year), Number(month) - 1, Number(day));
    if (!isNaN(d.getTime())) {
      return d.toISOString().slice(0, 10);
    }
  }

  const d = new Date(str);
  if (!isNaN(d.getTime())) {
    return d.toISOString().slice(0, 10);
  }

  return null;
}

/**
 * Format a Notification record into the API response shape.
 * @param {Object} notif - Notification model instance or plain object.
 * @param {Object|null} sapSpk - Matched SapSpkCorrective record (if any).
 */
function fmtRequest(notif, sapSpk) {
  const n = notif.toJSON ? notif.toJSON() : notif;
  const spk = n.spkCorrective || {};
  // SAP SPK data (from SapSpkCorrective table, matched via sapOrderNumber)
  const sap = sapSpk ? (sapSpk.toJSON ? sapSpk.toJSON() : sapSpk) : null;

  const images = [];
  if (n.photo1) images.push(n.photo1);
  if (n.photo2) images.push(n.photo2);

  const beforeImages = [];
  const afterImages = [];

  // Legacy SpkCorrective photos (if association still exists)
  if (spk.photos) {
    spk.photos.filter((p) => p.photoType === "before").forEach((p) => beforeImages.push(p.photoPath));
    spk.photos.filter((p) => p.photoType === "after").forEach((p) => afterImages.push(p.photoPath));
  }
  // SAP SPK photos (stored in uploads/ root by sapSpkRoutes multer)
  if (sap) {
    if (sap.photo_before) beforeImages.push(`uploads/${sap.photo_before}`);
    if (sap.photo_after) afterImages.push(`uploads/${sap.photo_after}`);
  }

  const materials = (spk.items || [])
    .filter((i) => i.itemType === "material")
    .map((i) => i.itemName);
  const tools = (spk.items || [])
    .filter((i) => i.itemType === "tool")
    .map((i) => i.itemName);

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

  // SAP data can override functional location / equipment if available
  if (sap) {
    if (sap.functional_location) finalFuncLoc = sap.functional_location;
    if (sap.equipment_name) finalEq = sap.equipment_name;
  }

  return {
    id: n.notificationId || n.id,
    notificationDate: n.notificationDate,
    notificationType: n.notificationType,
    description: sap?.description || n.description,
    functionalLocation: finalFuncLoc,
    equipment: finalEq,
    requiredStart: sap?.work_start || n.requiredStart,
    requiredEnd: sap?.work_finish || n.requiredEnd,
    reportedBy: sap?.report_by || n.reportedBy,
    reportedByRole: n.kadisPelapor?.role || null,
    reportedByDivisi: n.kadisPelapor?.divisi || null,
    reportedByDinas: n.kadisPelapor?.dinas || null,
    longText: n.longText,
    submittedBy: n.submittedBy,
    submittedAt: n.submittedAt,
    status: n.status,
    approvalStatus:
      sap?.status === "eksekusi" ? "eksekusi" : 
      sap?.status === "menunggu_review_kadis_pp" ? "menunggu_review_kadis_pp" :
      sap?.status === "menunggu_review_kadis_pelapor" ? "menunggu_review_kadis_pelapor" :
      sap?.status === "selesai" ? "selesai" :
      n.status === "closed" ? "selesai" : n.approvalStatus || "pending",
    workCenter: sap?.work_center || spk.workCenter || n.workCenter,
    sapOrderNumber: n.sapOrderNumber,
    rejectionReason: n.rejectionReason,
    images,
    spkId: spk.spkId || (sap ? sap.order_number : null),
    spkNumber: spk.spkNumber || n.sapOrderNumber,
    priority: spk.priority,
    targetDate: sap?.work_finish || spk.requestedFinishDate,
    classification: spk.damageClassification,
    numOfWork: sap?.num_of_work || spk.plannedWorker,
    personnelCount: sap?.num_of_work || spk.plannedWorker,
    estimatedDuration: sap?.dur_plan != null ? Number(sap.dur_plan) : (spk.totalPlannedHour || null),
    instructions: sap?.short_text || spk.jobDescription,
    beforeImages,
    afterImages,
    materials,
    tools,
    actualPersonnelCount: sap?.actual_personnel || spk.actualWorker,
    actualDuration: sap?.total_actual_hour != null ? Number(sap.total_actual_hour) : (spk.totalActualHour || null),
    executionResultText: sap?.job_result_description || spk.jobResultDescription,
    // Technician info from SAP SPK
    executionName: sap?.execution_name || null,
    executionNik: sap?.execution_nik || null,
    executionWorkCenter: sap?.work_center || null,
    actualWorkStart: sap?.work_start || spk.actualStartDate,
    actualWorkFinish: sap?.work_finish || null,
    actualStartTime: sap?.start_time || null,
    actualFinishTime: sap?.finish_time || null,
    actualMaterials: sap?.actual_materials ? sap.actual_materials.split(', ').filter(Boolean) : [],
    actualTools: sap?.actual_tools ? sap.actual_tools.split(', ').filter(Boolean) : [],
  };
}

// GET /api/corrective/requests
const getAll = async (req, res) => {
  try {
    const { userId, role } = req.user;
    const where = {};

    if (req.query.status) where.status = req.query.status;

    const userRole = (role || "").toLowerCase();
    if (userRole === "kadis") {
      const { dinas } = req.user;
      const isKadisPusat =
        dinas && dinas.toLowerCase().includes("pusat perawatan");
      if (!isKadisPusat) {
        where.kadisPelaporId = userId;
      }
    }

    const data = await Notification.findAll({
      where,
      include: [{ model: User, as: "kadisPelapor" }],
      order: [["submittedAt", "DESC"]],
    });

    // Look up matching SAP SPK records for all notifications that have sapOrderNumber
    const sapOrderNumbers = data
      .map((n) => n.sapOrderNumber)
      .filter(Boolean);
    let sapSpkMap = {};
    if (sapOrderNumbers.length > 0) {
      const sapSpks = await SapSpkCorrective.findAll({
        where: { order_number: { [Op.in]: sapOrderNumbers } },
      });
      sapSpkMap = Object.fromEntries(
        sapSpks.map((s) => [s.order_number, s])
      );
    }

    res.json(data.map((n) => fmtRequest(n, sapSpkMap[n.sapOrderNumber] || null)));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// GET /api/corrective/requests/:id
const getOne = async (req, res) => {
  try {
    const notification = await Notification.findByPk(req.params.id, {
      include: [{ model: User, as: "kadisPelapor" }],
    });
    if (!notification)
      return res.status(404).json({ error: "Notification not found" });

    // Look up matching SAP SPK record
    let sapSpk = null;
    if (notification.sapOrderNumber) {
      sapSpk = await SapSpkCorrective.findByPk(notification.sapOrderNumber);
    }

    res.json(fmtRequest(notification, sapSpk));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// POST /api/corrective/requests
const create = async (req, res) => {
  try {
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

    const { userId } = req.user;

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
      notificationId: id,
      notificationDate: toDateOnly(notificationDate),
      notificationType,
      description,
      functionalLocation,
      equipmentName: equipment,
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
    res.status(201).json(fresh ? fmtRequest(fresh) : { success: true });

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
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// PUT /api/corrective/requests/:id
const update = async (req, res) => {
  try {
    const { role } = req.user;
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
    res.json(fresh ? fmtRequest(fresh) : { success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// POST /api/corrective/requests/:id/approve
const approveKadisPusat = async (req, res) => {
  try {
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
      notification.notificationId || notification.id
    );
    res.json(fresh ? fmtRequest(fresh) : { success: true });

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
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// POST /api/corrective/requests/:id/reject
const rejectKadisPusat = async (req, res) => {
  try {
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
      notification.notificationId || notification.id
    );
    res.json(fresh ? fmtRequest(fresh) : { success: true });

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
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// DELETE /api/corrective/requests/:id
const remove = async (req, res) => {
  try {
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
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// POST /api/corrective/requests/bulk-delete
const bulkDelete = async (req, res) => {
  try {
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
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// DELETE /api/corrective/requests
const deleteAll = async (req, res) => {
  try {
    const count = await Notification.destroy({
      where: {
        status: { [Op.ne]: "spk_created" },
      },
    });
    res.json({ message: `Berhasil menghapus ${count} notifikasi.` });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// POST /api/corrective/requests/:id/update-sap-number
const updateSapNumber = async (req, res) => {
  try {
    const { sapOrderNumber } = req.body;

    if (!sapOrderNumber || !/^\d{10}$/.test(sapOrderNumber)) {
      return res
        .status(400)
        .json({ error: "No. Order SPK SAP harus 10 digit angka" });
    }

    const notification = await Notification.findByPk(req.params.id);
    if (!notification) {
      return res.status(404).json({ error: "Notifikasi tidak ditemukan" });
    }

    await notification.update({ sapOrderNumber });

    const spkExists = await SapSpkCorrective.findByPk(sapOrderNumber);
    if (spkExists) {
      await notification.update({ 
        status: "spk_created",
        approvalStatus: "spk_issued" 
      });

      if (notification.kadisPelaporId) {
        const pelaporUser = await User.findByPk(notification.kadisPelaporId, {
          attributes: ["nik"],
        });
        if (pelaporUser?.nik) {
          await NotificationService.notify({
            module: "corrective",
            type: "corrective_notification_approved",
            recipientIds: [pelaporUser.nik],
            title: "SPK Corrective Ditemukan",
            body: `Laporan ${notification.notificationId} telah cocok dengan SPK SAP ${sapOrderNumber}. Progres kini dapat dipantau.`,
            data: {
              id: notification.id,
              sapOrderNumber: sapOrderNumber,
            },
          });
        }
      }
    }

    const fresh = await Notification.findByPk(notification.notificationId || notification.id);
    res.json({ success: true, data: fresh ? fmtRequest(fresh) : { success: true } });
  } catch (error) {
    console.error("Error updating SAP number:", error);
    res.status(500).json({ error: error.message });
  }
};

// POST /api/corrective/requests/:id/approve-planner
const approvePlanner = async (req, res) => {
  try {
    const { sapOrderNumber } = req.body;
    if (!sapOrderNumber) {
      return res.status(400).json({ error: "No. Order SPK SAP wajib diisi" });
    }

    if (!/^\d{10}$/.test(sapOrderNumber)) {
      return res
        .status(400)
        .json({ error: "No. Order SPK SAP harus 10 digit angka" });
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

    if (spkExists) {
      await notification.update({ 
        status: "spk_created",
        approvalStatus: "spk_issued" 
      });
    }

    const fresh = await Notification.findByPk(
      notification.notificationId || notification.id,
    );
    res.json(fresh ? fmtRequest(fresh) : { success: true });

    if (notification.kadisPelaporId) {
      const pelaporUser = await User.findByPk(notification.kadisPelaporId, {
        attributes: ["nik"],
      });
      if (pelaporUser?.nik) {
        const bodyText = spkExists 
          ? `Laporan corrective ${notification.notificationId} (${notification.description || ""}) telah disetujui dan SPK (${sapOrderNumber}) sudah tersedia.`
          : `Laporan corrective ${notification.notificationId} (${notification.description || ""}) telah disetujui oleh Planner. Proses selanjutnya menunggu pembuatan SPK.`;

        await NotificationService.notify({
          module: "corrective",
          type: "request_approved_for_reporter",
          title: "Laporan Anda Telah Disetujui",
          body: bodyText,
          data: {
            requestId: notification.notificationId,
            deepLink: "corrective/request-detail",
          },
          recipientIds: [pelaporUser.nik],
        });
      }
    }
  } catch (error) {
    console.error("Error in approvePlanner:", error);
    res.status(500).json({ error: error.message });
  }
};

// POST /api/corrective/requests/:id/reject-planner
const rejectPlanner = async (req, res) => {
  try {
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
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

/**
 * Admin Only: Force update notification status and approval status
 */
const adminUpdateStatus = async (req, res) => {
  try {
    if (req.user.role !== "admin") {
      return res.status(403).json({ error: "Only admin can force update status" });
    }

    const { status, approvalStatus } = req.body;
    const notification = await Notification.findByPk(req.params.id);

    if (!notification) {
      return res.status(404).json({ error: "Notification not found" });
    }

    const updates = {};
    if (status) updates.status = status;
    if (approvalStatus) updates.approvalStatus = approvalStatus;

    await notification.update(updates);

    const fresh = await Notification.findByPk(notification.notificationId || notification.id);
    res.json({ success: true, data: fmtRequest(fresh) });
  } catch (error) {
    res.status(500).json({ error: error.message });
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
  updateSapNumber,
  adminUpdateStatus,
};
