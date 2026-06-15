'use strict';

const { Op } = require('sequelize');
const ExcelJS = require('exceljs');
const { Submission, SubmissionPhoto, SubmissionActivityResult } = require('../../models/Submission');
const { Spk, SpkEquipment, SpkActivity } = require('../../models/Spk');
const Equipment = require('../../models/Equipment');
const FunctionalLocation = require('../../models/FunctionalLocation');
const EquipmentIntervalMapping = require('../../models/EquipmentIntervalMapping');
const { GeneralTaskList } = require('../../models/GeneralTaskList');
const User = require('../../models/User');

// Used for paginated getAll (Submissions Log page) — only approved SPKs
const INCLUDE_FULL = [
  { model: SubmissionPhoto, as: 'photos', attributes: ['photoPath'] },
  { model: SubmissionActivityResult, as: 'activityResults', attributes: ['activityNumber', 'resultComment', 'isNormal', 'isVerified', 'measurementValue'] },
  {
    model: Spk,
    as: 'spk',
    attributes: [
      'category', 'description', 'submittedBy', 'scheduledDate', 'intervalPeriod',
      'kasieApprovedBy', 'kasieApprovedAt',
      'kadisPerawatanApprovedBy', 'kadisPerawatanApprovedAt',
      'kadisApprovedBy', 'kadisApprovedAt',
    ],
    where: { status: 'approved' },
    include: [
      { model: SpkActivity, as: 'activitiesModel', attributes: ['activityNumber', 'operationText', 'durationPlan', 'measurementUnit'] },
      { model: SpkEquipment, as: 'equipmentModels', attributes: ['equipmentId', 'equipmentName', 'functionalLocation', 'plantName'] },
    ],
    required: true,
  },
];

// Used for spkNumber lookup (Persetujuan SPK page) — any SPK status
const INCLUDE_BY_SPK = [
  { model: SubmissionPhoto, as: 'photos', attributes: ['photoPath'] },
  { model: SubmissionActivityResult, as: 'activityResults', attributes: ['activityNumber', 'resultComment', 'isNormal', 'isVerified', 'measurementValue'] },
  {
    model: Spk,
    as: 'spk',
    attributes: [
      'category', 'description', 'submittedBy', 'scheduledDate', 'intervalPeriod',
      'kasieApprovedBy', 'kasieApprovedAt',
      'kadisPerawatanApprovedBy', 'kadisPerawatanApprovedAt',
      'kadisApprovedBy', 'kadisApprovedAt',
    ],
    include: [
      { model: SpkActivity, as: 'activitiesModel', attributes: ['activityNumber', 'operationText', 'durationPlan', 'measurementUnit'] },
      { model: SpkEquipment, as: 'equipmentModels', attributes: ['equipmentId', 'equipmentName', 'functionalLocation', 'plantName'] },
    ],
    required: false,
  },
];

function fmt(sub) {
  const j = sub.toJSON();
  const spk = j.spk || {};

  const actMap = {};
  (spk.activitiesModel || []).forEach(a => { actMap[a.activityNumber] = a; });

  return {
    id: j.id,
    spkNumber: j.spkNumber,
    spkCategory: spk.category || null,
    spkDescription: spk.description || null,
    spkSubmittedBy: spk.submittedBy || null,
    spkScheduledDate: spk.scheduledDate || null,
    spkInterval: spk.intervalPeriod || null,
    spkEquipmentModels: (spk.equipmentModels || []).map(e => ({
      equipmentId: e.equipmentId,
      equipmentName: e.equipmentName || null,
      functionalLocation: e.functionalLocation || null,
      plantName: e.plantName || null,
    })),
    spkKasieApprovedBy: spk.kasieApprovedBy || null,
    spkKasieApprovedAt: spk.kasieApprovedAt || null,
    spkKadisPerawatanApprovedBy: spk.kadisPerawatanApprovedBy || null,
    spkKadisPerawatanApprovedAt: spk.kadisPerawatanApprovedAt || null,
    spkKadisApprovedBy: spk.kadisApprovedBy || null,
    spkKadisApprovedAt: spk.kadisApprovedAt || null,
    workStart: j.workStart,
    submittedAt: j.submittedAt,
    durationActual: j.durationActual,
    evaluasi: j.evaluasi,
    lateReason: j.lateReason ?? null,
    latitude: j.latitude,
    longitude: j.longitude,
    photoPaths: (j.photos || []).map(p => p.photoPath),
    activityResultsModel: (j.activityResults || []).map(r => ({
      activityNumber: r.activityNumber,
      operationText: actMap[r.activityNumber]?.operationText || null,
      durationPlan: actMap[r.activityNumber]?.durationPlan || null,
      measurementUnit: actMap[r.activityNumber]?.measurementUnit || null,
      resultComment: r.resultComment,
      isNormal: r.isNormal,
      isVerified: r.isVerified,
      measurementValue: r.measurementValue ?? null,
    })),
  };
}

