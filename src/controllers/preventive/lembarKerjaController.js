'use strict';

const { readJSON, writeJSON } = require('../../services/fileStore');

// Helper: resolve spkModels (array of spkNumber strings) to full SPK objects
function resolveSpkModels(lk) {
  const allSpk = readJSON('spk.json');
  return {
    ...lk,
    spkModels: (lk.spkModels || []).map(ref => {
      const found = allSpk.find(s => s.spkNumber === ref);
      return found || ref;
    }),
  };
}

const _PENDING_STATES = ['awaiting_kasie', 'awaiting_ap', 'awaiting_kadis_pusat', 'awaiting_kadis_keamanan'];

// GET /api/lk
const getAll = (req, res) => {
  let data = readJSON('lembar_kerja.json');
  const { category } = req.query;
  if (category) {
    data = data.filter(lk => lk.category === category);
  }
  res.json(data.map(resolveSpkModels));
};

// GET /api/lk/:lkNumber
const getOne = (req, res) => {
  const data = readJSON('lembar_kerja.json');
  const lk = data.find(l => l.lkNumber === req.params.lkNumber);
  if (!lk) return res.status(404).json({ error: 'LembarKerja not found' });
  res.json(resolveSpkModels(lk));
};

// POST /api/lk
const create = (req, res) => {
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
};

// PUT /api/lk/:lkNumber
const update = (req, res) => {
  const data = readJSON('lembar_kerja.json');
  const idx = data.findIndex(l => l.lkNumber === req.params.lkNumber);
  if (idx === -1) return res.status(404).json({ error: 'LembarKerja not found' });

  data[idx] = { ...data[idx], ...req.body, lkNumber: data[idx].lkNumber };
  writeJSON('lembar_kerja.json', data);
  res.json(resolveSpkModels(data[idx]));
};

// POST /api/lk/bulk-delete
const bulkDelete = (req, res) => {
  const { ids } = req.body;
  if (!Array.isArray(ids) || !ids.length) {
    return res.status(400).json({ error: 'ids array required' });
  }
  let data = readJSON('lembar_kerja.json');
  const before = data.length;
  data = data.filter(l => !ids.includes(l.lkNumber));
  writeJSON('lembar_kerja.json', data);
  res.json({ message: `Deleted ${before - data.length} LK(s)` });
};

// DELETE /api/lk/:lkNumber
const remove = (req, res) => {
  let data = readJSON('lembar_kerja.json');
  const before = data.length;
  data = data.filter(l => l.lkNumber !== req.params.lkNumber);
  if (data.length === before) return res.status(404).json({ error: 'LembarKerja not found' });
  writeJSON('lembar_kerja.json', data);
  res.json({ message: 'Deleted' });
};

// POST /api/lk/:lkNumber/submit
const submit = (req, res) => {
  const data = readJSON('lembar_kerja.json');
  const idx = data.findIndex(l => l.lkNumber === req.params.lkNumber);
  if (idx === -1) return res.status(404).json({ error: 'LembarKerja not found' });

  const { evaluasi } = req.body;
  data[idx].status = 'completed';
  data[idx].approvalStatus = 'awaiting_kasie';
  if (evaluasi !== undefined) data[idx].evaluasi = evaluasi;
  writeJSON('lembar_kerja.json', data);

  res.json({ message: 'Lembar kerja submitted', lkNumber: req.params.lkNumber });
};

// POST /api/lk/:lkNumber/approve
const approve = (req, res) => {
  const { role, userId } = req.user;

  if (role !== 'supervisor' && role !== 'manager') {
    return res.status(403).json({ error: 'Forbidden: only supervisor or manager can approve' });
  }

  const data = readJSON('lembar_kerja.json');
  const idx = data.findIndex(l => l.lkNumber === req.params.lkNumber);
  if (idx === -1) return res.status(404).json({ error: 'LembarKerja not found' });

  const lk = data[idx];

  if (lk.approvalStatus === 'approved' || lk.approvalStatus === 'rejected') {
    return res.status(400).json({ error: `LK is already ${lk.approvalStatus}` });
  }

  if (role === 'supervisor') {
    if (lk.approvalStatus !== 'awaiting_kasie') {
      return res.status(400).json({ error: 'LK is not awaiting Kasie Elektrik approval' });
    }
    lk.approvalStatus = 'awaiting_ap';
    lk.kasieApprovedBy = userId;
    lk.kasieApprovedAt = new Date().toISOString();
  } else if (role === 'manager') {
    if (lk.approvalStatus === 'awaiting_ap') {
      lk.approvalStatus = 'awaiting_kadis_pusat';
      lk.apApprovedBy = userId;
      lk.apApprovedAt = new Date().toISOString();
    } else if (lk.approvalStatus === 'awaiting_kadis_pusat') {
      lk.approvalStatus = 'awaiting_kadis_keamanan';
      lk.kadisPusatApprovedBy = userId;
      lk.kadisPusatApprovedAt = new Date().toISOString();
    } else if (lk.approvalStatus === 'awaiting_kadis_keamanan') {
      lk.approvalStatus = 'approved';
      lk.kadisKeamananApprovedBy = userId;
      lk.kadisKeamananApprovedAt = new Date().toISOString();
    } else {
      return res.status(400).json({ error: 'LK is not awaiting manager approval' });
    }
  }

  writeJSON('lembar_kerja.json', data);
  res.json(resolveSpkModels(lk));
};

// POST /api/lk/:lkNumber/reject
const reject = (req, res) => {
  const { role, userId } = req.user;

  if (role !== 'supervisor' && role !== 'manager') {
    return res.status(403).json({ error: 'Forbidden: only supervisor or manager can reject' });
  }

  const data = readJSON('lembar_kerja.json');
  const idx = data.findIndex(l => l.lkNumber === req.params.lkNumber);
  if (idx === -1) return res.status(404).json({ error: 'LembarKerja not found' });

  const lk = data[idx];

  if (!_PENDING_STATES.includes(lk.approvalStatus)) {
    return res.status(400).json({ error: 'LK is not in a rejectable state' });
  }

  lk.approvalStatus = 'rejected';
  lk.rejectedBy = userId;
  lk.rejectedAt = new Date().toISOString();
  lk.rejectionNotes = req.body.notes || null;

  writeJSON('lembar_kerja.json', data);
  res.json(resolveSpkModels(lk));
};

module.exports = { getAll, getOne, create, update, bulkDelete, remove, submit, approve, reject };
