'use strict';

const express = require('express');
const { readJSON, writeJSON } = require('../services/fileStore');
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

// POST /api/submissions/bulk-delete
router.post('/bulk-delete', verifyToken, (req, res) => {
  const { ids } = req.body;
  if (!Array.isArray(ids) || !ids.length) return res.status(400).json({ error: 'ids array required' });
  let data = readJSON('submissions.json');
  const before = data.length;
  data = data.filter(s => !ids.includes(s.id));
  writeJSON('submissions.json', data);
  res.json({ message: `Deleted ${before - data.length} submission(s)` });
});

// DELETE /api/submissions/:id
router.delete('/:id', verifyToken, (req, res) => {
  let data = readJSON('submissions.json');
  const before = data.length;
  data = data.filter(s => s.id !== req.params.id);
  if (data.length === before) return res.status(404).json({ error: 'Submission not found' });
  writeJSON('submissions.json', data);
  res.json({ message: 'Deleted' });
});

module.exports = router;
