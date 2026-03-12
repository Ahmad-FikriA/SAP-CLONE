'use strict';

const { Op } = require('sequelize');
const { v4: uuid } = require('uuid');
const sequelize = require('../../config/database');
const { Spk, SpkEquipment, SpkActivity } = require('../../models/Spk');
const { Submission, SubmissionPhoto, SubmissionActivityResult } = require('../../models/Submission');
const Equipment = require('../../models/Equipment');
const { GeneralTaskList, GeneralTaskListActivity } = require('../../models/GeneralTaskList');
const { LembarKerja, LembarKerjaSpk } = require('../../models/LembarKerja');

// ── Eager-load config ─────────────────────────────────────────────────────────
const INCLUDE_FULL = [
  {
    model: SpkEquipment, as: 'equipmentModels',
    attributes: ['equipmentId', 'equipmentName', 'functionalLocation'],
    include: [{ model: Equipment, as: 'equipmentDetails', attributes: ['latitude', 'longitude'] }],
  },
  {
    model: SpkActivity, as: 'activitiesModel',
    attributes: ['activityNumber', 'equipmentId', 'operationText', 'resultComment', 'durationPlan', 'durationActual', 'isVerified'],
  },
  {
    model: LembarKerjaSpk, as: 'lkLinks',
    attributes: ['lkNumber'],   // FK needed for the nested LembarKerja join
    include: [{ model: LembarKerja, as: 'lk', attributes: ['periodeEnd'] }],
  },
];

function fmt(spk) {
  const j = spk.toJSON();
  const lkEnds = (j.lkLinks || [])
    .map(link => link.lk?.periodeEnd)
    .filter(Boolean)
    .map(d => new Date(d));
  const dueDate = lkEnds.length > 0
    ? new Date(Math.min(...lkEnds))
    : null;
  return {
    spkNumber: j.spkNumber,
    description: j.description,
    interval: j.intervalPeriod,
    category: j.category,
    status: j.status,
    durationActual: j.durationActual,
    dueDate: dueDate ? dueDate.toISOString() : null,
    equipmentModels: (j.equipmentModels || []).map(em => ({
      equipmentId: em.equipmentId,
      equipmentName: em.equipmentName,
      functionalLocation: em.functionalLocation,
      latitude: em.equipmentDetails?.latitude ?? null,
      longitude: em.equipmentDetails?.longitude ?? null,
    })),
    activitiesModel: j.activitiesModel || [],
  };
}

const VALID_CATEGORIES = ['Mekanik', 'Listrik', 'Sipil', 'Otomasi'];

// GET /api/spk
const getAll = async (req, res) => {
  if (req.query.category && !VALID_CATEGORIES.includes(req.query.category)) {
    return res.status(400).json({ error: `Invalid category. Must be one of: ${VALID_CATEGORIES.join(', ')}` });
  }
  const where = req.query.category ? { category: req.query.category } : {};

  // If equipmentId is given, replace the SpkEquipment include with a filtered one
  // (INNER JOIN — only SPKs that have this equipment)
  let include = INCLUDE_FULL;
  if (req.query.equipmentId) {
    include = [
      {
        model: SpkEquipment, as: 'equipmentModels',
        where: { equipmentId: req.query.equipmentId },
        required: true,
        attributes: ['equipmentId', 'equipmentName', 'functionalLocation'],
        include: [{ model: Equipment, as: 'equipmentDetails', attributes: ['latitude', 'longitude'] }],
      },
      ...INCLUDE_FULL.slice(1), // keep SpkActivity + LembarKerjaSpk includes unchanged
    ];
  }

  const data = await Spk.findAll({ where, include });
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

/**
 * POST /api/spk/generate-from-task-list
 *
 * Body:
 *   spkNumber       - e.g. "SPK-2026-014"
 *   description     - e.g. "Perawatan Pompa PS III - Bulanan"
 *   interval        - e.g. "1 Bulan"
 *   taskListId      - e.g. "KTI_0001" (a general task list to use as template)
 *   equipmentIds    - e.g. ["2210000012", "2210000015"] (SAP equipment IDs)
 *
 * What it does:
 *   1. Looks up the task list and its activities
 *   2. Looks up each equipment by ID
 *   3. Creates the SPK with the task list's category
 *   4. Links all selected equipment
 *   5. For each equipment × each task list activity → creates an SpkActivity
 */
const generateFromTaskList = async (req, res) => {
  const { spkNumber, description, interval, taskListId, equipmentIds = [] } = req.body;

  if (!spkNumber || !taskListId || !equipmentIds.length) {
    return res.status(400).json({ error: 'spkNumber, taskListId, and equipmentIds[] are required' });
  }

  // 1. Fetch the task list template
  const taskList = await GeneralTaskList.findByPk(taskListId, {
    include: [{ model: GeneralTaskListActivity, as: 'activities', order: [['stepNumber', 'ASC']] }],
  });
  if (!taskList) return res.status(404).json({ error: `Task list ${taskListId} not found` });

  // 2. Fetch equipment records
  const equipmentRecords = await Equipment.findAll({ where: { equipmentId: { [Op.in]: equipmentIds } } });
  if (!equipmentRecords.length) return res.status(404).json({ error: 'No valid equipment found' });

  // 3. Check if SPK already exists
  const exists = await Spk.findByPk(spkNumber);
  if (exists) return res.status(409).json({ error: 'spkNumber already exists' });

  const t = await sequelize.transaction();
  try {
    // 4. Create SPK header
    await Spk.create({
      spkNumber,
      description: description || `${taskList.taskListName}`,
      intervalPeriod: interval || null,
      category: taskList.category,
      status: 'pending',
    }, { transaction: t });

    // 5. Link equipment
    for (const eq of equipmentRecords) {
      await SpkEquipment.create({
        spkNumber,
        equipmentId: eq.equipmentId,
        equipmentName: eq.equipmentName,
        functionalLocation: eq.functionalLocation || null,
      }, { transaction: t });
    }

    // 6. Generate activities: for each equipment × each task list step
    let actNum = 1;
    for (const eq of equipmentRecords) {
      for (const step of (taskList.activities || [])) {
        await SpkActivity.create({
          spkNumber,
          activityNumber: `ACT-${String(actNum++).padStart(3, '0')}`,
          equipmentId: eq.equipmentId,
          operationText: step.operationText,
          durationPlan: 0.5,    // default plan duration
        }, { transaction: t });
      }
    }

    await t.commit();

    const fresh = await Spk.findByPk(spkNumber, { include: INCLUDE_FULL });
    res.status(201).json(fmt(fresh));
  } catch (err) { await t.rollback(); throw err; }
};

module.exports = { getAll, getOne, create, update, bulkDelete, remove, submit, sync, generateFromTaskList };
