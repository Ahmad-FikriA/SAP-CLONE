const SapSpkCorrective = require("../../models/SapSpkCorrective");
const Notification = require("../../models/Notification");
const { Op } = require("sequelize");
const exceljs = require("exceljs");
const fs = require("fs");
const path = require("path");
const User = require("../../models/User");
const NotificationService = require("../../services/notificationService");

// 1. Get SAP SPK List
const getSapSpkList = async (req, res) => {
  try {
    const where = {};
    const { role, group, dinas } = req.user || {};

    // Filter by group if not admin/super-user
    // Kadis Pusat Perawatan is considered a super-user for corrective
    const isKadisPP = role === "kadis" && dinas && dinas.toLowerCase().includes("pusat perawatan");
    
    if (role !== "admin" && !isKadisPP && group) {
      const prefixes = [];
      if (group.includes("Elektrik")) prefixes.push("E");
      if (group.includes("Otomasi")) prefixes.push("O");
      if (group.includes("Mekanik")) prefixes.push("M");
      if (group.includes("Sipil")) prefixes.push("S");

      if (prefixes.length > 0) {
        where.work_center = {
          [Op.or]: prefixes.map((p) => ({ [Op.like]: `${p}%` })),
        };
      }
    }

    const spks = await SapSpkCorrective.findAll({
      where,
      order: [["created_at", "DESC"]],
      include: [
        {
          model: Notification,
          as: "notification",
          attributes: ["kadisPelaporId"],
          include: [
            {
              model: User,
              as: "kadisPelapor",
              attributes: ["name", "role", "dinas", "divisi", "group"],
            },
          ],
        },
        {
          model: User,
          as: "executor",
          attributes: ["name", "role", "dinas", "divisi", "group"],
        },
      ],
    });
    res.status(200).json({
      status: "success",
      data: spks,
    });
  } catch (error) {
    console.error("Error fetching SAP SPK list:", error);
    res.status(500).json({ status: "error", message: error.message });
  }
};

