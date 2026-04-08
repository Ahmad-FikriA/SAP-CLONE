'use strict';

const { Op } = require('sequelize');
const ExcelJS = require('exceljs');
const { Submission, SubmissionPhoto, SubmissionActivityResult } = require('../../models/Submission');
const { Spk, SpkEquipment, SpkActivity } = require('../../models/Spk');
const Equipment = require('../../models/Equipment');
const FunctionalLocation = require('../../models/FunctionalLocation');
const EquipmentIntervalMapping = require('../../models/EquipmentIntervalMapping');
const { GeneralTaskList } = require('../../models/GeneralTaskList');

const INCLUDE_FULL = [
  { model: SubmissionPhoto, as: 'photos', attributes: ['photoPath'] },
  { model: SubmissionActivityResult, as: 'activityResults', attributes: ['activityNumber', 'resultComment', 'isNormal', 'isVerified'] },
];

function fmt(sub) {
  const j = sub.toJSON();
  return {
    id: j.id,
    spkNumber: j.spkNumber,
    durationActual: j.durationActual,
    evaluasi: j.evaluasi,
    latitude: j.latitude,
    longitude: j.longitude,
    submittedAt: j.submittedAt,
    photoPaths: (j.photos || []).map(p => p.photoPath),
    activityResultsModel: j.activityResults || [],
  };
}

// GET /api/submissions?category=Mekanik
const getAll = async (req, res) => {
  const { category } = req.query;
  let spkNumbers = null;

  if (category) {
    const matchingSpks = await Spk.findAll({ where: { category }, attributes: ['spkNumber'] });
    spkNumbers = matchingSpks.map(s => s.spkNumber);
    if (!spkNumbers.length) return res.json([]);
  }

  const where = spkNumbers ? { spkNumber: spkNumbers } : {};
  const data = await Submission.findAll({ where, include: INCLUDE_FULL, order: [['submittedAt', 'DESC']] });
  res.json(data.map(fmt));
};

// GET /api/submissions/:id
const getOne = async (req, res) => {
  const sub = await Submission.findByPk(req.params.id, { include: INCLUDE_FULL });
  if (!sub) return res.status(404).json({ error: 'Submission not found' });
  res.json(fmt(sub));
};

// POST /api/submissions/bulk-delete
const bulkDelete = async (req, res) => {
  const { ids } = req.body;
  if (!Array.isArray(ids) || !ids.length) {
    return res.status(400).json({ error: 'ids array required' });
  }
  const count = await Submission.destroy({ where: { id: { [Op.in]: ids } } });
  res.json({ message: `Deleted ${count} submission(s)` });
};

