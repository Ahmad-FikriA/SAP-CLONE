'use strict';

const { Op }        = require('sequelize');
const { v4: uuid }  = require('uuid');
const sequelize     = require('../../config/database');
const { Spk, SpkEquipment, SpkActivity } = require('../../models/Spk');
const { Submission, SubmissionPhoto, SubmissionActivityResult } = require('../../models/Submission');

// ── Eager-load config ─────────────────────────────────────────────────────────
const INCLUDE_FULL = [
  { model: SpkEquipment, as: 'equipmentModels', attributes: ['equipmentId','equipmentName','functionalLocation'] },
  { model: SpkActivity,  as: 'activitiesModel', attributes: ['activityNumber','equipmentId','operationText','resultComment','durationPlan','durationActual','isVerified'] },
];

function fmt(spk) {
  const j = spk.toJSON();
  return {
    spkNumber:       j.spkNumber,
    description:     j.description,
    interval:        j.intervalPeriod,
    category:        j.category,
    status:          j.status,
    durationActual:  j.durationActual,
    equipmentModels: j.equipmentModels || [],
    activitiesModel: j.activitiesModel || [],
  };
}

// GET /api/spk
const getAll = async (req, res) => {
  const where = req.query.category ? { category: req.query.category } : {};
  const data  = await Spk.findAll({ where, include: INCLUDE_FULL });
  res.json(data.map(fmt));
};

// GET /api/spk/:spkNumber
const getOne = async (req, res) => {
  const spk = await Spk.findByPk(req.params.spkNumber, { include: INCLUDE_FULL });
  if (!spk) return res.status(404).json({ error: 'SPK not found' });
  res.json(fmt(spk));
};

// POST /api/spk
const create = async (req, res) => {
  const { spkNumber, description, interval, category, status, durationActual, equipmentModels = [], activitiesModel = [] } = req.body;
  if (!spkNumber) return res.status(400).json({ error: 'spkNumber is required' });

  const exists = await Spk.findByPk(spkNumber);
  if (exists) return res.status(409).json({ error: 'spkNumber already exists' });

  const t = await sequelize.transaction();
  try {
    const spk = await Spk.create({ spkNumber, description, intervalPeriod: interval, category, status: status || 'pending', durationActual: durationActual ?? null }, { transaction: t });
    for (const eq of equipmentModels) await SpkEquipment.create({ ...eq, spkNumber }, { transaction: t });
    for (const act of activitiesModel) await SpkActivity.create({ ...act, spkNumber }, { transaction: t });
    await t.commit();
    const fresh = await Spk.findByPk(spkNumber, { include: INCLUDE_FULL });
    res.status(201).json(fmt(fresh));
  } catch (err) { await t.rollback(); throw err; }
};

// PUT /api/spk/:spkNumber
const update = async (req, res) => {
  const spk = await Spk.findByPk(req.params.spkNumber);
  if (!spk) return res.status(404).json({ error: 'SPK not found' });
  const { interval, equipmentModels, activitiesModel, ...rest } = req.body;
  await spk.update({ ...rest, intervalPeriod: interval ?? spk.intervalPeriod, spkNumber: spk.spkNumber });
  const fresh = await Spk.findByPk(spk.spkNumber, { include: INCLUDE_FULL });
  res.json(fmt(fresh));
};

// POST /api/spk/bulk-delete
const bulkDelete = async (req, res) => {
  const { ids } = req.body;
  if (!Array.isArray(ids) || !ids.length) return res.status(400).json({ error: 'ids array required' });
  const count = await Spk.destroy({ where: { spkNumber: { [Op.in]: ids } } });
  res.json({ message: `Deleted ${count} SPK(s)` });
};

// DELETE /api/spk/:spkNumber
const remove = async (req, res) => {
  const count = await Spk.destroy({ where: { spkNumber: req.params.spkNumber } });
  if (!count) return res.status(404).json({ error: 'SPK not found' });
  res.json({ message: 'Deleted' });
};

// POST /api/spk/:spkNumber/submit
const submit = async (req, res) => {
  const spk = await Spk.findByPk(req.params.spkNumber, { include: INCLUDE_FULL });
  if (!spk) return res.status(404).json({ error: 'SPK not found' });

  const { durationActual, activityResultsModel = [], photoPaths = [], evaluasi, latitude, longitude } = req.body;
  const subId = `SUB-${uuid().slice(0, 8).toUpperCase()}`;

  const t = await sequelize.transaction();
  try {
    // Create submission record
    const sub = await Submission.create({
      id: subId, spkNumber: spk.spkNumber, durationActual: durationActual ?? null,
      evaluasi: evaluasi || null, latitude: latitude ?? 0, longitude: longitude ?? 0,
      submittedAt: new Date(),
    }, { transaction: t });

    // Photos
    for (const p of photoPaths) await SubmissionPhoto.create({ submissionId: subId, photoPath: p }, { transaction: t });

    // Activity results
    for (const r of activityResultsModel) {
      await SubmissionActivityResult.create({
        submissionId: subId, activityNumber: r.activityNumber,
        resultComment: r.resultComment || null, isNormal: r.isNormal ?? true, isVerified: r.isVerified ?? false,
      }, { transaction: t });

      // Update activity on the SPK row
      await SpkActivity.update(
        { resultComment: r.resultComment ?? null, isVerified: r.isVerified ?? false, durationActual: r.durationActual ?? null },
        { where: { spkNumber: spk.spkNumber, activityNumber: r.activityNumber }, transaction: t }
      );
    }

    // Mark SPK as completed
    await spk.update({ status: 'completed', durationActual: durationActual ?? spk.durationActual }, { transaction: t });

    await t.commit();
    res.json({ message: 'SPK submitted', spkNumber: spk.spkNumber, submissionId: subId });
  } catch (err) { await t.rollback(); throw err; }
};

// POST /api/spk/:spkNumber/sync
const sync = async (req, res) => {
  const spk = await Spk.findByPk(req.params.spkNumber);
  if (!spk) return res.status(404).json({ error: 'SPK not found' });
  res.json({ message: 'Synced to SAP (mock)', spkNumber: spk.spkNumber, syncedAt: new Date().toISOString() });
};

module.exports = { getAll, getOne, create, update, bulkDelete, remove, submit, sync };