// GET /api/submissions?page=1&limit=20&year=2026&month=5&week=20&category=Mekanik
// GET /api/submissions?spkNumber=SPK-001  → plain array (backward compat)
const getAll = async (req, res) => {
  const { category, spkNumber, year, month, week, page: pageStr, limit: limitStr } = req.query;

  // Targeted lookup — skip pagination, return plain array for Persetujuan page
  if (spkNumber) {
    const data = await Submission.findAll({
      where: { spkNumber },
      include: INCLUDE_BY_SPK,
      order: [['submittedAt', 'DESC']],
    });
    return res.json(data.map(fmt));
  }

  const page = Math.max(1, parseInt(pageStr) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(limitStr) || 20));
  const offset = (page - 1) * limit;

  const where = {};

  // Category pre-filter: resolve approved SPK numbers for this category
  if (category) {
    const matchingSpks = await Spk.findAll({
      where: { category, status: 'approved' },
      attributes: ['spkNumber'],
    });
    const spkNumbers = matchingSpks.map(s => s.spkNumber);
    if (!spkNumbers.length) {
      return res.json({ data: [], total: 0, page, totalPages: 0, limit });
    }
    where.spkNumber = { [Op.in]: spkNumbers };
  }

  // Date filter on submitted_at
  const y = parseInt(year);
  const m = parseInt(month);
  const w = parseInt(week);
  if (y && w) {
    const jan4 = new Date(y, 0, 4);
    const monday = new Date(jan4);
    monday.setDate(jan4.getDate() - ((jan4.getDay() + 6) % 7) + (w - 1) * 7);
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    sunday.setHours(23, 59, 59, 999);
    where.submittedAt = { [Op.between]: [monday, sunday] };
  } else if (y && m) {
    where.submittedAt = { [Op.between]: [new Date(y, m - 1, 1), new Date(y, m, 0, 23, 59, 59, 999)] };
  } else if (y) {
    where.submittedAt = { [Op.between]: [new Date(y, 0, 1), new Date(y, 11, 31, 23, 59, 59, 999)] };
  }

  const { count, rows } = await Submission.findAndCountAll({
    where,
    include: INCLUDE_FULL,
    order: [['submittedAt', 'DESC']],
    limit,
    offset,
    distinct: true,
  });

  const totalPages = Math.ceil(count / limit);
  res.json({ data: rows.map(fmt), total: count, page, totalPages, limit });
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

function fmtTime(ts) {
  if (!ts) return '-';
  return new Date(ts).toLocaleTimeString('id-ID', { timeZone: 'Asia/Jakarta', hour: '2-digit', minute: '2-digit' });
}

// SAP expects HH:MM:SS with colon separators
function fmtTimeSAP(ts) {
  if (!ts) return '';
  const d = new Date(ts);
  const pad = (n) => String(n).padStart(2, '0');
  const hours = pad(d.toLocaleString('en-US', { timeZone: 'Asia/Jakarta', hour: 'numeric', hour12: false }).replace('24', '00'));
  const minutes = pad(d.toLocaleString('en-US', { timeZone: 'Asia/Jakarta', minute: 'numeric' }));
  return `${hours}:${minutes}:00`;
}

// SAP expects dates as DD.MM.YYYY with dot separators (not the slashes id-ID uses)
function fmtDateSAP(ts) {
  if (!ts) return '';
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Jakarta', day: '2-digit', month: '2-digit', year: 'numeric',
  }).formatToParts(new Date(ts));
  const get = (t) => parts.find(p => p.type === t)?.value;
  return `${get('day')}.${get('month')}.${get('year')}`;
}

