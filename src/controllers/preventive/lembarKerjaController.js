'use strict';

const { Op }  = require('sequelize');
const sequelize = require('../../config/database');
const { Spk, SpkEquipment, SpkActivity } = require('../../models/Spk');
const { LembarKerja, LembarKerjaSpk }    = require('../../models/LembarKerja');
const Equipment = require('../../models/Equipment');

const _PENDING_STATES = ['awaiting_kasie','awaiting_ap','awaiting_kadis_pusat','awaiting_kadis_keamanan'];

// ── Eager-load config ─────────────────────────────────────────────────────────
const SPK_INCLUDE = [
  {
    model: SpkEquipment, as: 'equipmentModels',
    attributes: ['equipmentId', 'equipmentName', 'functionalLocation'],
    include: [{ model: Equipment, as: 'equipmentDetails', attributes: ['latitude', 'longitude'] }],
  },
  { model: SpkActivity, as: 'activitiesModel', attributes: ['activityNumber','equipmentId','operationText','resultComment','durationPlan','durationActual','isVerified'] },
];
const LK_INCLUDE = [{
  model: LembarKerjaSpk, as: 'spkLinks', attributes: ['spkNumber'],
  include: [{ model: Spk, as: 'spk', include: SPK_INCLUDE }],
}];

function fmt(lk) {
  const j = lk.toJSON();
  return {
    lkNumber:     j.lkNumber,
    periodeStart: j.periodeStart,
    periodeEnd:   j.periodeEnd,
    category:     j.category,
    status:       j.status,
    lembarKe:     j.lembarKe,
    totalLembar:  j.totalLembar,
    evaluasi:     j.evaluasi,
    approvalStatus:            j.approvalStatus,
    kasieApprovedBy:           j.kasieApprovedBy,
    kasieApprovedAt:           j.kasieApprovedAt,
    apApprovedBy:              j.apApprovedBy,
    apApprovedAt:              j.apApprovedAt,
    kadisPusatApprovedBy:      j.kadisPusatApprovedBy,
    kadisPusatApprovedAt:      j.kadisPusatApprovedAt,
    kadisKeamananApprovedBy:   j.kadisKeamananApprovedBy,
    kadisKeamananApprovedAt:   j.kadisKeamananApprovedAt,
    rejectedBy:                j.rejectedBy,
    rejectedAt:                j.rejectedAt,
    rejectionNotes:            j.rejectionNotes,
    spkModels: (j.spkLinks || []).map(link => {
      const s = link.spk;
      if (!s) return null; // orphaned link — skip instead of returning a bare string
      return {
        spkNumber: s.spkNumber, description: s.description, interval: s.intervalPeriod,
        category: s.category, status: s.status, durationActual: s.durationActual,
        equipmentModels: (s.equipmentModels || []).map(em => ({
          equipmentId: em.equipmentId,
          equipmentName: em.equipmentName,
          functionalLocation: em.functionalLocation,
          latitude: em.equipmentDetails?.latitude ?? null,
          longitude: em.equipmentDetails?.longitude ?? null,
        })),
        activitiesModel: s.activitiesModel || [],
      };
    }).filter(Boolean), // remove any null entries from orphaned links
  };
}

// GET /api/lk
const getAll = async (req, res) => {
  const where = {};
  if (req.query.category) where.category = req.query.category;
  // Overlap check: LK period overlaps the requested week when
  //   periodeStart <= weekEnd  AND  periodeEnd >= weekStart
  if (req.query.startDate && req.query.endDate) {
    where.periodeStart = { [Op.lte]: new Date(req.query.endDate) };
    where.periodeEnd   = { [Op.gte]: new Date(req.query.startDate) };
  }
  const data  = await LembarKerja.findAll({ where, include: LK_INCLUDE });
  res.json(data.map(fmt));
};

// GET /api/lk/:lkNumber
const getOne = async (req, res) => {
  const lk = await LembarKerja.findByPk(req.params.lkNumber, { include: LK_INCLUDE });
  if (!lk) return res.status(404).json({ error: 'LembarKerja not found' });
  res.json(fmt(lk));
};

// POST /api/lk
const create = async (req, res) => {
  const { lkNumber, spkModels = [], ...rest } = req.body;
  if (!lkNumber) return res.status(400).json({ error: 'lkNumber is required' });
  const exists = await LembarKerja.findByPk(lkNumber);
  if (exists) return res.status(409).json({ error: 'lkNumber already exists' });

  const lk = await LembarKerja.create({ lkNumber, ...rest });
  for (const spkNum of spkModels) await LembarKerjaSpk.create({ lkNumber, spkNumber: spkNum });
  const fresh = await LembarKerja.findByPk(lkNumber, { include: LK_INCLUDE });
  res.status(201).json(fmt(fresh));
};

