'use strict';

const express = require('express');
const { readJSON, writeJSON } = require('../services/fileStore');
const { verifyToken } = require('../middleware/auth');

const router = express.Router();

// GET /api/users — list all users (password excluded from response)
router.get('/', verifyToken, (req, res) => {
  const data = readJSON('users.json');
  const roleFilter = req.query.role;
  const users = roleFilter ? data.filter(u => u.role === roleFilter) : data;
  res.json(users.map(({ password, ...u }) => u));
});

// POST /api/users — create
router.post('/', verifyToken, (req, res) => {
  const data = readJSON('users.json');
  const user = { ...req.body };
  if (!user.id || !user.username) return res.status(400).json({ error: 'id and username are required' });
  if (data.find(u => u.username === user.username)) return res.status(409).json({ error: 'Username already exists' });
  user.password = user.password || 'password123';
  data.push(user);
  writeJSON('users.json', data);
  const { password, ...safe } = user;
  res.status(201).json(safe);
});

// PUT /api/users/:id — update (including password reset)
router.put('/:id', verifyToken, (req, res) => {
  const data = readJSON('users.json');
  const idx = data.findIndex(u => u.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'User not found' });
  data[idx] = { ...data[idx], ...req.body, id: data[idx].id };
  writeJSON('users.json', data);
  const { password, ...safe } = data[idx];
  res.json(safe);
});

module.exports = router;