// Shared border style
const BORDER_THIN = {
  top: { style: 'thin' },
  left: { style: 'thin' },
  bottom: { style: 'thin' },
  right: { style: 'thin' },
};


// Apply border to a range of cells
function borderRange(ws, startRow, endRow, startCol, endCol, border = BORDER_THIN) {
  for (let r = startRow; r <= endRow; r++) {
    for (let c = startCol; c <= endCol; c++) {
      ws.getCell(r, c).border = border;
    }
  }
}



// GET /api/submissions/export-iw49 — flat SAP IW49 confirmation table
// Query params: same as exportExcel (from, to, month, year, week, category)
const exportIW49 = async (req, res) => {
  try {
    const { from, to, month, year, week, category } = req.query;

    // ── Compute shared ISO date range ──────────────────────────────────────
    let isoFrom = null;
    let isoTo = null;
    if (from || to) {
      isoFrom = from || null;
      isoTo = to || null;
    } else if (week) {
      const y = parseInt(year) || new Date().getFullYear();
      const w = parseInt(week);
      const jan4 = new Date(y, 0, 4);
      const monday = new Date(jan4);
      monday.setDate(jan4.getDate() - ((jan4.getDay() + 6) % 7) + (w - 1) * 7);
      const sunday = new Date(monday);
      sunday.setDate(monday.getDate() + 6);
      isoFrom = monday.toISOString().slice(0, 10);
      isoTo = sunday.toISOString().slice(0, 10);
    } else if (month || year) {
      const y = parseInt(year) || new Date().getFullYear();
      if (month) {
        const m = parseInt(month);
        const first = new Date(y, m - 1, 1);
        const last = new Date(y, m, 0);
        isoFrom = first.toISOString().slice(0, 10);
        isoTo = last.toISOString().slice(0, 10);
      } else {
        isoFrom = `${y}-01-01`;
        isoTo = `${y}-12-31`;
      }
    }

    // ── Submission date filter ─────────────────────────────────────────────
    const subWhere = {};
    if (isoFrom || isoTo) {
      subWhere.submittedAt = {};
      if (isoFrom) { const d = new Date(isoFrom); subWhere.submittedAt[Op.gte] = d; }
      if (isoTo) { const d = new Date(isoTo); d.setHours(23, 59, 59, 999); subWhere.submittedAt[Op.lte] = d; }
    }

    // ── Historical SPK filter (scheduledDate, source=manual_import) ───────
    const histWhere = { source: 'manual_import', status: 'approved' };
    if (category) histWhere.category = category;
    if (isoFrom) histWhere.scheduledDate = { ...(histWhere.scheduledDate || {}), [Op.gte]: isoFrom };
    if (isoTo) histWhere.scheduledDate = { ...(histWhere.scheduledDate || {}), [Op.lte]: isoTo };

    // ── Fetch both sources in parallel ─────────────────────────────────────
    const [submissions, historicalSpks] = await Promise.all([
      Submission.findAll({
        where: subWhere,
        include: [{
          model: SubmissionActivityResult, as: 'activityResults',
          attributes: ['activityNumber', 'resultComment'],
        }],
        order: [['submittedAt', 'ASC']],
      }),
      Spk.findAll({
        where: histWhere,
        attributes: ['spkNumber', 'description', 'systemStatus', 'costCenter', 'operWorkCtr', 'scheduledDate', 'evaluasi'],
        include: [{
          model: SpkActivity, as: 'activitiesModel',
          attributes: ['activityNumber', 'controlKey', 'operationText', 'durationPlan', 'confirmation'],
        }],
        order: [['scheduledDate', 'ASC']],
      }),
    ]);

    if (!submissions.length && !historicalSpks.length) {
      return res.status(404).json({ error: 'Tidak ada data untuk filter yang dipilih' });
    }

    // ── Fetch approved SPKs for submissions ───────────────────────────────
    const spkMap = new Map();
    if (submissions.length) {
      const spkNumbers = [...new Set(submissions.map(s => s.spkNumber))];
      const approvedSpks = await Spk.findAll({
        where: { spkNumber: spkNumbers, status: 'approved', ...(category ? { category } : {}) },
        attributes: ['spkNumber', 'description', 'systemStatus', 'costCenter', 'operWorkCtr'],
        include: [{
          model: SpkActivity, as: 'activitiesModel',
          attributes: ['activityNumber', 'controlKey', 'operationText', 'durationPlan', 'confirmation'],
        }],
      });
      for (const s of approvedSpks) {
        const j = s.toJSON();
        const actMap = new Map((j.activitiesModel || []).map(a => [a.activityNumber, a]));
        spkMap.set(j.spkNumber, { description: j.description, systemStatus: j.systemStatus, costCenter: j.costCenter, operWorkCtr: j.operWorkCtr, actMap });
      }
    }

    // ── Build workbook ─────────────────────────────────────────────────────
    const wb = new ExcelJS.Workbook();
    wb.creator = 'KTI SmartCare';
    wb.created = new Date();

    const ws = wb.addWorksheet('IW49 Confirmation');
    ws.columns = [
      { width: 20 }, // A:  Order
      { width: 28 }, // B:  Description
      { width: 22 }, // C:  System Status
      { width: 14 }, // D:  Cost Center
      { width: 14 }, // E:  Control Key
      { width: 16 }, // F:  Confirmation
      { width: 16 }, // G:  Oper Work Ctr
      { width: 12 }, // H:  Activity
      { width: 32 }, // I:  Op. Short Text
      { width: 18 }, // J:  Normal Duration
      { width: 20 }, // K:  Norm. Duration Unit
      { width: 16 }, // L:  Duration Plan
      { width: 16 }, // M:  Unit for Work
      { width: 16 }, // N:  Posting Date
      { width: 18 }, // O:  Duration Actual (hr)
      { width: 16 }, // P:  Actual Work (hr)
      { width: 36 }, // Q:  Confirmation Text
      { width: 30 }, // R:  Reason of Variance
      { width: 16 }, // S:  Work Start
      { width: 16 }, // T:  Work Finish
      { width: 14 }, // U:  Start Time
      { width: 14 }, // V:  Finish Time
    ];

    const IW49_HEADERS = [
      'Order', 'Description', 'System Status', 'Cost Center', 'Control Key', 'Confirmation',
      'Oper Work Ctr', 'Activity', 'Op. Short Text',
      'Normal Duration', 'Norm. Duration Unit', 'Duration Plan', 'Unit for Work',
      'Duration Actual (hr)', 'Actual Work (hr)', 'Posting Date',
      'Confirmation Text', 'Reason of Variance',
      'Work Start', 'Work Finish', 'Start Time', 'Finish Time',
    ];

    const headerFill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFC107' } };
    const headerFont = { bold: true, color: { argb: 'FF000000' }, size: 10 };
    const headerRow = ws.getRow(1);
    IW49_HEADERS.forEach((h, i) => {
      const cell = headerRow.getCell(i + 1);
      cell.value = h;
      cell.font = headerFont;
      cell.fill = headerFill;
      cell.border = BORDER_THIN;
      cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
    });
    headerRow.height = 32;

    let dataRow = 2;
    for (const sub of submissions) {
      const sj = sub.toJSON();
      const spk = spkMap.get(sj.spkNumber);
      if (!spk) continue; // skip non-approved

      // durationActual stored in minutes → convert to hours (2 dp)
      const durationActualHr = sj.durationActual != null
        ? Math.round((sj.durationActual / 60) * 100) / 100
        : null;

      const postingDate = fmtDateSAP(sj.submittedAt);
      const workStartDate = fmtDateSAP(sj.workStart);
      const workFinishDate = fmtDateSAP(sj.submittedAt);
      const startTime = fmtTimeSAP(sj.workStart);
      const finishTime = fmtTimeSAP(sj.submittedAt);

      const activities = sj.activityResults || [];

      // One row per activity result; fallback to a single row if none recorded
      const rows = activities.length ? activities : [{ activityNumber: '', resultComment: '' }];

      for (const ar of rows) {
        const spkAct = spk.actMap.get(ar.activityNumber);

        // durationPlan stored in minutes → convert to hours (2 dp)
        const durationPlanHr = spkAct?.durationPlan != null
          ? Math.round((spkAct.durationPlan / 60) * 100) / 100
          : null;

        const vals = [
          sj.spkNumber,                        // Order
          spk.description || '',               // Description
          spk.systemStatus || '',              // System Status
          spk.costCenter || '',                // Cost Center
          spkAct?.controlKey || '',            // Control Key (per-activity from SAP)
          spkAct?.confirmation || '',          // Confirmation
          spk.operWorkCtr || '',               // Oper Work Ctr
          ar.activityNumber || '',             // Activity
          spkAct?.operationText || '',         // Op. Short Text
          durationPlanHr,             // Normal Duration (hr)
          'HR',                       // Norm. Duration Unit
          durationPlanHr,             // Duration Plan (hr) — same, 1-person baseline
          'HR',                       // Unit for Work
          postingDate,                // Posting Date
          durationActualHr,           // Duration Actual (hr)
          durationActualHr,           // Actual Work (hr)
          ar.resultComment || '',     // Confirmation Text
          '',                         // Reason of Variance
          workStartDate,              // Work Start
          workFinishDate,             // Work Finish
          startTime,                  // Start Time
          finishTime,                 // Finish Time
        ];

        const wsRow = ws.getRow(dataRow);
        vals.forEach((v, i) => {
          const cell = wsRow.getCell(i + 1);
          cell.value = v ?? '';
          cell.font = { size: 10 };
          cell.border = BORDER_THIN;
          cell.alignment = { vertical: 'middle' };
        });
        wsRow.height = 16;
        dataRow++;
      }
    }

    // ── Historical manual_import rows (light-blue background) ────────────
    for (const spk of historicalSpks) {
      const sj = spk.toJSON();
      const activities = sj.activitiesModel || [];
      const postingDate = fmtDateSAP(sj.scheduledDate);
      const rows = activities.length
        ? activities
        : [{ activityNumber: '', controlKey: '', operationText: '', durationPlan: null }];

      for (const act of rows) {
        const durationPlanHr = act.durationPlan != null
          ? Math.round((act.durationPlan / 60) * 100) / 100
          : null;

        const vals = [
          sj.spkNumber,
          sj.description || '',
          sj.systemStatus || '',
          sj.costCenter || '',
          act.controlKey || '',
          act.confirmation || '',  // Confirmation
          sj.operWorkCtr || '',
          act.activityNumber || '',
          act.operationText || '',
          durationPlanHr,
          durationPlanHr != null ? 'HR' : '',
          durationPlanHr,
          durationPlanHr != null ? 'HR' : '',
          postingDate,
          null,
          null,
          sj.evaluasi || 'Dikerjakan secara manual sebelum sistem MANTIS',
          '',
          postingDate,
          postingDate,
          '',
          '',
        ];

        const wsRow = ws.getRow(dataRow);
        vals.forEach((v, i) => {
          const cell = wsRow.getCell(i + 1);
          cell.value = v ?? '';
          cell.font = { size: 10 };
          cell.border = BORDER_THIN;
          cell.alignment = { vertical: 'middle' };
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE0F2FE' } };
        });
        wsRow.height = 16;
        dataRow++;
      }
    }

    if (dataRow === 2) {
      return res.status(404).json({ error: 'Tidak ada data SPK yang disetujui untuk filter yang dipilih' });
    }

    // ── Filename ───────────────────────────────────────────────────────────
    const parts = ['IW49_Confirmation'];
    if (category) parts.push(category);
    if (week && year) parts.push(`${year}-W${String(week).padStart(2, '0')}`);
    else if (month && year) parts.push(`${year}-${String(month).padStart(2, '0')}`);
    else if (year) parts.push(year);
    const filename = parts.join('_') + '.xlsx';

    const buffer = await wb.xlsx.writeBuffer();
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Length', buffer.length);
    res.send(buffer);

  } catch (err) {
    console.error('[export-iw49]', err);
    if (!res.headersSent) res.status(500).json({ error: 'Gagal membuat file export IW49' });
  }
};

module.exports = { getAll, getOne, bulkDelete, remove, exportIW49 };
