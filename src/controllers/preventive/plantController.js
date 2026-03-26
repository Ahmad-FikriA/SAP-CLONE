'use strict';

const { Op } = require('sequelize');
const Plant = require('../../models/Plant');

// GET /api/plants  ?search=cidanau
const getAll = async (req, res) => {
  const where = {};
  if (req.query.search) {
    where[Op.or] = [
      { plantId:   { [Op.like]: `%${req.query.search}%` } },
      { plantName: { [Op.like]: `%${req.query.search}%` } },
    ];
  }
  const rows = await Plant.findAll({ where, order: [['plantId', 'ASC']] });
  res.json(rows);
};

// GET /api/plants/:plantId
const getOne = async (req, res) => {
  const plant = await Plant.findByPk(req.params.plantId);
  if (!plant) return res.status(404).json({ error: 'Plant not found' });
  res.json(plant);
};

// POST /api/plants  body: { plantId, plantName, shortName?, city?, centerLat?, centerLon?, zoom? }
const create = async (req, res) => {
  const { plantId, plantName } = req.body;
  if (!plantId || !plantName)
    return res.status(400).json({ error: 'plantId and plantName are required' });
  const exists = await Plant.findByPk(plantId);
  if (exists) return res.status(409).json({ error: 'plantId already exists' });
  const plant = await Plant.create(req.body);
  res.status(201).json(plant);
};

// PUT /api/plants/:plantId
const update = async (req, res) => {
  const plant = await Plant.findByPk(req.params.plantId);
  if (!plant) return res.status(404).json({ error: 'Plant not found' });
  await plant.update({ ...req.body, plantId: plant.plantId });
  res.json(plant);
};

// DELETE /api/plants/:plantId
const remove = async (req, res) => {
  const count = await Plant.destroy({ where: { plantId: req.params.plantId } });
  if (!count) return res.status(404).json({ error: 'Plant not found' });
  res.json({ message: 'Deleted' });
};

module.exports = { getAll, getOne, create, update, remove };