// 2. Upload and Parse Excel
const uploadExcel = async (req, res) => {
  try {
    if (!req.file) {
      return res
        .status(400)
        .json({ status: "error", message: "No Excel file uploaded" });
    }

    const workbook = new exceljs.Workbook();
    await workbook.xlsx.readFile(req.file.path);

    // Get the first worksheet
    const worksheet = workbook.worksheets[0];
    if (!worksheet) {
      return res
        .status(400)
        .json({ status: "error", message: "Excel file is empty" });
    }

    // Identify Headers
    let headerRowIndex = 1;
    let headers = [];
    worksheet.getRow(headerRowIndex).eachCell((cell, colNumber) => {
      headers[colNumber] = cell.value ? cell.value.toString().trim() : "";
    });

    // We define a helper to find column by a substring (case insensitive)
    const findCol = (namePatterns) => {
      for (let i = 1; i < headers.length; i++) {
        if (!headers[i]) continue;
        const h = headers[i].toLowerCase();
        for (const pattern of namePatterns) {
          if (h.includes(pattern)) return i;
        }
      }
      return null;
    };

    const colMap = {
      order_number: findCol(["order"]),
      description: findCol(["description"]),
      sys_status: findCol(["sys", "status", "system status"]),
      cost_center: findCol(["cost center"]),
      ctrl_key: findCol(["control key", "ctrl key", "ctrlkey"]),
      confirm_number: findCol(["confirm", "confirmation"]),
      work_center: findCol(["work center", "workcenter", "oper.work center"]),
      activity: findCol(["activity"]),
      short_text: findCol(["short text", "op. short text"]),
      normal_dur: findCol(["normal dur", "norm dur", "normal duration"]),
      normal_dur_un: findCol([
        "duratn un",
        "dur un",
        "dur. un",
        "norm.duratn un",
        "norm.duratn un.",
      ]),
      dur_plan: findCol(["duration plan", "dur plan", "dur. plan"]),
      unit_for_work: findCol(["unit for work", "un."]),
      dur_act: findCol(["duration actual", "dur act", "dur. act"]),
      posting_date: findCol(["posting date"]),
      conf_text: findCol(["confirmation text", "conf text", "conf. text"]),
      reason_of_var: findCol(["reason of var", "reason of variance"]),
      work_start: findCol(["work start"]),
      work_finish: findCol(["work finish"]),
      start_time: findCol(["start time"]),
      finish_time: findCol(["finish time"]),
      report_by: findCol(["reported by", "report by", "report. by"]),
      equipment_name: findCol(["equipment"]),
      functional_location: findCol([
        "functional loc",
        "functional location",
        "functional loc.",
      ]),
      maint_activ_type: findCol([
        "maintactivtype",
        "maint activ type",
        "maint. activ. type",
      ]),
      actual_work: findCol(["actual work"]),
      num_of_work: findCol([
        "no. of work",
        "num of work",
        "no.of work",
        "number of work",
        "numofwork",
      ]),
      location: findCol(["location"]),
    };

    if (!colMap.order_number) {
      return res.status(400).json({
        status: "error",
        message: "Cannot find 'Order' column in the Excel file",
      });
    }

    const rowsToUpsert = [];

    worksheet.eachRow((row, rowNumber) => {
      if (rowNumber === headerRowIndex) return;

      const getVal = (key) => {
        const colIdx = colMap[key];
        if (!colIdx) return null;
        let val = row.getCell(colIdx).value;
        if (val === null || val === undefined) return null;
        if (typeof val === "object" && val.text) val = val.text; // formula cells or rich text
        if (val instanceof Date) {
          return val.toISOString().split("T")[0]; // Just basic date
        }
        return val.toString().trim();
      };

      const orderNum = getVal("order_number");
      if (!orderNum) return;

      rowsToUpsert.push({
        order_number: orderNum,
        description: getVal("description"),
        sys_status: getVal("sys_status"),
        cost_center: getVal("cost_center"),
        ctrl_key: getVal("ctrl_key"),
        confirm_number: getVal("confirm_number"),
        work_center: getVal("work_center"),
        activity: getVal("activity"),
        short_text: getVal("short_text"),
        normal_dur: parseFloat(getVal("normal_dur")) || null,
        normal_dur_un: getVal("normal_dur_un"),
        dur_plan: parseFloat(getVal("dur_plan")) || null,
        unit_for_work: getVal("unit_for_work"),
        dur_act: parseFloat(getVal("dur_act")) || null,
        posting_date: getVal("posting_date"),
        conf_text: getVal("conf_text"),
        reason_of_var: getVal("reason_of_var"),
        work_start: getVal("work_start"),
        work_finish: getVal("work_finish"),
        start_time: getVal("start_time"),
        finish_time: getVal("finish_time"),
        report_by: getVal("report_by"),
        equipment_name: getVal("equipment_name"),
        functional_location: getVal("functional_location"),
        maint_activ_type: getVal("maint_activ_type"),
        actual_work: parseFloat(getVal("actual_work")) || null,
        num_of_work: parseInt(getVal("num_of_work")) || null,
        location: getVal("location"),
      });
    });

    // Delete uploaded file after processing
    if (fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }

    // Check existing order numbers
    const incomingOrderNumbers = rowsToUpsert.map((r) => r.order_number);
    const existingSpks = await SapSpkCorrective.findAll({
      attributes: ["order_number"],
      where: {
        order_number: incomingOrderNumbers,
      },
    });

    const existingSet = new Set(existingSpks.map((s) => s.order_number));

    const newRows = [];
    const skippedRows = [];

    for (const row of rowsToUpsert) {
      if (existingSet.has(row.order_number)) {
        skippedRows.push(row);
      } else {
        newRows.push(row);
      }
    }

    // Check which new SPKs have a matching Notification
    const newOrderNumbers = newRows.map((r) => r.order_number);
    const matchingNotifications = await Notification.findAll({
      attributes: ["sapOrderNumber"],
      where: {
        sapOrderNumber: {
          [Op.in]: newOrderNumbers,
        },
      },
    });

    const matchingSet = new Set(
      matchingNotifications.map((n) => n.sapOrderNumber),
    );

    const newRowsWithMatchStatus = newRows.map((row) => ({
      ...row,
      hasMatchedNotification: matchingSet.has(row.order_number),
    }));

    // Return the preview data without saving to DB
    res.status(200).json({
      status: "success",
      message: `Berhasil memproses file Excel. ${newRows.length} data baru, ${skippedRows.length} data dilewati.`,
      data: {
        previewData: newRowsWithMatchStatus,
        skippedData: skippedRows,
      },
    });
  } catch (error) {
    console.error("Error uploading Excel:", error);
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    res.status(500).json({ status: "error", message: error.message });
  }
};

