'use strict';

const { Op } = require('sequelize');
const { Submission, SubmissionPhoto, SubmissionActivityResult } = require('../../models/Submission');

const INCLUDE_FULL = [
  { model: SubmissionPhoto,           as: 'photos',          attributes: ['photoPath'] },
  { model: SubmissionActivityResult,  as: 'activityResults', attributes: ['activityNumber','resultComment','isNormal','isVerified'] },
];

function fmt(sub) {
  const j = sub.toJSON();
  return {
    id:                   j.id,
    spkNumber:            j.spkNumber,
    durationActual:       j.durationActual,
    evaluasi:             j.evaluasi,
    latitude:             j.latitude,
    longitude:            j.longitude,
    submittedAt:          j.submittedAt,
    photoPaths:           (j.photos || []).map(p => p.photoPath),
    activityResultsModel: j.activityResults || [],
  };
}

// GET /api/submissions
const getAll = async (req, res) => {
  const data = await Submission.findAll({ include: INCLUDE_FULL, order: [['submittedAt','DESC']] });
  res.json(data.map(fmt));
};

// GET /api/submissions/:id
const getOne = async (req, res) => {
  const sub = await Submission.findByPk(req.params.id, { include: INCLUDE_FULL });
  if (!sub) return res.status(404).json({ error: 'Submission not found' });
  res.json(fmt(sub));
};

// POST /api/submissions/bulk-delete
const bulkDelete = async (req, res) => {
  const { ids } = req.body;
  if (!Array.isArray(ids) || !ids.length) {
    return res.status(400).json({ error: 'ids array required' });
  }
  const count = await Submission.destroy({ where: { id: { [Op.in]: ids } } });
  res.json({ message: `Deleted ${count} submission(s)` });
};

// DELETE /api/submissions/:id
const remove = async (req, res) => {
  const count = await Submission.destroy({ where: { id: req.params.id } });
  if (!count) return res.status(404).json({ error: 'Submission not found' });
  res.json({ message: 'Deleted' });
};

module.exports = { getAll, getOne, bulkDelete, remove };
