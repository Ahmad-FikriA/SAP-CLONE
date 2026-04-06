'use strict';

const { Op } = require('sequelize');
const { v4: uuid } = require('uuid');
const sequelize = require('../../config/database');
const { Spk, SpkEquipment, SpkActivity } = require('../../models/Spk');
const { Submission, SubmissionPhoto, SubmissionActivityResult } = require('../../models/Submission');
const Equipment = require('../../models/Equipment');
const { GeneralTaskList, GeneralTaskListActivity } = require('../../models/GeneralTaskList');
const { LembarKerjaSpk } = require('../../models/LembarKerja'); // kept for destroySpksByNumbers cleanup

/**
 * Delete all child records for the given spkNumbers inside an existing transaction,
 * then delete the SPK rows themselves.
 * Order: LembarKerjaSpk → Submission (children cascade) → SpkActivity → SpkEquipment → Spk
 */
async function destroySpksByNumbers(spkNumbers, transaction) {
  const where = { spkNumber: { [Op.in]: spkNumbers } };

  // 1. lembar_kerja_spk — no DB cascade from spk side
  await LembarKerjaSpk.destroy({ where, transaction });

  // 2. Submissions — find IDs first so child tables cascade via Sequelize
  const submissions = await Submission.findAll({ attributes: ['id'], where, transaction });
  if (submissions.length) {
    const subIds = submissions.map(s => s.id);
    await SubmissionPhoto.destroy({ where: { submissionId: { [Op.in]: subIds } }, transaction });
    await SubmissionActivityResult.destroy({ where: { submissionId: { [Op.in]: subIds } }, transaction });
    await Submission.destroy({ where: { id: { [Op.in]: subIds } }, transaction });
  }

  // 3. SPK children with existing CASCADE (belt-and-suspenders)
  await SpkActivity.destroy({ where, transaction });
  await SpkEquipment.destroy({ where, transaction });

  // 4. Delete the SPK itself
  return Spk.destroy({ where, transaction });
}

// ── Eager-load config ─────────────────────────────────────────────────────────
const INCLUDE_FULL = [
  {
    model: SpkEquipment, as: 'equipmentModels',
    attributes: ['equipmentId', 'equipmentName', 'functionalLocation'],
    include: [{ model: Equipment, as: 'equipmentDetails', attributes: ['latitude', 'longitude', 'plantName'] }],
  },
  {
    model: SpkActivity, as: 'activitiesModel',
    attributes: ['activityNumber', 'equipmentId', 'operationText', 'resultComment', 'durationPlan', 'durationActual', 'isVerified'],
  },
];