// 2b. Bulk Insert SPK (Confirm Upload)
const bulkInsertSapSpk = async (req, res) => {
  try {
    const { spks } = req.body;
    if (!spks || !Array.isArray(spks)) {
      return res.status(400).json({
        status: "error",
        message: "Invalid payload, expected array of spks",
      });
    }

    await SapSpkCorrective.bulkCreate(spks, {
      updateOnDuplicate: [
        "description",
        "sys_status",
        "cost_center",
        "ctrl_key",
        "confirm_number",
        "work_center",
        "activity",
        "short_text",
        "normal_dur",
        "normal_dur_un",
        "dur_plan",
        "unit_for_work",
        "dur_act",
        "posting_date",
        "conf_text",
        "reason_of_var",
        "work_start",
        "work_finish",
        "start_time",
        "finish_time",
        "report_by",
        "equipment_name",
        "functional_location",
        "maint_activ_type",
        "actual_work",
        "num_of_work",
        "location",
      ],
    });

    // 🔔 Trigger FCM for matching notifications & Work Center Groups
    const WORK_CENTER_GROUP_MAP = {
      E: "Elektrik",
      O: "Otomasi",
      M: "Mekanik",
      S: "Sipil & Lingkungan",
    };

    try {
      // A. Existing logic: Match with reporter notifications
      const newOrderNumbers = spks.map((s) => s.order_number);
      const matchingNotifications = await Notification.findAll({
        where: {
          sapOrderNumber: { [Op.in]: newOrderNumbers },
        },
      });

      for (const notif of matchingNotifications) {
        if (notif.kadisPelaporId) {
          const pelaporUser = await User.findByPk(notif.kadisPelaporId, {
            attributes: ["nik"],
          });
          if (pelaporUser?.nik) {
            // Update status to spk_issued
            await notif.update({ approvalStatus: "spk_issued" });

            await NotificationService.notify({
              module: "corrective",
              type: "corrective_notification_approved",
              recipientIds: [pelaporUser.nik],
              title: "SPK Corrective Terbit",
              body: `SPK SAP untuk laporan ${notif.notificationId} telah tersedia (${notif.sapOrderNumber}). Silakan cek progres di aplikasi.`,
              data: {
                id: notif.id,
                sapOrderNumber: notif.sapOrderNumber,
              },
            });
          }
        }
      }

      // B. New logic: Notify Work Center Groups
      const groupCounts = {}; // { 'Mekanik': 5, 'Elektrik': 2 }
      for (const spk of spks) {
        const wc = spk.work_center || "";
        const prefix = wc.split("-")[0]?.charAt(0)?.toUpperCase();
        const groupName = WORK_CENTER_GROUP_MAP[prefix];
        if (groupName) {
          groupCounts[groupName] = (groupCounts[groupName] || 0) + 1;
        }
      }

      for (const [groupName, count] of Object.entries(groupCounts)) {
        // Find all users in this group (Teknisi, Petugas, Kasie)
        const groupUsers = await User.findAll({
          where: {
            group: { [Op.like]: `%${groupName}%` },
          },
          attributes: ["id"],
        });

        if (groupUsers.length > 0) {
          await NotificationService.notify({
            module: "corrective",
            type: "new_workcenter_spk",
            recipientIds: groupUsers.map((u) => u.id),
            title: "Tugas SPK Baru",
            body: `Ada ${count} SPK Corrective baru untuk grup ${groupName}. Silakan cek di aplikasi.`,
            data: {
              group: groupName,
              count: String(count),
            },
          });
        }
      }
    } catch (notifErr) {
      console.error("Error sending matching notifications:", notifErr);
      // Don't fail the whole request if notification fails
    }

    res.status(200).json({
      status: "success",
      message: `Successfully saved ${spks.length} SPK records to database`,
      data: spks.length,
    });
  } catch (error) {
    console.error("Error bulk inserting SAP SPKs:", error);
    res.status(500).json({ status: "error", message: error.message });
  }
};

