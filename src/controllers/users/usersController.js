'use strict';

const { Op } = require('sequelize');
const sequelize = require('../../config/database');
const User = require('../../models/User');
const { Spk } = require('../../models/Spk');

const SAFE = { attributes: { exclude: ['password'] } };


const getAll = async (req, res) => {
  try {
    const where = {};
    if (req.query.role) where.role = req.query.role;
    if (req.query.dinas) where.dinas = req.query.dinas;
    const users = await User.findAll({ where, ...SAFE });
    res.json(users);
  } catch (err) {
    console.error('[Users] getAll error:', err.message);
    res.status(500).json({ error: 'Gagal mengambil data users' });
  }
};


const create = async (req, res) => {
  try {
    const { id, nik, password, name, role, email, dinas, divisi, group, permissions } = req.body;
    if (!id || !nik) {
      return res.status(400).json({ error: 'id and nik are required' });
    }
    const exists = await User.findOne({ where: { nik } });
    if (exists) return res.status(409).json({ error: 'NIK already exists' });

    const user = await User.create({ id, nik, password: password || 'password123', name, role, email, dinas, divisi, group, permissions: permissions ?? null });
    const { password: _, ...safe } = user.toJSON();
    res.status(201).json(safe);
  } catch (err) {
    console.error('[Users] create error:', err.message);
    res.status(500).json({ error: 'Gagal membuat user: ' + err.message });
  }
};


const update = async (req, res) => {
  try {
    const user = await User.findByPk(req.params.id);
    if (!user) return res.status(404).json({ error: 'User not found' });
    await user.update({ ...req.body, id: user.id });
    const { password: _, ...safe } = user.toJSON();
    res.json(safe);
  } catch (err) {
    console.error('[Users] update error:', err.message);
    res.status(500).json({ error: 'Gagal update user: ' + err.message });
  }
};




const remove = async (req, res) => {
  try {
    const count = await User.destroy({ where: { id: req.params.id } });
    if (!count) return res.status(404).json({ error: 'User not found' });
    res.json({ message: 'Deleted' });
  } catch (err) {
    console.error('[Users] remove error:', err.message);
    res.status(500).json({ error: 'Gagal menghapus user' });
  }
};


const getStats = async (req, res) => {
  try {
    const users = await User.findAll({
      attributes: ['id', 'name', 'role', 'group', 'dinas'],
      order: [['name', 'ASC']],
    });

    const spkCounts = await Spk.findAll({
      where: { submittedBy: { [Op.not]: null } },
      attributes: [
        'submittedBy',
        'status',
        [sequelize.fn('COUNT', sequelize.col('spk_number')), 'count'],
      ],
      group: ['submitted_by', 'status'],
      raw: true,
    });

    const latestSubs = await Spk.findAll({
      where: { submittedBy: { [Op.not]: null }, submittedAt: { [Op.not]: null } },
      attributes: [
        'submittedBy',
        [sequelize.fn('MAX', sequelize.col('submitted_at')), 'lastSubmittedAt'],
      ],
      group: ['submitted_by'],
      raw: true,
    });

    const statsMap = {};
    for (const row of spkCounts) {
      if (!statsMap[row.submittedBy]) statsMap[row.submittedBy] = { total: 0, approved: 0 };
      statsMap[row.submittedBy].total += parseInt(row.count);
      if (row.status === 'approved') statsMap[row.submittedBy].approved += parseInt(row.count);
    }
    const lastSubMap = Object.fromEntries(latestSubs.map(r => [r.submittedBy, r.lastSubmittedAt]));

    res.json(users.map(u => ({
      id: u.id,
      name: u.name,
      role: u.role,
      group: u.group,
      dinas: u.dinas,
      totalSpk: statsMap[u.id]?.total || 0,
      approvedSpk: statsMap[u.id]?.approved || 0,
      lastSubmittedAt: lastSubMap[u.id] || null,
    })));
  } catch (err) {
    console.error('[Users] getStats error:', err.message);
    res.status(500).json({ error: 'Gagal mengambil statistik users' });
  }
};

