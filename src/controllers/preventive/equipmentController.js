'use strict';

const { readJSON, writeJSON } = require('../../services/fileStore');

// GET /api/equipment
const getAll = (req, res) => {
  let data = readJSON('equipment.json');
  const { category } = req.query;
  if (category) {
    data = data.filter(e => e.category === category);
  }
  res.json(data);
};

// POST /api/equipment
const create = (req, res) => {
  const data = readJSON('equipment.json');
  const newEq = { ...req.body };

  if (!newEq.equipmentId || !newEq.equipmentName) {
    return res.status(400).json({ error: 'equipmentId and equipmentName are required' });
  }
  if (data.find(e => e.equipmentId === newEq.equipmentId)) {
    return res.status(409).json({ error: 'equipmentId already exists' });
  }

  data.push(newEq);
  writeJSON('equipment.json', data);
  res.status(201).json(newEq);
};

// PUT /api/equipment/:equipmentId
const update = (req, res) => {
  const data = readJSON('equipment.json');
  const idx = data.findIndex(e => e.equipmentId === req.params.equipmentId);
  if (idx === -1) return res.status(404).json({ error: 'Equipment not found' });

  data[idx] = { ...data[idx], ...req.body, equipmentId: data[idx].equipmentId };
  writeJSON('equipment.json', data);
  res.json(data[idx]);
};

// POST /api/equipment/bulk-delete
const bulkDelete = (req, res) => {
  const { ids } = req.body;
  if (!Array.isArray(ids) || !ids.length) {
    return res.status(400).json({ error: 'ids array required' });
  }
  let data = readJSON('equipment.json');
  const before = data.length;
  data = data.filter(e => !ids.includes(e.equipmentId));
  writeJSON('equipment.json', data);
  res.json({ message: `Deleted ${before - data.length} equipment(s)` });
};

// DELETE /api/equipment/:equipmentId
const remove = (req, res) => {
  let data = readJSON('equipment.json');
  const before = data.length;
  data = data.filter(e => e.equipmentId !== req.params.equipmentId);
  if (data.length === before) return res.status(404).json({ error: 'Equipment not found' });
  writeJSON('equipment.json', data);
  res.json({ message: 'Deleted' });
};

module.exports = { getAll, create, update, bulkDelete, remove };
