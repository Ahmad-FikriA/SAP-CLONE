'use strict';

const express = require('express');
const { readJSON, writeJSON } = require('../services/fileStore');
const { verifyToken } = require('../middleware/auth');

const router = express.Router();

// ── Helper: resolve spkModels (array of spkNumber strings) to full SPK objects ──
function resolveSpkModels(lk) {
  const allSpk = readJSON('spk.json');
  return {
    ...lk,
    spkModels: (lk.spkModels || []).map(ref => {
      const found = allSpk.find(s => s.spkNumber === ref);
      return found || ref;
    })
  };
}

// GET /api/lk?category=
router.get('/', verifyToken, (req, res) => {
  let data = readJSON('lembar_kerja.json');
  const { category } = req.query;
  if (category) {
    data = data.filter(lk => lk.category === category);
  }
  res.json(data.map(resolveSpkModels));
});

// GET /api/lk/:lkNumber
router.get('/:lkNumber', verifyToken, (req, res) => {
  const data = readJSON('lembar_kerja.json');
  const lk = data.find(l => l.lkNumber === req.params.lkNumber);
  if (!lk) return res.status(404).json({ error: 'LembarKerja not found' });
  res.json(resolveSpkModels(lk));
});

// POST /api/lk — create new lembar kerja
router.post('/', verifyToken, (req, res) => {
  const data = readJSON('lembar_kerja.json');
  const newLk = { ...req.body };

  if (!newLk.lkNumber) {
    return res.status(400).json({ error: 'lkNumber is required' });
  }
  if (data.find(l => l.lkNumber === newLk.lkNumber)) {
    return res.status(409).json({ error: 'lkNumber already exists' });
  }

  data.push(newLk);
  writeJSON('lembar_kerja.json', data);
  res.status(201).json(resolveSpkModels(newLk));
});

// PUT /api/lk/:lkNumber — partial update
router.put('/:lkNumber', verifyToken, (req, res) => {
  const data = readJSON('lembar_kerja.json');
  const idx = data.findIndex(l => l.lkNumber === req.params.lkNumber);
  if (idx === -1) return res.status(404).json({ error: 'LembarKerja not found' });

  data[idx] = { ...data[idx], ...req.body, lkNumber: data[idx].lkNumber };
  writeJSON('lembar_kerja.json', data);
  res.json(resolveSpkModels(data[idx]));
});

// POST /api/lk/bulk-delete
router.post('/bulk-delete', verifyToken, (req, res) => {
  const { ids } = req.body;
  if (!Array.isArray(ids) || !ids.length) return res.status(400).json({ error: 'ids array required' });
  let data = readJSON('lembar_kerja.json');
  const before = data.length;
  data = data.filter(l => !ids.includes(l.lkNumber));
  writeJSON('lembar_kerja.json', data);
  res.json({ message: `Deleted ${before - data.length} LK(s)` });
});

// DELETE /api/lk/:lkNumber
router.delete('/:lkNumber', verifyToken, (req, res) => {
  let data = readJSON('lembar_kerja.json');
  const before = data.length;
  data = data.filter(l => l.lkNumber !== req.params.lkNumber);
  if (data.length === before) return res.status(404).json({ error: 'LembarKerja not found' });
  writeJSON('lembar_kerja.json', data);
  res.json({ message: 'Deleted' });
});

// POST /api/lk/:lkNumber/submit — mark completed + save evaluasi
router.post('/:lkNumber/submit', verifyToken, (req, res) => {
  const data = readJSON('lembar_kerja.json');
  const idx = data.findIndex(l => l.lkNumber === req.params.lkNumber);
  if (idx === -1) return res.status(404).json({ error: 'LembarKerja not found' });

  const { evaluasi } = req.body;
  data[idx].status = 'completed';
  if (evaluasi !== undefined) data[idx].evaluasi = evaluasi;
  writeJSON('lembar_kerja.json', data);

  res.json({ message: 'Lembar kerja submitted', lkNumber: req.params.lkNumber });
});

module.exports = router;