function fmt(spk) {
  const j = spk.toJSON();
  return {
    spkNumber: j.spkNumber,
    description: j.description,
    interval: j.intervalPeriod,
    category: j.category,
    status: j.status,
    durationActual: j.durationActual,
    scheduledDate: j.scheduledDate ?? null,
    dueDate: j.scheduledDate ? new Date(j.scheduledDate).toISOString() : null,
    orderNumber: j.orderNumber ?? null,
    evaluasi: j.evaluasi ?? null,
    submittedBy: j.submittedBy ?? null,
    submittedAt: j.submittedAt ?? null,
    kasieApprovedBy: j.kasieApprovedBy ?? null,
    kasieApprovedAt: j.kasieApprovedAt ?? null,
    kadisPerawatanApprovedBy: j.kadisPerawatanApprovedBy ?? null,
    kadisPerawatanApprovedAt: j.kadisPerawatanApprovedAt ?? null,
    kadisApprovedBy: j.kadisApprovedBy ?? null,
    kadisApprovedAt: j.kadisApprovedAt ?? null,
    equipmentModels: (j.equipmentModels || []).map(em => ({
      equipmentId: em.equipmentId,
      equipmentName: em.equipmentName,
      functionalLocation: em.functionalLocation,
      plantName: em.equipmentDetails?.plantName ?? null,
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
  if (req.query.status) where.status = req.query.status;
  if (req.query.from) where.scheduledDate = { ...where.scheduledDate, [Op.gte]: req.query.from };
  if (req.query.to)   where.scheduledDate = { ...where.scheduledDate, [Op.lte]: req.query.to };

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
        include: [{ model: Equipment, as: 'equipmentDetails', attributes: ['latitude', 'longitude', 'plantName'] }],
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
  const { spkNumber, description, interval, category, status, durationActual, scheduledDate, equipmentModels = [], activitiesModel = [] } = req.body;
  if (!spkNumber) return res.status(400).json({ error: 'spkNumber is required' });

  const exists = await Spk.findByPk(spkNumber);
  if (exists) return res.status(409).json({ error: 'spkNumber already exists' });

  const t = await sequelize.transaction();
  try {
    const spk = await Spk.create({ spkNumber, description, intervalPeriod: interval, category, status: status || 'pending', durationActual: durationActual ?? null, scheduledDate: scheduledDate ?? null }, { transaction: t });
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

  const t = await sequelize.transaction();
  try {
    const count = await destroySpksByNumbers(ids, t);
    await t.commit();
    res.json({ message: `Deleted ${count} SPK(s)` });
  } catch (err) {
    await t.rollback();
    throw err;
  }
};

// DELETE /api/spk/:spkNumber
const remove = async (req, res) => {
  const spk = await Spk.findByPk(req.params.spkNumber);
  if (!spk) return res.status(404).json({ error: 'SPK not found' });

  const t = await sequelize.transaction();
  try {
    await destroySpksByNumbers([req.params.spkNumber], t);
    await t.commit();
    res.json({ message: 'Deleted' });
  } catch (err) {
    await t.rollback();
    throw err;
  }
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

    // Move SPK into approval chain
    await spk.update({
      status: 'awaiting_kasie',
      durationActual: durationActual ?? spk.durationActual,
      evaluasi: evaluasi || null,
      submittedBy: req.user?.userId ?? null,
      submittedAt: new Date(),
    }, { transaction: t });

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

// Kadis funcloc routing map
const KADIS_FUNCLOC_MAP = [
  { pattern: /PS I Cidanau|PS II Waduk/i,                         role: 'kadis_air_baku' },
  { pattern: /WTP Cidanau|Cipasauran/i,                            role: 'kadis_pengolahan_cidanau' },
  { pattern: /Decanter|WTP Krenceng/i,                             role: 'kadis_pengolahan_krenceng' },
  { pattern: /Pos Keamanan/i,                                       role: 'kadis_keamanan' },
];

function getExpectedKadisRole(functionalLocation) {
  if (!functionalLocation) return null;
  for (const entry of KADIS_FUNCLOC_MAP) {
    if (entry.pattern.test(functionalLocation)) return entry.role;
  }
  return null;
}

// POST /api/spk/:spkNumber/approve-kasie
const approveKasie = async (req, res) => {
  const spk = await Spk.findByPk(req.params.spkNumber, { include: INCLUDE_FULL });
  if (!spk) return res.status(404).json({ error: 'SPK not found' });
  if (spk.status !== 'awaiting_kasie') {
    return res.status(400).json({ error: `SPK status is '${spk.status}', expected 'awaiting_kasie'` });
  }

  const role = req.user?.role;
  const validKasieRoles = ['supervisor', 'kepala_seksi', 'kasie'];
  if (!validKasieRoles.includes(role)) {
    return res.status(403).json({ error: 'Only Kasie/Supervisor can approve this step' });
  }

  await spk.update({
    status: 'awaiting_kadis_perawatan',
    kasieApprovedBy: req.user.userId,
    kasieApprovedAt: new Date(),
  });

  const fresh = await Spk.findByPk(spk.spkNumber, { include: INCLUDE_FULL });
  res.json(fmt(fresh));
};

// POST /api/spk/:spkNumber/approve-kadis-perawatan
const approveKadisPerawatan = async (req, res) => {
  const spk = await Spk.findByPk(req.params.spkNumber, { include: INCLUDE_FULL });
  if (!spk) return res.status(404).json({ error: 'SPK not found' });
  if (spk.status !== 'awaiting_kadis_perawatan') {
    return res.status(400).json({ error: `SPK status is '${spk.status}', expected 'awaiting_kadis_perawatan'` });
  }

  const role = req.user?.role;
  if (role !== 'kadis_perawatan') {
    return res.status(403).json({ error: 'Only Kadis Perawatan can approve this step' });
  }

  await spk.update({
    status: 'awaiting_kadis',
    kadisPerawatanApprovedBy: req.user.userId,
    kadisPerawatanApprovedAt: new Date(),
  });

  const fresh = await Spk.findByPk(spk.spkNumber, { include: INCLUDE_FULL });
  res.json(fmt(fresh));
};

// POST /api/spk/:spkNumber/approve-kadis
const approveKadis = async (req, res) => {
  const spk = await Spk.findByPk(req.params.spkNumber, { include: INCLUDE_FULL });
  if (!spk) return res.status(404).json({ error: 'SPK not found' });
  if (spk.status !== 'awaiting_kadis') {
    return res.status(400).json({ error: `SPK status is '${spk.status}', expected 'awaiting_kadis'` });
  }

  const role = req.user?.role;
  // Validate Kadis funcloc routing
  const funclocs = (spk.equipmentModels || []).map(e => e.functionalLocation).filter(Boolean);
  const expectedRole = funclocs.length > 0 ? getExpectedKadisRole(funclocs[0]) : null;
  if (expectedRole && role !== expectedRole) {
    return res.status(403).json({ error: `This SPK requires approval from '${expectedRole}'` });
  }

  // Fallback: if funcloc not mapped, any kadis role can approve
  const kadisRoles = ['kadis_air_baku', 'kadis_pengolahan_cidanau', 'kadis_pengolahan_krenceng', 'kadis_keamanan', 'kepala_dinas', 'kepala_divisi'];
  if (!kadisRoles.includes(role)) {
    return res.status(403).json({ error: 'Only Kadis can approve this step' });
  }

  await spk.update({
    status: 'approved',
    kadisApprovedBy: req.user.userId,
    kadisApprovedAt: new Date(),
  });

  const fresh = await Spk.findByPk(spk.spkNumber, { include: INCLUDE_FULL });
  res.json(fmt(fresh));
};

module.exports = { getAll, getOne, create, update, bulkDelete, remove, submit, sync, generateFromTaskList, approveKasie, approveKadisPerawatan, approveKadis };
