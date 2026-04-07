'use strict';

const { Op } = require('sequelize');
const User = require('../../models/User');

const SAFE = { attributes: { exclude: ['password'] } };

// GET /api/users
const getAll = async (req, res) => {
  const where = req.query.role ? { role: req.query.role } : {};
  const users = await User.findAll({ where, ...SAFE });
  res.json(users);
};

// POST /api/users
const create = async (req, res) => {
  const { id, nik, password, name, role, email, dinas, divisi } = req.body;
  if (!id || !nik) {
    return res.status(400).json({ error: 'id and nik are required' });
  }
  const exists = await User.findOne({ where: { nik } });
  if (exists) return res.status(409).json({ error: 'NIK already exists' });

  const user = await User.create({ id, nik, password: password || 'password123', name, role, email, dinas, divisi });
  const { password: _, ...safe } = user.toJSON();
  res.status(201).json(safe);
};

// PUT /api/users/:id
const update = async (req, res) => {
  const user = await User.findByPk(req.params.id);
  if (!user) return res.status(404).json({ error: 'User not found' });
  await user.update({ ...req.body, id: user.id });
  const { password: _, ...safe } = user.toJSON();
  res.json(safe);
};

// POST /api/users/bulk-delete
const bulkDelete = async (req, res) => {
  const { ids } = req.body;
  if (!Array.isArray(ids) || !ids.length) {
    return res.status(400).json({ error: 'ids array required' });
  }
  const count = await User.destroy({ where: { id: { [Op.in]: ids } } });
  res.json({ message: `Deleted ${count} user(s)` });
};

// DELETE /api/users/:id
const remove = async (req, res) => {
  const count = await User.destroy({ where: { id: req.params.id } });
  if (!count) return res.status(404).json({ error: 'User not found' });
  res.json({ message: 'Deleted' });
};

module.exports = { getAll, create, update, bulkDelete, remove };