// ── Reason of Variance Codes (dropdown options for teknisi) ──────────────────
const REASON_OF_VARIANCE_CODES = {
  '0001': 'Machine malfunction',
  '0002': 'Operating error',
  '0003': 'Defective material',
  '0004': 'Object running',
  '0005': 'Object breakdown',
  '0006': 'Bad weather',
  '0007': 'Duplicate WO',
  '0008': 'No fault found',
  '0009': 'Others',
};

// 3a. Teknisi Claim SPK (Photo Before + Lock)
const claimSapSpk = async (req, res) => {
  const { order_number } = req.params;

  try {
    const spk = await SapSpkCorrective.findByPk(order_number);
    if (!spk) {
      return res
        .status(404)
        .json({ status: "error", message: "SPK not found" });
    }

    // Only allow claim on fresh SPKs
    if (spk.status !== "baru_import") {
      // If already claimed by this user, allow re-upload of photo
      if (spk.status === "eksekusi" && spk.execution_nik === req.user.nik) {
        const updates = { claimed_at: new Date() };
        if (req.file) {
          updates.photo_before = req.file.filename;
        }
        await spk.update(updates);
        return res.status(200).json({
          status: "success",
          message: "Photo before updated",
          data: spk,
        });
      }

      return res.status(409).json({
        status: "error",
        message: spk.execution_nik
          ? `SPK sudah diklaim oleh ${spk.execution_name || spk.execution_nik}`
          : "SPK tidak dalam status baru",
      });
    }

    const updates = {
      execution_nik: req.user.nik,
      execution_name: req.user.name || req.user.nik,
      claimed_at: new Date(),
      status: "eksekusi",
    };

    if (req.file) {
      updates.photo_before = req.file.filename;
    }

    await spk.update(updates);

    // Sync status to Notification table if exists
    const Notification = require("../../models/Notification");
    await Notification.update(
      { approvalStatus: "eksekusi" },
      { where: { sapOrderNumber: order_number } }
    );

    res.status(200).json({
      status: "success",
      message: "SPK berhasil diklaim. Silakan lanjutkan eksekusi.",
      data: spk,
    });
  } catch (error) {
    console.error("Error claiming SAP SPK:", error);
    res.status(500).json({ status: "error", message: error.message });
  }
};