function toTitleCase(str) {
  if (!str || typeof str !== 'string') return str;
  return str.toLowerCase().split(' ').map(function(word) {
    return word.charAt(0).toUpperCase() + word.slice(1);
  }).join(' ');
}

// POST /api/users/upload-excel
const uploadExcel = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No Excel file uploaded" });
    }

    const exceljs = require("exceljs");
    const fs = require("fs");
    const workbook = new exceljs.Workbook();
    await workbook.xlsx.readFile(req.file.path);

    const worksheet = workbook.worksheets[0];
    if (!worksheet) {
      return res.status(400).json({ error: "Excel file is empty" });
    }

    let headerRowIndex = 1;
    for (let r = 1; r <= Math.min(20, worksheet.rowCount); r++) {
      const row = worksheet.getRow(r);
      let foundKey = false;
      row.eachCell((cell) => {
        const val = cell.value ? cell.value.toString().toLowerCase() : "";
        if (val.includes("nik") || val.includes("nama") || val.includes("jabatan")) {
          foundKey = true;
        }
      });
      if (foundKey) {
        headerRowIndex = r;
        break;
      }
    }

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
      nik: findCol(["nik"]),
      name: findCol(["nama", "name"]),
      role: findCol(["jabatan", "role"]),
      group: findCol(["seksi", "group"]),
      dinas: findCol(["dinas"]),
      divisi: findCol(["divisi", "division", "department"])
    };

    if (!colMap.nik || !colMap.name) {
      return res.status(400).json({ error: "Cannot find 'NIK' or 'Nama' columns in the Excel file" });
    }

    const rowsToUpsert = [];
    const seenExcelNiks = new Set();
    const excelDuplicateRows = [];

    worksheet.eachRow((row, rowNumber) => {
      if (rowNumber <= headerRowIndex) return;

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

      let nik = getVal("nik");
      if (!nik) return;

      nik = nik.split('.')[0]; // Clean NIK

      let name = getVal("name");
      if (name) name = toTitleCase(name);

      let role = getVal("role") || "teknisi";
      role = role.toLowerCase().trim();

      const permissions = {
        _app: { preventive: false, corrective: false, inspection: false, supervisi: false, k3_safety: true },
        hse: ["C", "R"]
      };

      const userRow = {
        id: `USR-${nik}`,
        nik,
        name,
        role,
        group: getVal("group") || "",
        dinas: getVal("dinas") || "",
        divisi: getVal("divisi") || "",
        password: "password123",
        permissions: permissions,
      };

      if (seenExcelNiks.has(nik)) {
        excelDuplicateRows.push(userRow);
      } else {
        seenExcelNiks.add(nik);
        rowsToUpsert.push(userRow);
      }
    });

    if (fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }

    const incomingNiks = rowsToUpsert.map((r) => r.nik);
    const existingUsers = await User.findAll({
      attributes: ["nik"],
      where: { nik: incomingNiks },
    });

    const existingSet = new Set(existingUsers.map((u) => u.nik));

    const newRows = [];
    const skippedRows = [...excelDuplicateRows];

    for (const row of rowsToUpsert) {
      if (existingSet.has(row.nik)) {
        skippedRows.push(row);
      } else {
        newRows.push(row);
      }
    }

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
    if (req.file && require("fs").existsSync(req.file.path)) {
      require("fs").unlinkSync(req.file.path);
    }
    res.status(500).json({ error: error.message });
  }
};

// POST /api/users/bulk-insert
const bulkInsert = async (req, res) => {
  try {
    const { users } = req.body;
    if (!users || !Array.isArray(users)) {
      return res.status(400).json({ error: "Invalid payload, expected array of users" });
    }

    await User.bulkCreate(users, {
      updateOnDuplicate: [
        "name", "role", "group", "dinas", "divisi", "permissions"
      ],
    });

    res.status(200).json({
      status: "success",
      message: `Successfully saved ${users.length} user records`,
      data: users.length,
    });
  } catch (error) {
    console.error("Error bulk inserting users:", error);
    res.status(500).json({ error: error.message });
  }
};

module.exports = { getAll, create, update, remove, getStats, uploadExcel, bulkInsert };

