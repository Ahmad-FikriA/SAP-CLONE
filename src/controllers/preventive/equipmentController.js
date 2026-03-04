'use strict';

const { Op } = require('sequelize');
const Equipment = require('../../models/Equipment');

// GET /api/equipment
const getAll = async (req, res) => {
  const where = req.query.category ? { category: req.query.category } : {};
  const data = await Equipment.findAll({ where });
  res.json(data);
};

// POST /api/equipment
const create = async (req, res) => {
  const { equipmentId, equipmentName } = req.body;
  if (!equipmentId || !equipmentName) {
    return res.status(400).json({ error: 'equipmentId and equipmentName are required' });
  }
  const exists = await Equipment.findByPk(equipmentId);
  if (exists) return res.status(409).json({ error: 'equipmentId already exists' });

  const eq = await Equipment.create(req.body);
  res.status(201).json(eq);
};

// PUT /api/equipment/:equipmentId
const update = async (req, res) => {
  const eq = await Equipment.findByPk(req.params.equipmentId);
  if (!eq) return res.status(404).json({ error: 'Equipment not found' });
  await eq.update({ ...req.body, equipmentId: eq.equipmentId });
  res.json(eq);
};

// POST /api/equipment/bulk-delete
const bulkDelete = async (req, res) => {
  const { ids } = req.body;
  if (!Array.isArray(ids) || !ids.length) {
    return res.status(400).json({ error: 'ids array required' });
  }
  const count = await Equipment.destroy({ where: { equipmentId: { [Op.in]: ids } } });
  res.json({ message: `Deleted ${count} equipment(s)` });
};

// DELETE /api/equipment/:equipmentId
const remove = async (req, res) => {
  const count = await Equipment.destroy({ where: { equipmentId: req.params.equipmentId } });
  if (!count) return res.status(404).json({ error: 'Equipment not found' });
  res.json({ message: 'Deleted' });
};

module.exports = { getAll, create, update, bulkDelete, remove };
