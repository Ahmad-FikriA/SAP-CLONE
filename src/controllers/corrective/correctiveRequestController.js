'use strict';

const { Op }    = require('sequelize');
const { v4: uuid } = require('uuid');
const { CorrectiveRequest, CorrectiveRequestImage } = require('../../models/CorrectiveRequest');

const INCLUDE_IMAGES = [
  { model: CorrectiveRequestImage, as: 'images', attributes: ['id', 'imagePath'] },
];

function fmt(cr) {
  const j = cr.toJSON();
  return {
    ...j,
    images: (j.images || []).map(i => i.imagePath),
  };
}

// GET /api/corrective/requests
const getAll = async (req, res) => {
  const where = {};
  if (req.query.status) where.status = req.query.status;
  const data = await CorrectiveRequest.findAll({ where, include: INCLUDE_IMAGES, order: [['submittedAt', 'DESC']] });
  res.json(data.map(fmt));
};

// GET /api/corrective/requests/:id
const getOne = async (req, res) => {
  const cr = await CorrectiveRequest.findByPk(req.params.id, { include: INCLUDE_IMAGES });
  if (!cr) return res.status(404).json({ error: 'Corrective request not found' });
  res.json(fmt(cr));
};

// POST /api/corrective/requests
// Body: parsed Excel data + images array (paths from parse-excel endpoint)
const create = async (req, res) => {
  const {
    notificationDate, notificationType, description, functionalLocation,
    equipment, requiredStart, requiredEnd, reportedBy, longText, images = [],
  } = req.body;

  const id = `CR-${uuid().slice(0, 8).toUpperCase()}`;

  const cr = await CorrectiveRequest.create({
    id, notificationDate, notificationType, description, functionalLocation,
    equipment, requiredStart, requiredEnd, reportedBy, longText,
    submittedBy: req.user.userId,
    submittedAt: new Date(),
    status: 'submitted',
    approvalStatus: 'awaiting_supervisor',
  });

  for (const imgPath of images) {
    await CorrectiveRequestImage.create({ requestId: id, imagePath: imgPath });
  }

  const fresh = await CorrectiveRequest.findByPk(id, { include: INCLUDE_IMAGES });
  res.status(201).json(fmt(fresh));
};

// PUT /api/corrective/requests/:id
const update = async (req, res) => {
  const cr = await CorrectiveRequest.findByPk(req.params.id);
  if (!cr) return res.status(404).json({ error: 'Corrective request not found' });
  const { images, ...rest } = req.body;
  await cr.update({ ...rest, id: cr.id });
  const fresh = await CorrectiveRequest.findByPk(cr.id, { include: INCLUDE_IMAGES });
  res.json(fmt(fresh));
};

// DELETE /api/corrective/requests/:id
const remove = async (req, res) => {
  const count = await CorrectiveRequest.destroy({ where: { id: req.params.id } });
  if (!count) return res.status(404).json({ error: 'Corrective request not found' });
  res.json({ message: 'Deleted' });
};

// POST /api/corrective/requests/bulk-delete
const bulkDelete = async (req, res) => {
  const { ids } = req.body;
  if (!Array.isArray(ids) || !ids.length) return res.status(400).json({ error: 'ids array required' });
  const count = await CorrectiveRequest.destroy({ where: { id: { [Op.in]: ids } } });
  res.json({ message: `Deleted ${count} request(s)` });
};

// POST /api/corrective/requests/:id/approve
const approve = async (req, res) => {
  const { role, userId } = req.user;

  if (role !== 'supervisor' && role !== 'manager') {
    return res.status(403).json({ error: 'Forbidden: only supervisor or manager can approve' });
  }

  const cr = await CorrectiveRequest.findByPk(req.params.id, { include: INCLUDE_IMAGES });
  if (!cr) return res.status(404).json({ error: 'Corrective request not found' });

  if (cr.approvalStatus === 'approved' || cr.approvalStatus === 'rejected') {
    return res.status(400).json({ error: `Request is already ${cr.approvalStatus}` });
  }

  const now = new Date().toISOString();

  if (role === 'supervisor') {
    if (cr.approvalStatus !== 'awaiting_supervisor') {
      return res.status(400).json({ error: 'Request is not awaiting supervisor approval' });
    }
    await cr.update({ approvalStatus: 'awaiting_manager' });
  } else if (role === 'manager') {
    if (cr.approvalStatus !== 'awaiting_manager') {
      return res.status(400).json({ error: 'Request is not awaiting manager approval' });
    }
    await cr.update({ approvalStatus: 'approved', status: 'approved', approvedBy: userId, approvedAt: now });
  }

  const fresh = await CorrectiveRequest.findByPk(cr.id, { include: INCLUDE_IMAGES });
  res.json(fmt(fresh));
};

// POST /api/corrective/requests/:id/reject
const reject = async (req, res) => {
  const { role, userId } = req.user;

  if (role !== 'supervisor' && role !== 'manager') {
    return res.status(403).json({ error: 'Forbidden: only supervisor or manager can reject' });
  }

  const cr = await CorrectiveRequest.findByPk(req.params.id, { include: INCLUDE_IMAGES });
  if (!cr) return res.status(404).json({ error: 'Corrective request not found' });

  if (cr.approvalStatus === 'approved' || cr.approvalStatus === 'rejected') {
    return res.status(400).json({ error: `Request is already ${cr.approvalStatus}` });
  }

  await cr.update({
    approvalStatus: 'rejected', status: 'rejected',
    rejectedBy: userId, rejectedAt: new Date().toISOString(),
    rejectionNotes: req.body.notes || null,
  });

  const fresh = await CorrectiveRequest.findByPk(cr.id, { include: INCLUDE_IMAGES });
  res.json(fmt(fresh));
};

module.exports = { getAll, getOne, create, update, remove, bulkDelete, approve, reject };
