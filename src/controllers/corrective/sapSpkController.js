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

    const userRole = (role || "").toLowerCase();
    const isKadisPP = userRole === "kadis" && dinas && dinas.toLowerCase().includes("pusat perawatan");
    
    const notificationInclude = {
      model: Notification,
      as: "notification",
      attributes: ["kadisPelaporId", "requiredStart", "requiredEnd"],
      include: [
        {
          model: User,
          as: "kadisPelapor",
          attributes: ["name", "role", "dinas", "divisi", "group"],
        },
      ],
    };

    if (userRole !== "admin" && !isKadisPP && userRole !== "kadis" && group) {
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
        notificationInclude,
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
      return res.status(400).json({ status: "error", message: "No Excel file uploaded" });
    }

    const workbook = new exceljs.Workbook();
    await workbook.xlsx.readFile(req.file.path);

    const worksheet = workbook.worksheets[0];
    if (!worksheet) {
      return res.status(400).json({ status: "error", message: "Excel file is empty" });
    }

    let headerRowIndex = 1;
    let headers = [];
    worksheet.getRow(headerRowIndex).eachCell((cell, colNumber) => {
      headers[colNumber] = cell.value ? cell.value.toString().trim() : "";
    });

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
      normal_dur_un: findCol(["duratn un", "dur un", "dur. un", "norm.duratn un", "norm.duratn un."]),
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
      functional_location: findCol(["functional loc", "functional location", "functional loc."]),
      maint_activ_type: findCol(["maintactivtype", "maint activ type", "maint. activ. type"]),
      actual_work: findCol(["actual work"]),
      num_of_work: findCol(["no. of work", "num of work", "no.of work", "number of work", "numofwork"]),
      location: findCol(["location"]),
    };

    if (!colMap.order_number) {
      return res.status(400).json({ status: "error", message: "Cannot find 'Order' column in the Excel file" });
    }

    const rowsToUpsert = [];

    worksheet.eachRow((row, rowNumber) => {
      if (rowNumber === headerRowIndex) return;

      const getVal = (key) => {
        const colIdx = colMap[key];
        if (!colIdx) return null;
        let val = row.getCell(colIdx).value;
        if (val === null || val === undefined) return null;
        if (typeof val === "object" && val.text) val = val.text;
        if (val instanceof Date) {
          return val.toISOString().split("T")[0];
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

    if (fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }

    const incomingOrderNumbers = rowsToUpsert.map((r) => r.order_number);
    const existingSpks = await SapSpkCorrective.findAll({
      attributes: ["order_number"],
      where: { order_number: incomingOrderNumbers },
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

    const newOrderNumbers = newRows.map((r) => r.order_number);
    const matchingNotifications = await Notification.findAll({
      attributes: ["sapOrderNumber"],
      where: { sapOrderNumber: { [Op.in]: newOrderNumbers } },
    });

    const matchingSet = new Set(matchingNotifications.map((n) => n.sapOrderNumber));

    const newRowsWithMatchStatus = newRows.map((row) => ({
      ...row,
      hasMatchedNotification: matchingSet.has(row.order_number),
    }));

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
      return res.status(400).json({ status: "error", message: "Invalid payload, expected array of spks" });
    }

    await SapSpkCorrective.bulkCreate(spks, {
      updateOnDuplicate: [
        "description", "sys_status", "cost_center", "ctrl_key", "confirm_number",
        "work_center", "activity", "short_text", "normal_dur", "normal_dur_un",
        "dur_plan", "unit_for_work", "dur_act", "posting_date", "conf_text",
        "reason_of_var", "work_start", "work_finish", "start_time", "finish_time",
        "report_by", "equipment_name", "functional_location", "maint_activ_type",
        "actual_work", "num_of_work", "location",
      ],
    });

    const WORK_CENTER_GROUP_MAP = {
      E: "Elektrik",
      O: "Otomasi",
      M: "Mekanik",
      S: "Sipil & Lingkungan",
    };

    try {
      const newOrderNumbers = spks.map((s) => s.order_number);
      const matchingNotifications = await Notification.findAll({
        where: { sapOrderNumber: { [Op.in]: newOrderNumbers } },
      });

      for (const notif of matchingNotifications) {
        if (notif.kadisPelaporId) {
          const pelaporUser = await User.findByPk(notif.kadisPelaporId, { attributes: ["nik"] });
          if (pelaporUser?.nik) {
            await notif.update({ status: "spk_created", approvalStatus: "spk_issued" });
            await NotificationService.notify({
              module: "corrective",
              type: "corrective_notification_approved",
              recipientIds: [pelaporUser.nik],
              title: "SPK Corrective Terbit",
              body: `SPK SAP untuk laporan ${notif.notificationId} telah tersedia (${notif.sapOrderNumber}).`,
              data: { id: notif.id, sapOrderNumber: notif.sapOrderNumber },
            });
          }
        }
      }

      const groupCounts = {};
      for (const spk of spks) {
        const wc = spk.work_center || "";
        const prefix = wc.split("-")[0]?.charAt(0)?.toUpperCase();
        const groupName = WORK_CENTER_GROUP_MAP[prefix];
        if (groupName) groupCounts[groupName] = (groupCounts[groupName] || 0) + 1;
      }

      for (const [groupName, count] of Object.entries(groupCounts)) {
        const groupUsers = await User.findAll({
          where: { group: { [Op.like]: `%${groupName}%` } },
          attributes: ["id"],
        });
        if (groupUsers.length > 0) {
          await NotificationService.notify({
            module: "corrective",
            type: "new_workcenter_spk",
            recipientIds: groupUsers.map((u) => u.id),
            title: "Tugas SPK Baru",
            body: `Ada ${count} SPK Corrective baru untuk grup ${groupName}.`,
            data: { group: groupName, count: String(count) },
          });
        }
      }
    } catch (notifErr) {
      console.error("Error sending notifications:", notifErr);
    }

    res.status(200).json({ status: "success", message: `Successfully saved ${spks.length} records`, data: spks.length });
  } catch (error) {
    console.error("Error bulk inserting SAP SPKs:", error);
    res.status(500).json({ status: "error", message: error.message });
  }
};

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

const claimSapSpk = async (req, res) => {
  const { order_number } = req.params;
  try {
    const spk = await SapSpkCorrective.findByPk(order_number);
    if (!spk) return res.status(404).json({ status: "error", message: "SPK not found" });

    if (spk.status !== "baru_import") {
      if (spk.status === "eksekusi" && spk.execution_nik === req.user.nik) {
        const updates = { claimed_at: new Date() };
        if (req.file) updates.photo_before = req.file.filename;
        await spk.update(updates);
        return res.status(200).json({ status: "success", message: "Photo before updated", data: spk });
      }
      return res.status(409).json({ status: "error", message: "SPK sudah diklaim orang lain" });
    }

    const updates = {
      execution_nik: req.user.nik,
      execution_name: req.user.name || req.user.nik,
      claimed_at: new Date(),
      status: "eksekusi",
    };
    if (req.file) updates.photo_before = req.file.filename;

    await spk.update(updates);
    await Notification.update({ approvalStatus: "eksekusi" }, { where: { sapOrderNumber: order_number } });

    res.status(200).json({ status: "success", message: "SPK berhasil diklaim", data: spk });
  } catch (error) {
    res.status(500).json({ status: "error", message: error.message });
  }
};

const executeSapSpk = async (req, res) => {
  const { order_number } = req.params;
  const {
    conf_text, reason_of_var, work_start, work_finish, start_time, finish_time,
    actual_materials, actual_tools, actual_personnel, actual_work, job_result_description,
  } = req.body;

  try {
    const spk = await SapSpkCorrective.findByPk(order_number);
    if (!spk) return res.status(404).json({ status: "error", message: "SPK not found" });

    if (spk.execution_nik !== req.user.nik) {
      return res.status(403).json({ status: "error", message: "Bukan executor SPK ini" });
    }

    if (reason_of_var && !REASON_OF_VARIANCE_CODES[reason_of_var]) {
      return res.status(400).json({ status: "error", message: "Kode reason of variance tidak valid" });
    }

    const personnel = actual_personnel ? parseInt(actual_personnel) : null;
    const workHours = actual_work ? parseFloat(actual_work) : null;
    const computedTotalHour = personnel && workHours ? parseFloat((personnel * workHours).toFixed(2)) : null;

    const updates = {
      conf_text, reason_of_var, work_start: work_start || null, work_finish: work_finish || null,
      start_time: start_time || null, finish_time: finish_time || null,
      actual_materials, actual_tools, actual_personnel: personnel, actual_work: workHours,
      total_actual_hour: computedTotalHour, job_result_description,
      status: "menunggu_review_kadis_pp",
    };

    if (req.file) updates.photo_after = req.file.filename;

    await spk.update(updates);
    await Notification.update({ approvalStatus: "menunggu_review_kadis_pp" }, { where: { sapOrderNumber: order_number } });

    // Notify Kadis PP
    const kadisPpUsers = await User.findAll({ where: { role: "kadis", dinas: { [Op.like]: "%pusat perawatan%" } } });
    const kadisPpIds = kadisPpUsers.map(u => u.id);
    if (kadisPpIds.length > 0) {
      await NotificationService.notify({
        module: "corrective",
        type: "review_kadis_pp",
        recipientIds: kadisPpIds,
        title: "Review Pekerjaan Selesai",
        body: `SPK ${order_number} selesai.`,
        data: { spkId: order_number },
      });
    }

    res.status(200).json({ status: "success", message: "SPK dikirim untuk review", data: spk });
  } catch (error) {
    res.status(500).json({ status: "error", message: error.message });
  }
};

const getReasonOfVarianceCodes = (req, res) => {
  const codes = Object.entries(REASON_OF_VARIANCE_CODES).map(([code, label]) => ({ code, label: `${code} - ${label}` }));
  res.status(200).json({ status: "success", data: codes });
};

const updateSapSpk = async (req, res) => {
  try {
    const { orderNumber } = req.params;
    const { role, group } = req.user;
    const isPlanner = role === "admin" || (group && group.toLowerCase().includes("perencanaan"));

    if (!isPlanner) return res.status(403).json({ status: "error", message: "Hanya Planner" });

    const spk = await SapSpkCorrective.findByPk(orderNumber);
    if (!spk) return res.status(404).json({ status: "error", message: "SPK tidak ditemukan" });

    const { description, short_text, num_of_work, dur_plan } = req.body;
    const updates = {};
    if (description !== undefined) updates.description = description;
    if (short_text !== undefined) updates.short_text = short_text;
    if (num_of_work !== undefined) updates.num_of_work = num_of_work;
    if (dur_plan !== undefined) updates.dur_plan = dur_plan;

    await spk.update(updates);
    res.status(200).json({ status: "success", message: "Data SPK diperbarui", data: spk });
  } catch (error) {
    res.status(500).json({ status: "error", message: error.message });
  }
};

const approveKadisPp = async (req, res) => {
  const { order_number } = req.params;
  try {
    const spk = await SapSpkCorrective.findByPk(order_number, { include: ["notification"] });
    if (!spk) return res.status(404).json({ status: "error", message: "SPK not found" });

    await spk.update({
      status: "menunggu_review_kadis_pelapor",
      kadis_pusat_approved_by: req.user.name || req.user.nik,
      kadis_pusat_approved_at: new Date(),
    });

    await Notification.update({ approvalStatus: "menunggu_review_kadis_pelapor" }, { where: { sapOrderNumber: order_number } });

    if (spk.notification && spk.notification.kadisPelaporId) {
      await NotificationService.notify({
        module: "corrective",
        type: "review_kadis_pelapor",
        recipientIds: [spk.notification.kadisPelaporId],
        title: "Review Pekerjaan Selesai",
        body: `SPK ${order_number} menunggu review Anda.`,
        data: { id: spk.notification.id, spkId: order_number },
      });
    }
    res.json({ status: "success", message: "Disetujui Kadis PP" });
  } catch (error) {
    res.status(500).json({ status: "error", message: error.message });
  }
};

const rejectKadisPp = async (req, res) => {
  const { order_number } = req.params;
  const { rejection_note } = req.body;
  try {
    const spk = await SapSpkCorrective.findByPk(order_number);
    await spk.update({ status: "eksekusi", rejected_by: req.user.name || req.user.nik, rejected_at: new Date(), rejection_note });
    await Notification.update({ approvalStatus: "eksekusi" }, { where: { sapOrderNumber: order_number } });
    res.json({ status: "success", message: "Ditolak Kadis PP" });
  } catch (error) {
    res.status(500).json({ status: "error", message: error.message });
  }
};

const approveKadisPelapor = async (req, res) => {
  const { order_number } = req.params;
  try {
    const spk = await SapSpkCorrective.findByPk(order_number);
    await spk.update({ status: "selesai", kadis_pelapor_approved_by: req.user.name || req.user.nik, kadis_pelapor_approved_at: new Date() });
    await Notification.update({ approvalStatus: "selesai" }, { where: { sapOrderNumber: order_number } });
    res.json({ status: "success", message: "SPK Selesai" });
  } catch (error) {
    res.status(500).json({ status: "error", message: error.message });
  }
};

const rejectKadisPelapor = async (req, res) => {
  const { order_number } = req.params;
  const { rejection_note } = req.body;
  try {
    const spk = await SapSpkCorrective.findByPk(order_number);
    await spk.update({ status: "eksekusi", rejected_by: req.user.name || req.user.nik, rejected_at: new Date(), rejection_note });
    await Notification.update({ approvalStatus: "eksekusi" }, { where: { sapOrderNumber: order_number } });
    res.json({ status: "success", message: "Ditolak Pelapor" });
  } catch (error) {
    res.status(500).json({ status: "error", message: error.message });
  }
};

const exportHistory = async (req, res) => {
  try {
    const { ids } = req.body || {};
    const whereClause = { status: { [Op.in]: ["selesai", "ditolak"] } };
    if (ids && Array.isArray(ids) && ids.length > 0) whereClause.order_number = { [Op.in]: ids };

    const spks = await SapSpkCorrective.findAll({ where: whereClause, order: [["created_at", "DESC"]] });
    const workbook = new exceljs.Workbook();
    const ws = workbook.addWorksheet("Confirmation");
    const headers = [
      "Order", "Description", "System status", "Cost Center", "Control Key", "Confirmation", "Oper.Work Center", "Activity", "Op. Short Text",
      "Normal duration", "Norm.duratn un.", "Duration Plan", "Unit for Work", "Duration Actual", "Actual work", "Posting Date", "Confirmation Text",
      "Reason of Variance", "Work Start", "Work Finish", "Start Time", "Finish Time", "MaintActivType", "Location", "Functional Loc.", "Equipment", "numofwork",
    ];
    ws.addRow(headers);
    for (const s of spks) {
      ws.addRow([
        s.order_number, s.description, s.sys_status, s.cost_center, s.ctrl_key, s.confirm_number, s.work_center, s.activity, s.short_text || s.description,
        s.normal_dur, s.normal_dur_un, s.dur_plan, s.unit_for_work, s.dur_act, s.actual_work || s.total_actual_hour, s.posting_date, s.conf_text,
        s.reason_of_var, s.work_start, s.work_finish, s.start_time, s.finish_time, s.maint_activ_type, s.location, s.functional_location, s.equipment_name, s.num_of_work,
      ]);
    }
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", `attachment; filename="IW49_History.xlsx"`);
    await workbook.xlsx.write(res);
    res.end();
  } catch (error) {
    res.status(500).json({ status: "error", message: error.message });
  }
};

const uploadHistoryExcel = async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ status: "error", message: "No Excel" });
    const workbook = new exceljs.Workbook();
    await workbook.xlsx.readFile(req.file.path);
    const worksheet = workbook.worksheets[0];
    const rowsToUpsert = [];
    // Simplifed for brevity but keeping essential logic
    worksheet.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return;
      const orderNum = row.getCell(1).value?.toString();
      if (orderNum) rowsToUpsert.push({ order_number: orderNum, status: "selesai", job_result_description: "History Import" });
    });
    await SapSpkCorrective.bulkCreate(rowsToUpsert, { updateOnDuplicate: ["status"] });
    if (fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
    res.json({ status: "success", message: "Imported" });
  } catch (error) {
    res.status(500).json({ status: "error", message: error.message });
  }
};

