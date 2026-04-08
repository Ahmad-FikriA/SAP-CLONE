'use strict';

const { Op } = require('sequelize');
const User = require('../../models/User');

const SAFE = { attributes: { exclude: ['password'] } };

// GET /api/users
const getAll = async (req, res) => {
  try {
    const where = req.query.role ? { role: req.query.role } : {};
    const users = await User.findAll({ where, ...SAFE });
    res.json(users);
  } catch (err) {
    console.error('[Users] getAll error:', err.message);
    res.status(500).json({ error: 'Gagal mengambil data users' });
  }
};

// POST /api/users
const create = async (req, res) => {
  try {
    const { id, nik, password, name, role, email, dinas, divisi, group } = req.body;
    if (!id || !nik) {
      return res.status(400).json({ error: 'id and nik are required' });
    }
    const exists = await User.findOne({ where: { nik } });
    if (exists) return res.status(409).json({ error: 'NIK already exists' });

    const user = await User.create({ id, nik, password: password || 'password123', name, role, email, dinas, divisi, group });
    const { password: _, ...safe } = user.toJSON();
    res.status(201).json(safe);
  } catch (err) {
    console.error('[Users] create error:', err.message);
    res.status(500).json({ error: 'Gagal membuat user: ' + err.message });
  }
};

// PUT /api/users/:id
const update = async (req, res) => {
  try {
    const user = await User.findByPk(req.params.id);
    if (!user) return res.status(404).json({ error: 'User not found' });
    await user.update({ ...req.body, id: user.id });
    const { password: _, ...safe } = user.toJSON();
    res.json(safe);
  } catch (err) {
    console.error('[Users] update error:', err.message);
    res.status(500).json({ error: 'Gagal update user: ' + err.message });
  }
};

// POST /api/users/bulk-delete
const bulkDelete = async (req, res) => {
  try {
    const { ids } = req.body;
    if (!Array.isArray(ids) || !ids.length) {
      return res.status(400).json({ error: 'ids array required' });
    }
    const count = await User.destroy({ where: { id: { [Op.in]: ids } } });
    res.json({ message: `Deleted ${count} user(s)` });
  } catch (err) {
    console.error('[Users] bulkDelete error:', err.message);
    res.status(500).json({ error: 'Gagal menghapus users' });
  }
};

// DELETE /api/users/:id
const remove = async (req, res) => {
  try {
    const count = await User.destroy({ where: { id: req.params.id } });
    if (!count) return res.status(404).json({ error: 'User not found' });
    res.json({ message: 'Deleted' });
  } catch (err) {
    console.error('[Users] remove error:', err.message);
    res.status(500).json({ error: 'Gagal menghapus user' });
  }
};

module.exports = { getAll, create, update, bulkDelete, remove };

