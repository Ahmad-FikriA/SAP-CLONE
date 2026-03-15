'use strict';

const { Op } = require('sequelize');
const Equipment = require('../../models/Equipment');

// GET /api/equipment
// Query: ?category=Mekanik  ?search=pompa  ?limit=50  ?offset=0  ?funcLocId=A-A1-01
const getAll = async (req, res) => {
  const where = {};
  if (req.query.category) where.category = req.query.category;
  if (req.query.plantId) where.plantId = req.query.plantId;
  if (req.query.funcLocId) where.funcLocId = { [Op.like]: `${req.query.funcLocId}%` };
  if (req.query.search) {
    where[Op.or] = [
      { equipmentId: { [Op.like]: `%${req.query.search}%` } },
      { equipmentName: { [Op.like]: `%${req.query.search}%` } },
    ];
  }

  const limit = parseInt(req.query.limit, 10) || 50;
  const offset = parseInt(req.query.offset, 10) || 0;

  const { count, rows } = await Equipment.findAndCountAll({ where, limit, offset, order: [['equipmentId', 'ASC']] });
  res.json({ total: count, limit, offset, data: rows });
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

// GET /api/equipment/:equipmentId
const getOne = async (req, res) => {
  const eq = await Equipment.findByPk(req.params.equipmentId);
  if (!eq) return res.status(404).json({ error: 'Equipment not found' });
  res.json(eq);
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

module.exports = { getAll, getOne, create, update, bulkDelete, remove };