const createManualSapSpk = async (req, res) => {
  try {
    const spk = await SapSpkCorrective.create(req.body);
    res.status(201).json({ status: "success", data: spk });
  } catch (error) {
    res.status(500).json({ status: "error", message: error.message });
  }
};

const deleteSapSpk = async (req, res) => {
  try {
    await SapSpkCorrective.destroy({ where: { order_number: req.params.order_number } });
    res.json({ status: "success" });
  } catch (error) {
    res.status(500).json({ status: "error", message: error.message });
  }
};

const deleteAllSapSpk = async (req, res) => {
  try {
    await SapSpkCorrective.destroy({ where: {} });
    res.json({ status: "success" });
  } catch (error) {
    res.status(500).json({ status: "error", message: error.message });
  }
};

const getCorrectiveStats = async (req, res) => {
  try {
    const spks = await SapSpkCorrective.findAll({
      include: [{ model: Notification, as: "notification", include: [{ model: User, as: "kadisPelapor", attributes: ["dinas"] }] }]
    });
    const workCenterStats = {};
    const technicianStats = {};
    const departmentStats = {};
    spks.forEach(spk => {
      const wc = spk.work_center || "Unknown";
      workCenterStats[wc] = (workCenterStats[wc] || 0) + 1;
      if (spk.execution_nik) {
        const name = spk.execution_name || spk.execution_nik;
        if (!technicianStats[spk.execution_nik]) technicianStats[spk.execution_nik] = { name, count: 0 };
        technicianStats[spk.execution_nik].count++;
      }
      const dinas = spk.notification?.kadisPelapor?.dinas || spk.location || "Unknown";
      departmentStats[dinas] = (departmentStats[dinas] || 0) + 1;
    });
    const format = (obj) => Object.entries(obj).map(([id, d]) => (typeof d === 'object' ? { name: d.name, count: d.count, id } : { name: id, count: d, id })).sort((a, b) => b.count - a.count);
    res.json({ status: "success", data: { totalSpk: spks.length, workCenters: format(workCenterStats), technicians: format(technicianStats), departments: format(departmentStats) } });
  } catch (error) {
    res.status(500).json({ status: "error", message: error.message });
  }
};

module.exports = {
  getSapSpkList, uploadExcel, bulkInsertSapSpk, createManualSapSpk, claimSapSpk, executeSapSpk, getReasonOfVarianceCodes,
  approveKadisPp, rejectKadisPp, approveKadisPelapor, rejectKadisPelapor, deleteSapSpk, deleteAllSapSpk, getCorrectiveStats,
  exportHistory, uploadHistoryExcel, updateSapSpk,
};