// 3b. Teknisi Complete SPK (Form + Photo After)
const executeSapSpk = async (req, res) => {
  const { order_number } = req.params;
  const {
    conf_text,
    reason_of_var,
    work_start,
    work_finish,
    start_time,
    finish_time,
    actual_materials,
    actual_tools,
    actual_personnel,
    actual_work,
    job_result_description,
  } = req.body;

  try {
    const spk = await SapSpkCorrective.findByPk(order_number);
    if (!spk) {
      return res
        .status(404)
        .json({ status: "error", message: "SPK not found" });
    }

    // ── Ownership check: only the claimer can complete ──
    if (spk.execution_nik !== req.user.nik) {
      return res.status(403).json({
        status: "error",
        message: `Hanya ${spk.execution_name || spk.execution_nik} yang dapat melengkapi SPK ini.`,
      });
    }

    if (spk.status !== "eksekusi") {
      return res.status(400).json({
        status: "error",
        message: `SPK tidak dalam status eksekusi (status saat ini: ${spk.status})`,
      });
    }

    // ── Validate reason_of_var code ──
    if (reason_of_var && !REASON_OF_VARIANCE_CODES[reason_of_var]) {
      return res.status(400).json({
        status: "error",
        message: `Kode reason of variance tidak valid: ${reason_of_var}. Gunakan 0001-0009.`,
      });
    }

    // ── Auto-compute total_actual_hour ──
    const personnel = actual_personnel ? parseInt(actual_personnel) : null;
    const workHours = actual_work ? parseFloat(actual_work) : null;
    const computedTotalHour =
      personnel && workHours ? parseFloat((personnel * workHours).toFixed(2)) : null;

    const updates = {
      conf_text,
      reason_of_var,
      work_start: work_start || null,
      work_finish: work_finish || null,
      start_time: start_time || null,
      finish_time: finish_time || null,
      actual_materials,
      actual_tools,
      actual_personnel: personnel,
      actual_work: workHours,
      total_actual_hour: computedTotalHour,
      job_result_description,
      status: "menunggu_review_kadis_pp",
    };

    // Photo after
    if (req.file) {
      updates.photo_after = req.file.filename;
    } else if (req.files && req.files.photoAfter && req.files.photoAfter[0]) {
      updates.photo_after = req.files.photoAfter[0].filename;
    }

    await spk.update(updates);

    // Sync status to Notification table if exists
    const Notification = require("../../models/Notification");
    await Notification.update(
      { approvalStatus: "menunggu_review_kadis_pp" },
      { where: { sapOrderNumber: order_number } }
    );

    res.status(200).json({
      status: "success",
      message: "SPK berhasil dilengkapi dan dikirim untuk review Kadis PP",
      data: spk,
    });
  } catch (error) {
    console.error("Error executing SAP SPK:", error);
    res.status(500).json({ status: "error", message: error.message });
  }
};

// 3c. Get Reason of Variance codes (for frontend dropdown)
const getReasonOfVarianceCodes = (req, res) => {
  const codes = Object.entries(REASON_OF_VARIANCE_CODES).map(([code, label]) => ({
    code,
    label: `${code} - ${label}`,
  }));
  res.status(200).json({ status: "success", data: codes });
};

// 4. Delete Single SPK
const deleteSapSpk = async (req, res) => {
  try {
    const { order_number } = req.params;
    const deleted = await SapSpkCorrective.destroy({ where: { order_number } });
    if (deleted) {
      res
        .status(200)
        .json({ status: "success", message: "SPK deleted successfully" });
    } else {
      res.status(404).json({ status: "error", message: "SPK not found" });
    }
  } catch (error) {
    console.error("Error deleting SAP SPK:", error);
    res.status(500).json({ status: "error", message: error.message });
  }
};