// DELETE /api/submissions/:id
const remove = async (req, res) => {
  const count = await Submission.destroy({ where: { id: req.params.id } });
  if (!count) return res.status(404).json({ error: 'Submission not found' });
  res.json({ message: 'Deleted' });
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtDate(ts) {
  if (!ts) return '-';
  return new Date(ts).toLocaleDateString('id-ID', { timeZone: 'Asia/Jakarta', day: '2-digit', month: '2-digit', year: 'numeric' });
}

function fmtTs(ts) {
  if (!ts) return '-';
  return new Date(ts).toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' });
}

// Shared border style
const BORDER_THIN = {
  top: { style: 'thin' },
  left: { style: 'thin' },
  bottom: { style: 'thin' },
  right: { style: 'thin' },
};
const BORDER_MEDIUM = {
  top: { style: 'medium' },
  left: { style: 'medium' },
  bottom: { style: 'medium' },
  right: { style: 'medium' },
};

// Fill a row's cells with a style
function styleRow(ws, rowNum, cols, style) {
  for (let c = cols[0]; c <= cols[1]; c++) {
    const cell = ws.getCell(rowNum, c);
    Object.assign(cell, style);
  }
}

// Apply border to a range of cells
function borderRange(ws, startRow, endRow, startCol, endCol, border = BORDER_THIN) {
  for (let r = startRow; r <= endRow; r++) {
    for (let c = startCol; c <= endCol; c++) {
      ws.getCell(r, c).border = border;
    }
  }
}

// GET /api/submissions/export  — download formatted LK xlsx
// Query params: month (1-12), year, category
const exportExcel = async (req, res) => {
  try {
    const { from, to, month, year, category } = req.query;

    // ── Build date filter ──────────────────────────────────────────────────
    const where = {};
    if (from || to) {
      where.submittedAt = {};
      if (from) where.submittedAt[Op.gte] = new Date(from);
      if (to) {
        const toDate = new Date(to);
        toDate.setHours(23, 59, 59, 999);
        where.submittedAt[Op.lte] = toDate;
      }
    } else if (month || year) {
      const y = parseInt(year) || new Date().getFullYear();
      if (month) {
        const m = parseInt(month);
        where.submittedAt = { [Op.between]: [new Date(y, m - 1, 1), new Date(y, m, 0, 23, 59, 59, 999)] };
      } else {
        where.submittedAt = { [Op.between]: [new Date(y, 0, 1), new Date(y, 11, 31, 23, 59, 59, 999)] };
      }
    }

    // ── Fetch submissions ──────────────────────────────────────────────────
    const submissions = await Submission.findAll({
      where,
      include: [{
        model: SubmissionActivityResult, as: 'activityResults',
        attributes: ['activityNumber', 'resultComment', 'isNormal', 'isVerified']
      }],
      order: [['submittedAt', 'ASC']],
    });
    if (!submissions.length) {
      return res.status(404).json({ error: 'Tidak ada data untuk filter yang dipilih' });
    }

    // ── Fetch SPK data (approved only) ────────────────────────────────────
    const spkNumbers = [...new Set(submissions.map(s => s.spkNumber))];
    const spks = await Spk.findAll({
      where: { spkNumber: spkNumbers, status: 'approved', ...(category ? { category } : {}) },
      include: [
        {
          model: SpkEquipment, as: 'equipmentModels', attributes: ['equipmentId'],
          include: [{
            model: Equipment, as: 'equipmentDetails',
            attributes: ['equipmentId', 'equipmentName', 'plantName', 'functionalLocation', 'funcLocId', 'latitude', 'longitude'],
            include: [
              { model: FunctionalLocation, as: 'funcLoc', attributes: ['description'], required: false },
              {
                model: EquipmentIntervalMapping, as: 'intervalMappings',
                attributes: ['interval', 'taskListId'],
                include: [{ model: GeneralTaskList, as: 'taskList', attributes: ['taskListName'], required: false }],
                required: false,
              },
            ],
          }],
        },
        {
          model: SpkActivity, as: 'activitiesModel',
          attributes: ['activityNumber', 'equipmentId', 'operationText', 'durationPlan']
        },
      ],
      attributes: ['spkNumber', 'description', 'category', 'intervalPeriod', 'status',
        'submittedBy', 'submittedAt',
        'kasieApprovedBy', 'kasieApprovedAt',
        'kadisPerawatanApprovedBy', 'kadisPerawatanApprovedAt',
        'kadisApprovedBy', 'kadisApprovedAt'],
    });
    const spkMap = new Map(spks.map(s => [s.spkNumber, s.toJSON()]));

    // ── Build workbook — one sheet per SPK ────────────────────────────────
    const wb = new ExcelJS.Workbook();
    wb.creator = 'KTI SmartCare';
    wb.created = new Date();

    // Periode label for header
    let periodeLabel = '';
    if (month && year) {
      const months = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
      periodeLabel = `${months[parseInt(month) - 1]} ${year}`;
    } else if (year) {
      periodeLabel = `Tahun ${year}`;
    }

    // Columns: A=Order/ActNo, B=Description/OpText, C=Interval, D=Equipment, E=Func.Loc(name), F=Lat, G=Long, H=Result Comment, I=Dur.Actual, J=Dur.Plan, K=Verifikasi
    // Col indices: 1=A ... 11=K
    const COL = { ORDER: 1, DESC: 2, INTERVAL: 3, EQUIP: 4, FUNCLOC: 5, LAT: 6, LON: 7, RESULT: 8, DUR_ACT: 9, DUR_PLAN: 10, VERIFY: 11 };
    const LAST_COL = 11;

    for (const sub of submissions) {
      const sj = sub.toJSON();
      const spk = spkMap.get(sj.spkNumber);
      if (!spk) continue; // skip non-approved

      const activityMap = new Map((spk.activitiesModel || []).map(a => [a.activityNumber, a]));
      const actResults = sj.activityResults || [];

      // Build per-equipment groups: equipmentId → { equipmentDetails, activities }
      const equipGroups = [];
      for (const em of (spk.equipmentModels || [])) {
        const ed = em.equipmentDetails || {};
        const acts = actResults.filter(ar => {
          const spkAct = activityMap.get(ar.activityNumber);
          return !spkAct?.equipmentId || spkAct.equipmentId === em.equipmentId;
        });
        const funcLocName = ed.funcLoc?.description || ed.plantName || ed.functionalLocation || '';
        // Resolve task list name: match interval mapping to SPK's intervalPeriod
        const matchedMapping = (ed.intervalMappings || []).find(m => m.interval === spk.intervalPeriod)
          || (ed.intervalMappings || [])[0];
        const taskListName = matchedMapping?.taskList?.taskListName || ed.equipmentName || em.equipmentId;
        equipGroups.push({ id: em.equipmentId, name: ed.equipmentName || em.equipmentId, taskListName, funcLocName, lat: ed.latitude ?? '', lon: ed.longitude ?? '', acts });
      }
      // Fallback: if no equipment groups, put all activities in one group
      if (!equipGroups.length) {
        equipGroups.push({ id: '-', name: '-', taskListName: '-', funcLocName: '-', lat: '', lon: '', acts: actResults });
      }

      // Sheet name: SPK number (max 31 chars, no special chars)
      const sheetName = sj.spkNumber.replace(/[\/\\?*[\]]/g, '-').slice(0, 31);
      const ws = wb.addWorksheet(sheetName, { pageSetup: { paperSize: 9, orientation: 'landscape', fitToPage: true, fitToWidth: 1 } });

      // Column widths
      ws.columns = [
        { width: 18 }, // A: Order/Activity
        { width: 34 }, // B: Description/OpText
        { width: 10 }, // C: Interval
        { width: 22 }, // D: Equipment
        { width: 22 }, // E: Func.Loc (name)
        { width: 12 }, // F: Latitude
        { width: 12 }, // G: Longitude
        { width: 30 }, // H: Result Comment
        { width: 14 }, // I: Dur Actual
        { width: 12 }, // J: Dur Plan
        { width: 10 }, // K: Verifikasi
      ];

      let row = 1;

      // ── Row 1: Title + Periode ────────────────────────────────────────────
      ws.mergeCells(row, 1, row, 7);
      const titleCell = ws.getCell(row, 1);
      titleCell.value = 'LEMBAR KERJA PREVENTIVE MAINTENANCE';
      titleCell.font = { bold: true, size: 13 };
      titleCell.alignment = { horizontal: 'center', vertical: 'middle' };

      ws.mergeCells(row, 8, row, LAST_COL);
      const periodeCell = ws.getCell(row, 8);
      periodeCell.value = periodeLabel ? `Periode : ${periodeLabel}` : '';
      periodeCell.font = { size: 10 };
      periodeCell.alignment = { horizontal: 'right', vertical: 'middle' };
      ws.getRow(row).height = 22;
      row++;

      // ── Row 2: SPK number + Lembar info ──────────────────────────────────
      ws.mergeCells(row, 1, row, 7);
      const spkCell = ws.getCell(row, 1);
      spkCell.value = `No. SPK: ${sj.spkNumber}  |  Kategori: ${spk.category}  |  Submit: ${fmtDate(sj.submittedAt)}`;
      spkCell.font = { size: 9, color: { argb: 'FF555555' } };
      spkCell.alignment = { horizontal: 'left', vertical: 'middle' };


      row++;

      // ── Row 3: Column headers ─────────────────────────────────────────────
      const headerFill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1B3A5C' } };
      const headerFont = { bold: true, color: { argb: 'FFFFFFFF' }, size: 10 };
      const headers = ['Order / No. Aktivitas', 'Deskripsi / Uraian Pekerjaan', 'Interval', 'Equipment', 'Lokasi', 'Latitude', 'Longitude', 'Result Comment', 'Durasi Aktual (mnt)', 'Durasi Rencana (mnt)', 'Verifikasi'];
      for (let c = 1; c <= LAST_COL; c++) {
        const cell = ws.getCell(row, c);
        cell.value = headers[c - 1];
        cell.font = headerFont;
        cell.fill = headerFill;
        cell.border = BORDER_THIN;
        cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
      }
      ws.getRow(row).height = 32;
      row++;

      // ── Equipment groups + activities ─────────────────────────────────────
      for (const grp of equipGroups) {
        // Equipment header row — Order = SPK number, Description = equipment name
        const equipOrderCell = ws.getCell(row, COL.ORDER);
        equipOrderCell.value = sj.spkNumber;
        equipOrderCell.font = { bold: true, size: 10 };
        equipOrderCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE8EEF7' } };
        equipOrderCell.alignment = { vertical: 'middle' };

        const equipDescCell = ws.getCell(row, COL.DESC);
        equipDescCell.value = grp.taskListName;
        equipDescCell.font = { bold: true, size: 10 };
        equipDescCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE8EEF7' } };
        equipDescCell.alignment = { vertical: 'middle' };

        // Fill remaining cols of equipment row
        for (let c = COL.INTERVAL; c <= LAST_COL; c++) {
          ws.getCell(row, c).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE8EEF7' } };
        }
        borderRange(ws, row, row, 1, LAST_COL, BORDER_THIN);
        ws.getRow(row).height = 18;
        row++;

        // Activity rows
        for (const ar of grp.acts) {
          const spkAct = activityMap.get(ar.activityNumber);
          const rowData = [
            ar.activityNumber,
            spkAct?.operationText || '-',
            spk.intervalPeriod || '-',
            grp.name,
            grp.funcLocName,
            grp.lat,
            grp.lon,
            ar.resultComment || '',
            sj.durationActual ?? '-',
            spkAct?.durationPlan ?? '-',
            ar.isNormal ? '✓' : '✗',
          ];
          for (let c = 1; c <= LAST_COL; c++) {
            const cell = ws.getCell(row, c);
            cell.value = rowData[c - 1];
            cell.font = { size: 10 };
            cell.border = BORDER_THIN;
            cell.alignment = { vertical: 'middle', wrapText: c === COL.DESC || c === COL.RESULT };
            if (c === COL.LAT || c === COL.LON) {
              cell.numFmt = '0.0000000';
              cell.alignment = { horizontal: 'right', vertical: 'middle' };
            }
            if (c === COL.VERIFY) {
              cell.font = { size: 12, bold: true, color: { argb: ar.isNormal ? 'FF16A34A' : 'FFDC2626' } };
              cell.alignment = { horizontal: 'center', vertical: 'middle' };
            }
          }
          ws.getRow(row).height = 18;
          row++;
        }

        // Empty row if no activities
        if (!grp.acts.length) {
          for (let c = 1; c <= LAST_COL; c++) ws.getCell(row, c).border = BORDER_THIN;
          ws.getRow(row).height = 16;
          row++;
        }
      }

      row++; // spacer

      // ── Signature section ─────────────────────────────────────────────────
      // Label row
      ws.mergeCells(row, 1, row, 2);
      ws.getCell(row, 1).value = `Tanggal: ${fmtDate(sj.submittedAt)}`;
      ws.getCell(row, 1).font = { size: 10 };

      ws.mergeCells(row, 3, row, 4);
      ws.getCell(row, 3).value = `Tanggal: ${fmtDate(spk.kasieApprovedAt)}`;
      ws.getCell(row, 3).font = { size: 10 };

      ws.mergeCells(row, 5, row, 6);
      ws.getCell(row, 5).value = `Tanggal: ${fmtDate(spk.kadisPerawatanApprovedAt)}`;
      ws.getCell(row, 5).font = { size: 10 };

      ws.mergeCells(row, 7, row, LAST_COL);
      ws.getCell(row, 7).value = `Tanggal: ${fmtDate(spk.kadisApprovedAt)}`;
      ws.getCell(row, 7).font = { size: 10 };
      ws.getRow(row).height = 16;
      row++;

      // Role label row
      const sigFill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF0F4FA' } };
      const sigFont = { bold: true, size: 10 };

      ws.mergeCells(row, 1, row, 2);
      ws.getCell(row, 1).value = 'Dilaksanakan';
      ws.getCell(row, 1).font = sigFont;
      ws.getCell(row, 1).fill = sigFill;
      ws.getCell(row, 1).alignment = { horizontal: 'center' };
      borderRange(ws, row, row, 1, 2, BORDER_THIN);

      ws.mergeCells(row, 3, row, 4);
      ws.getCell(row, 3).value = 'Mengetahui (Kasie)';
      ws.getCell(row, 3).font = sigFont;
      ws.getCell(row, 3).fill = sigFill;
      ws.getCell(row, 3).alignment = { horizontal: 'center' };
      borderRange(ws, row, row, 3, 4, BORDER_THIN);

      ws.mergeCells(row, 5, row, 6);
      ws.getCell(row, 5).value = 'Disetujui (Kadis Perawatan)';
      ws.getCell(row, 5).font = sigFont;
      ws.getCell(row, 5).fill = sigFill;
      ws.getCell(row, 5).alignment = { horizontal: 'center' };
      borderRange(ws, row, row, 5, 6, BORDER_THIN);

      ws.mergeCells(row, 7, row, LAST_COL);
      ws.getCell(row, 7).value = 'Dievaluasi (Kadis)';
      ws.getCell(row, 7).font = sigFont;
      ws.getCell(row, 7).fill = sigFill;
      ws.getCell(row, 7).alignment = { horizontal: 'center' };
      borderRange(ws, row, row, 7, LAST_COL, BORDER_THIN);
      ws.getRow(row).height = 18;
      row++;

      // Signature space rows
      for (let i = 0; i < 1; i++) {
        borderRange(ws, row, row, 1, 2, BORDER_THIN);
        borderRange(ws, row, row, 3, 4, BORDER_THIN);
        borderRange(ws, row, row, 5, 6, BORDER_THIN);
        borderRange(ws, row, row, 7, LAST_COL, BORDER_THIN);
        ws.getRow(row).height = 18;
        row++;
      }

      // Name / ID row
      ws.mergeCells(row, 1, row, 2);
      ws.getCell(row, 1).value = spk.submittedBy || '-';
      ws.getCell(row, 1).font = { size: 10 };
      ws.getCell(row, 1).alignment = { horizontal: 'center' };
      borderRange(ws, row, row, 1, 2, BORDER_THIN);

      ws.mergeCells(row, 3, row, 4);
      ws.getCell(row, 3).value = spk.kasieApprovedBy || '-';
      ws.getCell(row, 3).font = { size: 10 };
      ws.getCell(row, 3).alignment = { horizontal: 'center' };
      borderRange(ws, row, row, 3, 4, BORDER_THIN);

      ws.mergeCells(row, 5, row, 6);
      ws.getCell(row, 5).value = spk.kadisPerawatanApprovedBy || '-';
      ws.getCell(row, 5).font = { size: 10 };
      ws.getCell(row, 5).alignment = { horizontal: 'center' };
      borderRange(ws, row, row, 5, 6, BORDER_THIN);

      ws.mergeCells(row, 7, row, LAST_COL);
      ws.getCell(row, 7).value = spk.kadisApprovedBy || '-';
      ws.getCell(row, 7).font = { size: 10 };
      ws.getCell(row, 7).alignment = { horizontal: 'center' };
      borderRange(ws, row, row, 7, LAST_COL, BORDER_THIN);
      ws.getRow(row).height = 16;
    }

    // ── Build filename ─────────────────────────────────────────────────────
    const parts = ['LK_Preventive'];
    if (category) parts.push(category);
    if (month && year) parts.push(`${year}-${String(month).padStart(2, '0')}`);
    else if (year) parts.push(year);
    const filename = parts.join('_') + '.xlsx';

    // ── Stream response ────────────────────────────────────────────────────
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    await wb.xlsx.write(res);
    res.end();

  } catch (err) {
    console.error('[export]', err);
    if (!res.headersSent) res.status(500).json({ error: 'Gagal membuat file export' });
  }
};

module.exports = { getAll, getOne, bulkDelete, remove, exportExcel };
