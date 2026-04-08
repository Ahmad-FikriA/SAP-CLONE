'use strict';

const { Op } = require('sequelize');
const { v4: uuid } = require('uuid');
const sequelize = require('../../config/database');
const { Spk, SpkEquipment, SpkActivity } = require('../../models/Spk');
const { Submission, SubmissionPhoto, SubmissionActivityResult } = require('../../models/Submission');
const Equipment = require('../../models/Equipment');
const { GeneralTaskList, GeneralTaskListActivity } = require('../../models/GeneralTaskList');
const EquipmentIntervalMapping = require('../../models/EquipmentIntervalMapping');
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

// Derive ISO week number and year from a DATEONLY string (YYYY-MM-DD)
function getISOWeek(dateStr) {
  if (!dateStr) return { weekNumber: null, weekYear: null };
  // Parse as UTC date (DATEONLY field is already YYYY-MM-DD, treat as UTC)
  const d = new Date(dateStr + 'T00:00:00Z');
  const thu = new Date(d);
  thu.setUTCDate(d.getUTCDate() + (4 - (d.getUTCDay() || 7)));
  const yearStart = new Date(Date.UTC(thu.getUTCFullYear(), 0, 4)); // Jan 4 always in week 1
  const jan4Day = yearStart.getUTCDay() || 7;
  const week1Mon = new Date(yearStart);
  week1Mon.setUTCDate(yearStart.getUTCDate() - (jan4Day - 1));
  const weekNumber = Math.floor((thu - week1Mon) / (7 * 86400000)) + 1;
  return { weekNumber, weekYear: thu.getUTCFullYear() };
}

