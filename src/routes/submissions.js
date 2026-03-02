'use strict';

const express = require('express');
const { readJSON } = require('../services/fileStore');
const { verifyToken } = require('../middleware/auth');

const router = express.Router();

// GET /api/submissions — list all submissions
router.get('/', verifyToken, (req, res) => {
  const data = readJSON('submissions.json');
  res.json(data);
});

// GET /api/submissions/:id — single submission
router.get('/:id', verifyToken, (req, res) => {
  const data = readJSON('submissions.json');
  const sub = data.find(s => s.id === req.params.id);
  if (!sub) return res.status(404).json({ error: 'Submission not found' });
  res.json(sub);
});

module.exports = router;
