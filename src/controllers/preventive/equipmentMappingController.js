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
  if (!equipmentId || !interval || !taskListId) {
    return res.status(400).json({ error: 'equipmentId, interval, dan taskListId wajib diisi' });
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
  if (!Array.isArray(equipmentIds) || !equipmentIds.length || !interval || !taskListId) {
    return res.status(400).json({ error: 'equipmentIds[], interval, dan taskListId wajib diisi' });
  }

  let created = 0;
  const skipped = [];

  for (const equipmentId of equipmentIds) {
    const existing = await EquipmentIntervalMapping.findOne({ where: { equipmentId, interval } });
    if (existing) {
      skipped.push(equipmentId);
      continue;
    }
    await EquipmentIntervalMapping.create({ equipmentId, interval, taskListId });
    created++;
  }

  res.status(201).json({
    message: `${created} mapping dibuat, ${skipped.length} dilewati (sudah ada).`,
    created,
    skipped,
  });
};

module.exports = { getAll, create, remove, bulkCreate };