function fmt(spk) {
  const j = spk.toJSON();
  const { weekNumber, weekYear } = getISOWeek(j.scheduledDate);
  return {
    spkNumber: j.spkNumber,
    description: j.description,
    interval: j.intervalPeriod,
    category: j.category,
    status: j.status,
    durationActual: j.durationActual,
    scheduledDate: j.scheduledDate ?? null,
    weekNumber: weekNumber ?? null,
    weekYear: weekYear ?? null,
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

  // Filter by ISO week number + year (alternative to from/to date range)
  if (req.query.week && req.query.year) {
    const week = parseInt(req.query.week, 10);
    const year = parseInt(req.query.year, 10);
    const jan4 = new Date(Date.UTC(year, 0, 4));
    const jan4Day = jan4.getUTCDay() || 7;
    const week1Mon = new Date(jan4);
    week1Mon.setUTCDate(jan4.getUTCDate() - (jan4Day - 1));
    const weekStart = new Date(week1Mon);
    weekStart.setUTCDate(week1Mon.getUTCDate() + (week - 1) * 7);
    const weekEnd = new Date(weekStart);
    weekEnd.setUTCDate(weekStart.getUTCDate() + 6);
    where.scheduledDate = {
      [Op.gte]: weekStart.toISOString().slice(0, 10),
      [Op.lte]: weekEnd.toISOString().slice(0, 10),
    };
  }

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

// POST /api/spk/batch-generate
const batchGenerate = async (req, res) => {
  const { week, year, interval, category, equipmentIds = [] } = req.body;

  if (!week || !year || !interval || !category || !equipmentIds.length) {
    return res.status(400).json({ error: 'week, year, interval, category, and equipmentIds[] are required' });
  }
  if (week < 1 || week > 53) {
    return res.status(400).json({ error: 'week must be between 1 and 53' });
  }

  // Compute weekStart (Monday of ISO week W) — use UTC to avoid timezone shift
  const jan4 = new Date(Date.UTC(year, 0, 4));
  const jan4Day = jan4.getUTCDay() || 7;
  const week1Mon = new Date(jan4);
  week1Mon.setUTCDate(jan4.getUTCDate() - (jan4Day - 1));
  const weekStartDate = new Date(week1Mon);
  weekStartDate.setUTCDate(week1Mon.getUTCDate() + (week - 1) * 7);
  const scheduledDate = weekStartDate.toISOString().slice(0, 10);

  const catCode = { Mekanik: 'M', Listrik: 'L', Sipil: 'S', Otomasi: 'O' }[category] || 'X';
  const weekStr = String(week).padStart(2, '0');
  const spkPrefix = `SPK-${catCode}-${year}-W${weekStr}-`;

  // Find highest existing sequence for this prefix
  const existingWithPrefix = await Spk.findAll({
    where: { spkNumber: { [Op.like]: spkPrefix + '%' } },
    attributes: ['spkNumber'],
  });
  let seq = existingWithPrefix.reduce((max, s) => {
    const m = s.spkNumber.match(/-(\d+)$/);
    return m ? Math.max(max, parseInt(m[1])) : max;
  }, 0);

  // Load mappings for all requested equipment + interval (in bulk)
  const mappings = await EquipmentIntervalMapping.findAll({
    where: { equipmentId: { [Op.in]: equipmentIds }, interval },
    include: [{
      model: GeneralTaskList, as: 'taskList',
      include: [{ model: GeneralTaskListActivity, as: 'activities', order: [['stepNumber', 'ASC']] }],
    }],
  });
  const mappingByEq = {};
  for (const m of mappings) mappingByEq[m.equipmentId] = m;

  // Idempotency: find equipment that already have an SPK for this week + interval
  const existingLinks = await SpkEquipment.findAll({
    where: { equipmentId: { [Op.in]: equipmentIds } },
    include: [{
      model: Spk, as: 'spk',
      where: { scheduledDate, intervalPeriod: interval },
      required: true,
      attributes: ['spkNumber'],
    }],
    attributes: ['equipmentId'],
  });
  const alreadyDone = new Set(existingLinks.map(e => e.equipmentId));

  // Load equipment details
  const eqRecords = await Equipment.findAll({ where: { equipmentId: { [Op.in]: equipmentIds } } });
  const eqMap = {};
  for (const eq of eqRecords) eqMap[eq.equipmentId] = eq;

  const created = [];
  const skipped = [];

  const t = await sequelize.transaction();
  try {
    for (const equipmentId of equipmentIds) {
      const eq = eqMap[equipmentId];
      if (!eq) { skipped.push({ equipmentId, reason: 'equipment not found' }); continue; }

      if (alreadyDone.has(equipmentId)) {
        skipped.push({ equipmentId, equipmentName: eq.equipmentName, reason: 'SPK already exists for this week/interval' });
        continue;
      }

      const mapping = mappingByEq[equipmentId];
      if (!mapping) {
        skipped.push({ equipmentId, equipmentName: eq.equipmentName, reason: 'no mapping for this interval' });
        continue;
      }

      seq++;
      const spkNumber = spkPrefix + String(seq).padStart(3, '0');
      const taskList = mapping.taskList;
      const description = taskList
        ? `${taskList.taskListName} — W${weekStr} ${year}`
        : `${eq.equipmentName} — W${weekStr} ${year}`;

      await Spk.create({ spkNumber, description, intervalPeriod: interval, category, status: 'pending', scheduledDate }, { transaction: t });
      await SpkEquipment.create({ spkNumber, equipmentId, equipmentName: eq.equipmentName, functionalLocation: eq.functionalLocation || null }, { transaction: t });

      let actNum = 1;
      for (const step of (taskList?.activities || [])) {
        await SpkActivity.create({
          spkNumber,
          activityNumber: `ACT-${String(actNum++).padStart(3, '0')}`,
          equipmentId,
          operationText: step.operationText,
          durationPlan: 0.5,
        }, { transaction: t });
      }

      created.push({ spkNumber, equipmentId, equipmentName: eq.equipmentName });
    }

    await t.commit();
    res.status(201).json({
      message: `${created.length} SPK berhasil dibuat untuk W${weekStr} ${year} / ${interval}`,
      week, year, interval, scheduledDate,
      created,
      skipped,
    });
  } catch (err) {
    await t.rollback();
    throw err;
  }
};

module.exports = { getAll, getOne, create, update, bulkDelete, remove, submit, sync, generateFromTaskList, approveKasie, approveKadisPerawatan, approveKadis, batchGenerate };
