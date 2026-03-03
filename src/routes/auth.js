'use strict';

const express = require('express');
const jwt = require('jsonwebtoken');
const { readJSON } = require('../services/fileStore');

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || 'kti-mock-secret-dev';

// POST /api/auth/login
router.post('/login', (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: 'username and password required' });
  }

  const users = readJSON('users.json');
  const user = users.find(u => u.username === username && u.password === password);

  if (!user) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  const payload = {
    userId: user.id,
    username: user.username,
    role: user.role
  };

  const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '24h' });

  res.json({
    token,
    user: {
      id: user.id,
      name: user.name,
      username: user.username,
      role: user.role,
      email: user.email
    }
  });
});

module.exports = router;