// PUT /api/lk/:lkNumber
const update = async (req, res) => {
  const lk = await LembarKerja.findByPk(req.params.lkNumber);
  if (!lk) return res.status(404).json({ error: 'LembarKerja not found' });
  const { spkModels, ...rest } = req.body;
  await lk.update({ ...rest, lkNumber: lk.lkNumber });
  const fresh = await LembarKerja.findByPk(lk.lkNumber, { include: LK_INCLUDE });
  res.json(fmt(fresh));
};

// POST /api/lk/bulk-delete
const bulkDelete = async (req, res) => {
  const { ids } = req.body;
  if (!Array.isArray(ids) || !ids.length) return res.status(400).json({ error: 'ids array required' });
  const count = await LembarKerja.destroy({ where: { lkNumber: { [Op.in]: ids } } });
  res.json({ message: `Deleted ${count} LK(s)` });
};

// DELETE /api/lk/:lkNumber
const remove = async (req, res) => {
  const count = await LembarKerja.destroy({ where: { lkNumber: req.params.lkNumber } });
  if (!count) return res.status(404).json({ error: 'LembarKerja not found' });
  res.json({ message: 'Deleted' });
};

// POST /api/lk/:lkNumber/submit
const submit = async (req, res) => {
  const lk = await LembarKerja.findByPk(req.params.lkNumber);
  if (!lk) return res.status(404).json({ error: 'LembarKerja not found' });
  const { evaluasi } = req.body;
  await lk.update({ status: 'completed', approvalStatus: 'awaiting_kasie', ...(evaluasi !== undefined && { evaluasi }) });
  res.json({ message: 'Lembar kerja submitted', lkNumber: lk.lkNumber });
};

// POST /api/lk/:lkNumber/approve
const approve = async (req, res) => {
  const { role, userId } = req.user;
  if (role !== 'supervisor' && role !== 'manager') {
    return res.status(403).json({ error: 'Forbidden: only supervisor or manager can approve' });
  }

  const result = await sequelize.transaction(async (t) => {
    const lk = await LembarKerja.findByPk(req.params.lkNumber, { include: LK_INCLUDE, transaction: t, lock: t.LOCK.UPDATE });
    if (!lk) return { status: 404, body: { error: 'LembarKerja not found' } };
    if (lk.approvalStatus === 'approved' || lk.approvalStatus === 'rejected') {
      return { status: 400, body: { error: `LK is already ${lk.approvalStatus}` } };
    }

    const now = new Date().toISOString();
    const updates = {};

    if (role === 'supervisor') {
      if (lk.approvalStatus !== 'awaiting_kasie') return { status: 400, body: { error: 'LK is not awaiting Kasie approval' } };
      Object.assign(updates, { approvalStatus: 'awaiting_ap', kasieApprovedBy: userId, kasieApprovedAt: now });
    } else {
      if      (lk.approvalStatus === 'awaiting_ap')             Object.assign(updates, { approvalStatus: 'awaiting_kadis_pusat',    apApprovedBy: userId,         apApprovedAt: now });
      else if (lk.approvalStatus === 'awaiting_kadis_pusat')    Object.assign(updates, { approvalStatus: 'awaiting_kadis_keamanan', kadisPusatApprovedBy: userId,  kadisPusatApprovedAt: now });
      else if (lk.approvalStatus === 'awaiting_kadis_keamanan') Object.assign(updates, { approvalStatus: 'approved',                kadisKeamananApprovedBy: userId, kadisKeamananApprovedAt: now });
      else return { status: 400, body: { error: 'LK is not awaiting manager approval' } };
    }

    await lk.update(updates, { transaction: t });
    const fresh = await LembarKerja.findByPk(lk.lkNumber, { include: LK_INCLUDE, transaction: t });
    return { status: 200, body: fmt(fresh) };
  });

  res.status(result.status).json(result.body);
};

// POST /api/lk/:lkNumber/reject
const reject = async (req, res) => {
  const { role, userId } = req.user;
  if (role !== 'supervisor' && role !== 'manager') {
    return res.status(403).json({ error: 'Forbidden: only supervisor or manager can reject' });
  }

  const lk = await LembarKerja.findByPk(req.params.lkNumber, { include: LK_INCLUDE });
  if (!lk) return res.status(404).json({ error: 'LembarKerja not found' });
  if (!_PENDING_STATES.includes(lk.approvalStatus)) {
    return res.status(400).json({ error: 'LK is not in a rejectable state' });
  }

  await lk.update({ approvalStatus: 'rejected', rejectedBy: userId, rejectedAt: new Date().toISOString(), rejectionNotes: req.body.notes || null });
  const fresh = await LembarKerja.findByPk(lk.lkNumber, { include: LK_INCLUDE });
  res.json(fmt(fresh));
};

module.exports = { getAll, getOne, create, update, bulkDelete, remove, submit, approve, reject };
