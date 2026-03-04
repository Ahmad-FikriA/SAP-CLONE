'use strict';

const { readJSON, writeJSON } = require('../../services/fileStore');

// GET /api/submissions
const getAll = (req, res) => {
  const data = readJSON('submissions.json');
  res.json(data);
};

// GET /api/submissions/:id
const getOne = (req, res) => {
  const data = readJSON('submissions.json');
  const sub = data.find(s => s.id === req.params.id);
  if (!sub) return res.status(404).json({ error: 'Submission not found' });
  res.json(sub);
};

// POST /api/submissions/bulk-delete
const bulkDelete = (req, res) => {
  const { ids } = req.body;
  if (!Array.isArray(ids) || !ids.length) {
    return res.status(400).json({ error: 'ids array required' });
  }
  let data = readJSON('submissions.json');
  const before = data.length;
  data = data.filter(s => !ids.includes(s.id));
  writeJSON('submissions.json', data);
  res.json({ message: `Deleted ${before - data.length} submission(s)` });
};

// DELETE /api/submissions/:id
const remove = (req, res) => {
  let data = readJSON('submissions.json');
  const before = data.length;
  data = data.filter(s => s.id !== req.params.id);
  if (data.length === before) return res.status(404).json({ error: 'Submission not found' });
  writeJSON('submissions.json', data);
  res.json({ message: 'Deleted' });
};

module.exports = { getAll, getOne, bulkDelete, remove };
