'use strict';

const EquipmentIntervalMapping = require('../../models/EquipmentIntervalMapping');
const Equipment = require('../../models/Equipment');
const { GeneralTaskList, GeneralTaskListActivity } = require('../../models/GeneralTaskList');

const INCLUDE_FULL = [
  { model: Equipment, as: 'equipment', attributes: ['equipmentId', 'equipmentName'] },
  {
    model: GeneralTaskList,
    as: 'taskList',
    attributes: ['taskListId', 'taskListName'],
    include: [{ model: GeneralTaskListActivity, as: 'activities', attributes: ['stepNumber', 'operationText'] }],
  },
];

function fmt(m) {
  const j = m.toJSON();
  return {
    id: j.id,
    equipmentId: j.equipmentId,
    equipmentName: j.equipment ? j.equipment.equipmentName : null,
    interval: j.interval,
    taskListId: j.taskListId,
    taskListName: j.taskList ? j.taskList.taskListName : null,
    activities: (j.taskList && j.taskList.activities ? j.taskList.activities : [])
      .map(a => ({ stepNumber: a.stepNumber, operationText: a.operationText })),
  };
}

const getAll = async (req, res) => {
  const data = await EquipmentIntervalMapping.findAll({
    include: INCLUDE_FULL,
    order: [['equipmentId', 'ASC'], ['interval', 'ASC']],
  });
  res.json(data.map(fmt));
};

const create = async (req, res) => {
  const { equipmentId, interval, taskListId } = req.body;
  if (!equipmentId || !interval) {
    return res.status(400).json({ error: 'equipmentId dan interval wajib diisi' });
  }
  const existing = await EquipmentIntervalMapping.findOne({ where: { equipmentId, interval } });
  if (existing) {
    return res.status(409).json({ error: 'Mapping untuk equipment ' + equipmentId + ' interval ' + interval + ' sudah ada' });
  }
  const mapping = await EquipmentIntervalMapping.create({ equipmentId, interval, taskListId });
  const fresh = await EquipmentIntervalMapping.findByPk(mapping.id, { include: INCLUDE_FULL });
  res.status(201).json(fmt(fresh));
};

const remove = async (req, res) => {
  const count = await EquipmentIntervalMapping.destroy({ where: { id: req.params.id } });
  if (!count) return res.status(404).json({ error: 'Mapping not found' });
  res.json({ message: 'Deleted' });
};

// POST /api/equipment-mappings/bulk
const bulkCreate = async (req, res) => {
  const { equipmentIds, interval, taskListId } = req.body;
  if (!Array.isArray(equipmentIds) || !equipmentIds.length || !interval) {
    return res.status(400).json({ error: 'equipmentIds[] dan interval wajib diisi' });
  }

  let created = 0;
  const skipped = [];
  const errors = [];

  for (const equipmentId of equipmentIds) {
    try {
      const existing = await EquipmentIntervalMapping.findOne({ where: { equipmentId, interval } });
      if (existing) {
        skipped.push(equipmentId);
        continue;
      }
      await EquipmentIntervalMapping.create({ equipmentId, interval, taskListId });
      created++;
    } catch (err) {
      skipped.push(equipmentId);
      errors.push(`${equipmentId}: ${err.message}`);
    }
  }

  res.status(201).json({
    message: `${created} mapping dibuat, ${skipped.length} dilewati (sudah ada atau error).`,
    created,
    skipped,
    ...(errors.length && { errors }),
  });
};

// POST /api/equipment-mappings/import-excel
// Expects multipart/form-data with field "file" containing an .xlsx file.
// Excel must have a header row with columns (any order, case-insensitive):
//   equipment_id | interval | task_list_id
// Rows with missing values are skipped.
const importExcel = async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded. Send field "file" as multipart/form-data.' });

  let XLSX;
  try { XLSX = require('xlsx'); } catch { return res.status(500).json({ error: 'xlsx package not installed' }); }

  const workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json(sheet, { defval: '' });

  if (!rows.length) return res.status(400).json({ error: 'Excel sheet is empty or has no data rows' });

  // Normalise header names (case-insensitive, ignore spaces/underscores)
  function normalise(s) { return String(s || '').toLowerCase().replace(/[\s_-]/g, ''); }
  const sample = rows[0];
  const keyMap = {};
  for (const k of Object.keys(sample)) {
    const n = normalise(k);
    if (['equipmentid', 'equipment'].includes(n))   keyMap.equipmentId = k;
    if (['interval'].includes(n))                    keyMap.interval   = k;
    if (['tasklistid', 'tasklist'].includes(n))       keyMap.taskListId = k;
  }

  if (!keyMap.equipmentId || !keyMap.interval) {
    return res.status(400).json({
      error: 'Could not find required columns. Expected: equipment_id, interval (task_list_id is optional)',
      foundColumns: Object.keys(sample),
    });
  }

  const VALID_INTERVALS = ['1wk','2wk','3wk','4wk','8wk','12wk','16wk','24wk'];
  let imported = 0, skipped = 0;
  const errors = [];

  for (const row of rows) {
    const equipmentId = String(row[keyMap.equipmentId] || '').trim();
    const interval    = String(row[keyMap.interval]    || '').trim();
    const taskListId  = String(row[keyMap.taskListId]  || '').trim();

    if (!equipmentId || !interval) { skipped++; continue; }
    if (!VALID_INTERVALS.includes(interval)) {
      errors.push(`Row skipped: invalid interval "${interval}" for equipment ${equipmentId}`);
      skipped++;
      continue;
    }

    try {
      await EquipmentIntervalMapping.upsert({ equipmentId, interval, taskListId });
      imported++;
    } catch (err) {
      errors.push(`Row skipped: ${equipmentId}/${interval} — ${err.message}`);
      skipped++;
    }
  }

  res.json({
    message: `Import selesai: ${imported} baris diimpor, ${skipped} dilewati`,
    imported, skipped,
    errors: errors.slice(0, 20), // cap error list
  });
};

module.exports = { getAll, create, remove, bulkCreate, importExcel };
