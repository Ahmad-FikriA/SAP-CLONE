'use strict';

const { Op } = require('sequelize');
const XLSX = require('xlsx');
const { Submission, SubmissionPhoto, SubmissionActivityResult } = require('../../models/Submission');
const { Spk, SpkEquipment, SpkActivity } = require('../../models/Spk');
const Equipment = require('../../models/Equipment');

const INCLUDE_FULL = [
  { model: SubmissionPhoto,           as: 'photos',          attributes: ['photoPath'] },
  { model: SubmissionActivityResult,  as: 'activityResults', attributes: ['activityNumber','resultComment','isNormal','isVerified'] },
];

function fmt(sub) {
  const j = sub.toJSON();
  return {
    id:                   j.id,
    spkNumber:            j.spkNumber,
    durationActual:       j.durationActual,
    evaluasi:             j.evaluasi,
    latitude:             j.latitude,
    longitude:            j.longitude,
    submittedAt:          j.submittedAt,
    photoPaths:           (j.photos || []).map(p => p.photoPath),
    activityResultsModel: j.activityResults || [],
  };
}

// GET /api/submissions
const getAll = async (req, res) => {
  const data = await Submission.findAll({ include: INCLUDE_FULL, order: [['submittedAt','DESC']] });
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

// GET /api/submissions/export  — download as .xlsx
// Query params: from (ISO date), to (ISO date), month (1-12), year, category
const exportExcel = async (req, res) => {
  try {
    // ── Build date range filter ────────────────────────────────────────────
    const where = {};
    const { from, to, month, year, category } = req.query;

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
        const start = new Date(y, m - 1, 1);
        const end   = new Date(y, m, 0, 23, 59, 59, 999);
        where.submittedAt = { [Op.between]: [start, end] };
      } else {
        const start = new Date(y, 0, 1);
        const end   = new Date(y, 11, 31, 23, 59, 59, 999);
        where.submittedAt = { [Op.between]: [start, end] };
      }
    }

    // ── Fetch submissions (only fully approved SPKs) ──────────────────────
    const submissions = await Submission.findAll({
      where,
      include: [
        { model: SubmissionActivityResult, as: 'activityResults',
          attributes: ['activityNumber','resultComment','isNormal','isVerified'] },
      ],
      order: [['submittedAt', 'ASC']],
    });

    if (!submissions.length) {
      return res.status(404).json({ error: 'Tidak ada data untuk filter yang dipilih' });
    }

    // ── Fetch SPK + equipment + activities for all spkNumbers ─────────────
    const spkNumbers = [...new Set(submissions.map(s => s.spkNumber))];
    // Only export submissions whose SPK is fully approved
    const spks = await Spk.findAll({
      where: { spkNumber: spkNumbers, status: 'approved', ...(category ? { category } : {}) },
      include: [
        {
          model: SpkEquipment,
          as: 'equipmentModels',
          attributes: ['equipmentId'],
          include: [
            {
              model: Equipment,
              as: 'equipmentDetails',
              attributes: ['equipmentId', 'equipmentName', 'plantName', 'functionalLocation'],
            },
          ],
        },
        {
          model: SpkActivity,
          as: 'activitiesModel',
          attributes: ['activityNumber', 'operationText', 'durationPlan'],
        },
      ],
      attributes: [
        'spkNumber', 'category', 'intervalPeriod', 'status',
        'kasieApprovedBy', 'kasieApprovedAt',
        'kadisPerawatanApprovedBy', 'kadisPerawatanApprovedAt',
        'kadisApprovedBy', 'kadisApprovedAt',
      ],
    });

    // Build lookup maps
    const spkMap = new Map(spks.map(s => [s.spkNumber, s.toJSON()]));

    // ── Build rows (one per activity result) ──────────────────────────────
    const rows = [];
    for (const sub of submissions) {
      const sj = sub.toJSON();
      const spk = spkMap.get(sj.spkNumber);

      // Skip if category filter applied and this SPK was excluded
      if (category && !spk) continue;

      const equipList   = spk ? (spk.equipmentModels || []) : [];
      const activityMap = new Map((spk ? spk.activitiesModel : []).map(a => [a.activityNumber, a]));

      const firstEquip = equipList[0]?.equipmentDetails || {};
      const equipIds   = equipList.map(e => e.equipmentId).join(', ');
      const equipNames = equipList.map(e => e.equipmentDetails?.equipmentName || e.equipmentId).join(', ');

      const fmtTs = (ts) => ts
        ? new Date(ts).toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' })
        : '-';

      const submittedAtLocal = fmtTs(sj.submittedAt);

      const actResults = sj.activityResults || [];

      const approvalCols = {
        'Disetujui Kasie':           spk?.kasieApprovedBy || '-',
        'Tgl Persetujuan Kasie':     fmtTs(spk?.kasieApprovedAt),
        'Disetujui Kadis Perawatan': spk?.kadisPerawatanApprovedBy || '-',
        'Tgl Persetujuan Kadis Prw': fmtTs(spk?.kadisPerawatanApprovedAt),
        'Disetujui Kadis':           spk?.kadisApprovedBy || '-',
        'Tgl Persetujuan Kadis':     fmtTs(spk?.kadisApprovedAt),
      };

      if (!actResults.length) {
        rows.push({
          'No. SPK':             sj.spkNumber,
          'Tanggal Submit':      submittedAtLocal,
          'Equipment ID':        equipIds || '-',
          'Nama Equipment':      equipNames || '-',
          'Plant':               firstEquip.plantName || '-',
          'Functional Location': firstEquip.functionalLocation || '-',
          'Kategori':            spk?.category || '-',
          'Interval':            spk?.intervalPeriod || '-',
          'No. Aktivitas':       '-',
          'Uraian Aktivitas':    '-',
          'Hasil Pemeriksaan':   '-',
          'Normal':              '-',
          'Durasi Rencana (menit)': '-',
          'Durasi Aktual (menit)':  sj.durationActual ?? '-',
          'Evaluasi':            sj.evaluasi || '-',
          ...approvalCols,
          'Latitude':            sj.latitude ?? '-',
          'Longitude':           sj.longitude ?? '-',
        });
        continue;
      }

      for (const ar of actResults) {
        const activity = activityMap.get(ar.activityNumber);
        rows.push({
          'No. SPK':             sj.spkNumber,
          'Tanggal Submit':      submittedAtLocal,
          'Equipment ID':        equipIds || '-',
          'Nama Equipment':      equipNames || '-',
          'Plant':               firstEquip.plantName || '-',
          'Functional Location': firstEquip.functionalLocation || '-',
          'Kategori':            spk?.category || '-',
          'Interval':            spk?.intervalPeriod || '-',
          'No. Aktivitas':       ar.activityNumber,
          'Uraian Aktivitas':    activity?.operationText || '-',
          'Hasil Pemeriksaan':   ar.resultComment || '-',
          'Normal':              ar.isNormal ? 'Ya' : 'Tidak',
          'Durasi Rencana (menit)': activity?.durationPlan ?? '-',
          'Durasi Aktual (menit)':  sj.durationActual ?? '-',
          'Evaluasi':            sj.evaluasi || '-',
          ...approvalCols,
          'Latitude':            sj.latitude ?? '-',
          'Longitude':           sj.longitude ?? '-',
        });
      }
    }

    if (!rows.length) {
      return res.status(404).json({ error: 'Tidak ada data untuk filter yang dipilih' });
    }

    // ── Build xlsx ─────────────────────────────────────────────────────────
    const ws = XLSX.utils.json_to_sheet(rows);

    // Column widths
    ws['!cols'] = [
      { wch: 18 }, // No. SPK
      { wch: 22 }, // Tanggal Submit
      { wch: 16 }, // Equipment ID
      { wch: 30 }, // Nama Equipment
      { wch: 20 }, // Plant
      { wch: 28 }, // Functional Location
      { wch: 12 }, // Kategori
      { wch: 10 }, // Interval
      { wch: 16 }, // No. Aktivitas
      { wch: 40 }, // Uraian Aktivitas
      { wch: 35 }, // Hasil Pemeriksaan
      { wch: 8  }, // Normal
      { wch: 22 }, // Durasi Rencana
      { wch: 22 }, // Durasi Aktual
      { wch: 35 }, // Evaluasi
      { wch: 20 }, // Disetujui Kasie
      { wch: 24 }, // Tgl Persetujuan Kasie
      { wch: 24 }, // Disetujui Kadis Perawatan
      { wch: 26 }, // Tgl Persetujuan Kadis Prw
      { wch: 20 }, // Disetujui Kadis
      { wch: 24 }, // Tgl Persetujuan Kadis
      { wch: 12 }, // Latitude
      { wch: 12 }, // Longitude
    ];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Submissions');

    // ── Filename ───────────────────────────────────────────────────────────
    const parts = ['submissions'];
    if (category) parts.push(category.toLowerCase());
    if (month && year) parts.push(`${year}-${String(month).padStart(2, '0')}`);
    else if (year) parts.push(year);
    else if (from) parts.push(from.slice(0, 10));
    const filename = parts.join('_') + '.xlsx';

    const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.send(buffer);
  } catch (err) {
    console.error('[export]', err);
    res.status(500).json({ error: 'Gagal membuat file export' });
  }
};

module.exports = { getAll, getOne, bulkDelete, remove, exportExcel };
