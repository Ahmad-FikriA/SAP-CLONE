'use strict';

const { Op } = require('sequelize');
const sequelize = require('../../config/database');
const User = require('../../models/User');
const { Spk } = require('../../models/Spk');

const SAFE = { attributes: { exclude: ['password'] } };

// GET /api/users
const getAll = async (req, res) => {
  try {
    const where = {};
    if (req.query.role) where.role = req.query.role;
    if (req.query.dinas) where.dinas = req.query.dinas;
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

// GET /api/users/stats
const getStats = async (req, res) => {
  try {
    const users = await User.findAll({
      attributes: ['id', 'name', 'role', 'group', 'dinas'],
      order: [['name', 'ASC']],
    });

    const spkCounts = await Spk.findAll({
      where: { submittedBy: { [Op.not]: null } },
      attributes: [
        'submittedBy',
        'status',
        [sequelize.fn('COUNT', sequelize.col('spk_number')), 'count'],
      ],
      group: ['submitted_by', 'status'],
      raw: true,
    });

    const latestSubs = await Spk.findAll({
      where: { submittedBy: { [Op.not]: null }, submittedAt: { [Op.not]: null } },
      attributes: [
        'submittedBy',
        [sequelize.fn('MAX', sequelize.col('submitted_at')), 'lastSubmittedAt'],
      ],
      group: ['submitted_by'],
      raw: true,
    });

    const statsMap = {};
    for (const row of spkCounts) {
      if (!statsMap[row.submittedBy]) statsMap[row.submittedBy] = { total: 0, approved: 0 };
      statsMap[row.submittedBy].total += parseInt(row.count);
      if (row.status === 'approved') statsMap[row.submittedBy].approved += parseInt(row.count);
    }
    const lastSubMap = Object.fromEntries(latestSubs.map(r => [r.submittedBy, r.lastSubmittedAt]));

    res.json(users.map(u => ({
      id: u.id,
      name: u.name,
      role: u.role,
      group: u.group,
      dinas: u.dinas,
      totalSpk: statsMap[u.id]?.total || 0,
      approvedSpk: statsMap[u.id]?.approved || 0,
      lastSubmittedAt: lastSubMap[u.id] || null,
    })));
  } catch (err) {
    console.error('[Users] getStats error:', err.message);
    res.status(500).json({ error: 'Gagal mengambil statistik users' });
  }
};

module.exports = { getAll, create, update, bulkDelete, remove, getStats };

