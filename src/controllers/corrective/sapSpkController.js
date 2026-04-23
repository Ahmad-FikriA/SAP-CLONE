const SapSpkCorrective = require("../../models/SapSpkCorrective");
const exceljs = require("exceljs");
const fs = require("fs");
const path = require("path");

// 1. Get SAP SPK List
const getSapSpkList = async (req, res) => {
  try {
    const spks = await SapSpkCorrective.findAll({
      order: [["created_at", "DESC"]],
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
      maint_activ_type: findCol(["maintactivtype", "maint activ type", "maint. activ. type"]),
      actual_work: findCol(["actual work"]),
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

    // Return the preview data without saving to DB
    res.status(200).json({
      status: "success",
      message: `Berhasil memproses file Excel. ${newRows.length} data baru, ${skippedRows.length} data dilewati.`,
      data: {
        previewData: newRows,
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
      return res
        .status(400)
        .json({
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
        "location",
      ],
    });

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

// 3. Teknisi Execute SPK
const executeSapSpk = async (req, res) => {
  const { order_number } = req.params;
  const {
    actual_materials,
    actual_tools,
    actual_personnel,
    total_actual_hour,
    execution_nik,
    job_result_description,
  } = req.body;

  try {
    const spk = await SapSpkCorrective.findByPk(order_number);
    if (!spk) {
      return res
        .status(404)
        .json({ status: "error", message: "SPK not found" });
    }

    const updates = {
      actual_materials,
      actual_tools,
      actual_personnel: actual_personnel ? parseInt(actual_personnel) : null,
      total_actual_hour: total_actual_hour
        ? parseFloat(total_actual_hour)
        : null,
      execution_nik,
      job_result_description,
      status: "menunggu_review_kadis_pp",
    };

    if (req.files) {
      if (req.files.photoBefore && req.files.photoBefore[0]) {
        updates.photo_before = req.files.photoBefore[0].filename;
      }
      if (req.files.photoAfter && req.files.photoAfter[0]) {
        updates.photo_after = req.files.photoAfter[0].filename;
      }
    }

    await spk.update(updates);

    res.status(200).json({
      status: "success",
      message: "SPK updated and sent for Kadis PP review",
      data: spk,
    });
  } catch (error) {
    console.error("Error executing SAP SPK:", error);
    res.status(500).json({ status: "error", message: error.message });
  }
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
    res
      .status(200)
      .json({
        status: "success",
        message: "All SAP SPKs deleted successfully",
      });
  } catch (error) {
    console.error("Error deleting all SAP SPKs:", error);
    res.status(500).json({ status: "error", message: error.message });
  }
};

module.exports = {
  getSapSpkList,
  uploadExcel,
  bulkInsertSapSpk,
  executeSapSpk,
  deleteSapSpk,
  deleteAllSapSpk,
};
