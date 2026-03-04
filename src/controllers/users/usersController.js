'use strict';

const { readJSON, writeJSON } = require('../../services/fileStore');

// GET /api/users
const getAll = (req, res) => {
  const data = readJSON('users.json');
  const roleFilter = req.query.role;
  const users = roleFilter ? data.filter(u => u.role === roleFilter) : data;
  res.json(users.map(({ password, ...u }) => u));
};

// POST /api/users
const create = (req, res) => {
  const data = readJSON('users.json');
  const user = { ...req.body };
  if (!user.id || !user.username) {
    return res.status(400).json({ error: 'id and username are required' });
  }
  if (data.find(u => u.username === user.username)) {
    return res.status(409).json({ error: 'Username already exists' });
  }
  user.password = user.password || 'password123';
  data.push(user);
  writeJSON('users.json', data);
  const { password, ...safe } = user;
  res.status(201).json(safe);
};

// PUT /api/users/:id
const update = (req, res) => {
  const data = readJSON('users.json');
  const idx = data.findIndex(u => u.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'User not found' });
  data[idx] = { ...data[idx], ...req.body, id: data[idx].id };
  writeJSON('users.json', data);
  const { password, ...safe } = data[idx];
  res.json(safe);
};

// POST /api/users/bulk-delete
const bulkDelete = (req, res) => {
  const { ids } = req.body;
  if (!Array.isArray(ids) || !ids.length) {
    return res.status(400).json({ error: 'ids array required' });
  }
  let data = readJSON('users.json');
  const before = data.length;
  data = data.filter(u => !ids.includes(u.id));
  writeJSON('users.json', data);
  res.json({ message: `Deleted ${before - data.length} user(s)` });
};

// DELETE /api/users/:id
const remove = (req, res) => {
  let data = readJSON('users.json');
  const before = data.length;
  data = data.filter(u => u.id !== req.params.id);
  if (data.length === before) return res.status(404).json({ error: 'User not found' });
  writeJSON('users.json', data);
  res.json({ message: 'Deleted' });
};

module.exports = { getAll, create, update, bulkDelete, remove };