// 5. Delete All SPK
const deleteAllSapSpk = async (req, res) => {
  try {
    await SapSpkCorrective.destroy({ where: {} });
    res.status(200).json({
      status: "success",
      message: "All SAP SPKs deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting all SAP SPKs:", error);
    res.status(500).json({ status: "error", message: error.message });
  }
};

// 6. Manual Create SPK (for testing/bypass SAP)
const createManualSapSpk = async (req, res) => {
  try {
    const spkData = req.body;
    
    if (!spkData.order_number) {
      return res.status(400).json({ status: "error", message: "Order Number is required" });
    }

    const existing = await SapSpkCorrective.findByPk(spkData.order_number);
    if (existing) {
      return res.status(400).json({ status: "error", message: "SPK with this Order Number already exists" });
    }

    const newSpk = await SapSpkCorrective.create(spkData);

    // Sync to notification if exists
    const Notification = require("../../models/Notification");
    const notif = await Notification.findOne({ where: { sapOrderNumber: spkData.order_number } });
    if (notif && notif.kadisPelaporId) {
      await notif.update({ approvalStatus: "spk_issued" });
      const pelaporUser = await User.findByPk(notif.kadisPelaporId, { attributes: ["nik"] });
      if (pelaporUser?.nik) {
        await NotificationService.notify({
          module: "corrective",
          type: "corrective_notification_approved",
          recipientIds: [pelaporUser.nik],
          title: "SPK Corrective Terbit",
          body: `SPK SAP untuk laporan ${notif.notificationId} telah tersedia (${notif.sapOrderNumber}). Silakan cek progres di aplikasi.`,
          data: { id: notif.id, sapOrderNumber: notif.sapOrderNumber },
        });
      }
    }

    res.status(201).json({
      status: "success",
      message: "Manual SPK created successfully",
      data: newSpk,
    });
  } catch (error) {
    console.error("Error creating manual SAP SPK:", error);
    res.status(500).json({ status: "error", message: error.message });
  }
};

// ── 4. Approval Flows ──────────────────────────────────────────────────────────

// 4a. Kadis PP Approve
const approveKadisPp = async (req, res) => {
  const { order_number } = req.params;
  try {
    const spk = await SapSpkCorrective.findByPk(order_number, {
      include: ["notification"]
    });
    
    if (!spk) return res.status(404).json({ status: "error", message: "SPK not found" });
    if (spk.status !== "menunggu_review_kadis_pp") {
      return res.status(400).json({ status: "error", message: `Status SPK saat ini: ${spk.status}. Harus menunggu_review_kadis_pp.` });
    }

    await spk.update({
      status: "menunggu_review_kadis_pelapor",
      kadis_pusat_approved_by: req.user.name || req.user.nik,
      kadis_pusat_approved_at: new Date(),
    });

    // Sync status to Notification table if exists
    const Notification = require("../../models/Notification");
    await Notification.update(
      { approvalStatus: "menunggu_review_kadis_pelapor" },
      { where: { sapOrderNumber: order_number } }
    );

    // Notify Kadis Pelapor (if notification exists)
    if (spk.notification && spk.notification.kadisPelaporId) {
      await NotificationService.notify({
        module: "corrective",
        type: "review_kadis_pelapor",
        targetId: [spk.notification.kadisPelaporId],
        title: "Review Pekerjaan Selesai",
        body: `Pekerjaan SPK ${spk.orderNumber} telah selesai. Mohon review pekerjaan ini.`,
        data: { id: spk.notification.id, spkId: spk.orderNumber },
      });
    }

    res.json({ status: "success", message: "Disetujui. Diteruskan ke Kadis Pelapor.", data: spk });
  } catch (error) {
    console.error("Error approve Kadis PP:", error);
    res.status(500).json({ status: "error", message: error.message });
  }
};

// 4b. Kadis PP Reject
const rejectKadisPp = async (req, res) => {
  const { order_number } = req.params;
  const { rejection_note } = req.body;
  if (!rejection_note) return res.status(400).json({ status: "error", message: "Catatan penolakan harus diisi" });

  try {
    const spk = await SapSpkCorrective.findByPk(order_number);
    if (!spk) return res.status(404).json({ status: "error", message: "SPK not found" });
    
    await spk.update({
      status: "eksekusi", // Kembali ke teknisi
      rejected_by: req.user.name || req.user.nik,
      rejected_at: new Date(),
      rejection_note,
    });

    // Sync status to Notification table if exists
    const Notification = require("../../models/Notification");
    await Notification.update(
      { approvalStatus: "eksekusi" },
      { where: { sapOrderNumber: order_number } }
    );

    // Notify Teknisi
    if (spk.execution_nik) {
      await NotificationService.notify({
        module: "corrective",
        type: "spk_rejected",
        targetNik: [spk.execution_nik],
        title: "Laporan SPK Ditolak Kadis PP",
        body: `SPK ${spk.orderNumber} ditolak: ${rejection_note}. Mohon perbaiki laporan/pekerjaan.`,
        data: { spkId: spk.orderNumber },
      });
    }

    res.json({ status: "success", message: "Ditolak. SPK dikembalikan ke teknisi.", data: spk });
  } catch (error) {
    console.error("Error reject Kadis PP:", error);
    res.status(500).json({ status: "error", message: error.message });
  }
};

// 4c. Kadis Pelapor Approve
const approveKadisPelapor = async (req, res) => {
  const { order_number } = req.params;
  try {
    const spk = await SapSpkCorrective.findByPk(order_number);
    
    if (!spk) return res.status(404).json({ status: "error", message: "SPK not found" });
    if (spk.status !== "menunggu_review_kadis_pelapor") {
      return res.status(400).json({ status: "error", message: `Status SPK saat ini: ${spk.status}. Harus menunggu_review_kadis_pelapor.` });
    }

    await spk.update({
      status: "selesai",
      kadis_pelapor_approved_by: req.user.name || req.user.nik,
      kadis_pelapor_approved_at: new Date(),
    });

    // Sync status to Notification table if exists
    const Notification = require("../../models/Notification");
    await Notification.update(
      { approvalStatus: "selesai" },
      { where: { sapOrderNumber: order_number } }
    );

    // Notify Teknisi that it's completely done
    if (spk.execution_nik) {
      await NotificationService.notify({
        module: "corrective",
        type: "spk_completed",
        targetNik: [spk.execution_nik],
        title: "SPK Selesai",
        body: `SPK ${spk.orderNumber} telah disetujui sepenuhnya oleh pelapor.`,
        data: { spkId: spk.orderNumber },
      });
    }

    res.json({ status: "success", message: "SPK selesai sepenuhnya.", data: spk });
  } catch (error) {
    console.error("Error approve Kadis Pelapor:", error);
    res.status(500).json({ status: "error", message: error.message });
  }
};

// 4d. Kadis Pelapor Reject
const rejectKadisPelapor = async (req, res) => {
  const { order_number } = req.params;
  const { rejection_note } = req.body;
  if (!rejection_note) return res.status(400).json({ status: "error", message: "Catatan penolakan harus diisi" });

  try {
    const spk = await SapSpkCorrective.findByPk(order_number);
    if (!spk) return res.status(404).json({ status: "error", message: "SPK not found" });
    
    await spk.update({
      status: "eksekusi", // Kembali ke teknisi
      rejected_by: req.user.name || req.user.nik,
      rejected_at: new Date(),
      rejection_note,
    });

    // Sync status to Notification table if exists
    const Notification = require("../../models/Notification");
    await Notification.update(
      { approvalStatus: "eksekusi" },
      { where: { sapOrderNumber: order_number } }
    );

    // Notify Teknisi
    if (spk.execution_nik) {
      await NotificationService.notify({
        module: "corrective",
        type: "spk_rejected",
        targetNik: [spk.execution_nik],
        title: "Laporan SPK Ditolak Pelapor",
        body: `SPK ${spk.orderNumber} ditolak pelapor: ${rejection_note}. Mohon perbaiki.`,
        data: { spkId: spk.orderNumber },
      });
    }

    res.json({ status: "success", message: "Ditolak. SPK dikembalikan ke teknisi.", data: spk });
  } catch (error) {
    console.error("Error reject Kadis Pelapor:", error);
    res.status(500).json({ status: "error", message: error.message });
  }
};

module.exports = {
  getSapSpkList,
  uploadExcel,
  bulkInsertSapSpk,
  createManualSapSpk,
  claimSapSpk,
  executeSapSpk,
  getReasonOfVarianceCodes,
  approveKadisPp,
  rejectKadisPp,
  approveKadisPelapor,
  rejectKadisPelapor,
  deleteSapSpk,
  deleteAllSapSpk,
};

