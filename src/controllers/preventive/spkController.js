'use strict';

const { v4: uuidv4 } = require('uuid');
const { readJSON, writeJSON } = require('../../services/fileStore');

// GET /api/spk
const getAll = (req, res) => {
  let data = readJSON('spk.json');
  const { category } = req.query;
  if (category) {
    data = data.filter(s => s.category === category);
  }
  res.json(data);
};

// GET /api/spk/:spkNumber
const getOne = (req, res) => {
  const data = readJSON('spk.json');
  const spk = data.find(s => s.spkNumber === req.params.spkNumber);
  if (!spk) return res.status(404).json({ error: 'SPK not found' });
  res.json(spk);
};

// POST /api/spk
const create = (req, res) => {
  const data = readJSON('spk.json');
  const newSpk = { ...req.body };

  if (!newSpk.spkNumber) {
    return res.status(400).json({ error: 'spkNumber is required' });
  }
  if (data.find(s => s.spkNumber === newSpk.spkNumber)) {
    return res.status(409).json({ error: 'spkNumber already exists' });
  }

  newSpk.status = newSpk.status || 'pending';
  newSpk.durationActual = newSpk.durationActual ?? null;
  newSpk.equipmentModels = newSpk.equipmentModels || [];
  newSpk.activitiesModel = newSpk.activitiesModel || [];

  data.push(newSpk);
  writeJSON('spk.json', data);
  res.status(201).json(newSpk);
};

// PUT /api/spk/:spkNumber
const update = (req, res) => {
  const data = readJSON('spk.json');
  const idx = data.findIndex(s => s.spkNumber === req.params.spkNumber);
  if (idx === -1) return res.status(404).json({ error: 'SPK not found' });

  data[idx] = { ...data[idx], ...req.body, spkNumber: data[idx].spkNumber };
  writeJSON('spk.json', data);
  res.json(data[idx]);
};

// POST /api/spk/bulk-delete
const bulkDelete = (req, res) => {
  const { ids } = req.body;
  if (!Array.isArray(ids) || !ids.length) {
    return res.status(400).json({ error: 'ids array required' });
  }
  let data = readJSON('spk.json');
  const before = data.length;
  data = data.filter(s => !ids.includes(s.spkNumber));
  writeJSON('spk.json', data);
  res.json({ message: `Deleted ${before - data.length} SPK(s)` });
};

// DELETE /api/spk/:spkNumber
const remove = (req, res) => {
  let data = readJSON('spk.json');
  const before = data.length;
  data = data.filter(s => s.spkNumber !== req.params.spkNumber);
  if (data.length === before) return res.status(404).json({ error: 'SPK not found' });
  writeJSON('spk.json', data);
  res.json({ message: 'Deleted' });
};

// POST /api/spk/:spkNumber/submit
const submit = (req, res) => {
  const spkData = readJSON('spk.json');
  const spkIdx = spkData.findIndex(s => s.spkNumber === req.params.spkNumber);
  if (spkIdx === -1) return res.status(404).json({ error: 'SPK not found' });

  const submission = {
    id: `SUB-${uuidv4().slice(0, 8).toUpperCase()}`,
    spkNumber: req.params.spkNumber,
    submittedAt: new Date().toISOString(),
    ...req.body,
  };

  const submissions = readJSON('submissions.json');
  submissions.push(submission);
  writeJSON('submissions.json', submissions);

  spkData[spkIdx].status = 'completed';
  if (submission.durationActual !== undefined) {
    spkData[spkIdx].durationActual = submission.durationActual;
  }
  if (Array.isArray(submission.activityResultsModel)) {
    spkData[spkIdx].activitiesModel = spkData[spkIdx].activitiesModel.map(act => {
      const result = submission.activityResultsModel.find(
        r => r.activityNumber === act.activityNumber
      );
      if (result) {
        return {
          ...act,
          resultComment: result.resultComment ?? act.resultComment,
          isVerified: result.isVerified ?? act.isVerified,
          durationActual: result.durationActual ?? act.durationActual,
        };
      }
      return act;
    });
  }
  writeJSON('spk.json', spkData);

  res.json({ message: 'SPK submitted', spkNumber: req.params.spkNumber });
};

// POST /api/spk/:spkNumber/sync
const sync = (req, res) => {
  const spkData = readJSON('spk.json');
  const spk = spkData.find(s => s.spkNumber === req.params.spkNumber);
  if (!spk) return res.status(404).json({ error: 'SPK not found' });

  res.json({
    message: 'Synced to SAP (mock)',
    spkNumber: req.params.spkNumber,
    syncedAt: new Date().toISOString(),
  });
};

module.exports = { getAll, getOne, create, update, bulkDelete, remove, submit, sync };
