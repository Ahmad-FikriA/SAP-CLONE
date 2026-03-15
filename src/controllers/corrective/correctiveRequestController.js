'use strict';

const { Op } = require('sequelize');
const { v4: uuid } = require('uuid');
const Notification = require('../../models/Notification');
const { SpkCorrective } = require('../../models/associations');
const { KADIS_ROLE, KADIS_PUSAT_ROLE } = require('../../middleware/correctiveAccess');

// GET /api/corrective/requests
// Rules: Kadis Pelapor (own), Planner (all), Kadis Pusat (all)
const getAll = async (req, res) => {
  const { userId, role } = req.user;
  const where = {};
  
  if (req.query.status) where.status = req.query.status;
  
  // Kadis Pelapor can only see own notifications
  if (role === KADIS_ROLE) {
    where.kadisPelaporId = userId;
  }
  // Planner and Kadis Pusat can see all (no filter)
  // Teknisi/Kasie cannot see notifications
  
  const data = await Notification.findAll({
    where,
    order: [['submittedAt', 'DESC']],
  });
  
  res.json(data);
};

// GET /api/corrective/requests/:id
const getOne = async (req, res) => {
  const notification = await Notification.findByPk(req.params.id, {
    include: [{
      model: SpkCorrective,
      as: 'spkCorrective',
    }],
  });
  
  if (!notification) return res.status(404).json({ error: 'Notification not found' });
  res.json(notification);
};

// POST /api/corrective/requests
// Rules: Only Kadis can create
// Requirements: 1-2 photos (max 2MB each)
const create = async (req, res) => {
  const {
    notificationDate,
    notificationType,
    description,
    functionalLocation,
    equipment,
    equipmentId,
    requiredStart,
    requiredEnd,
    reportedBy,
    longText,
    workCenter,
  } = req.body;
  
  const { userId, role } = req.user;
  
  // Validate required photos (1-2 photos)
  const photos = req.files || [];
  if (photos.length < 1 || photos.length > 2) {
    return res.status(400).json({
      error: 'Notification requires 1-2 photos (max 2MB each)'
    });
  }
  
  // Generate photo paths
  const photoPaths = photos.map(file => `uploads/corrective/${file.filename}`);
  
  const id = `NOTIF-${uuid().slice(0, 8).toUpperCase()}`;
  
  const notification = await Notification.create({
    id,
    notificationDate,
    notificationType,
    description,
    functionalLocation,
    equipment,
    equipmentId,
    requiredStart,
    requiredEnd,
    reportedBy,
    longText,
    photo1: photoPaths[0] || null,
    photo2: photoPaths[1] || null,
    kadisPelaporId: userId,
    submittedBy: userId,
    submittedAt: new Date(),
    status: 'submitted',
    workCenter: workCenter || null,
  });
  
  const fresh = await Notification.findByPk(id, {
    include: [{
      model: SpkCorrective,
      as: 'spkCorrective',
    }],
  });
  
  res.status(201).json(fresh);
};

// PUT /api/corrective/requests/:id
// Rules: Kadis Pelapor can update own; Planner cannot change notification fields directly
const update = async (req, res) => {
  const { userId, role } = req.user;
  const notification = await Notification.findByPk(req.params.id);
  
  if (!notification) return res.status(404).json({ error: 'Notification not found' });
  
  // Planner cannot modify notification fields directly
  if (role === 'planner') {
    return res.status(403).json({
      error: 'Planner cannot modify notification fields directly. Please create SPK instead.'
    });
  }
  
  // Kadis Pelapor can only update if status is draft or submitted
  if (role === KADIS_ROLE) {
    if (notification.status === 'spk_created' || notification.status === 'closed') {
      return res.status(400).json({
        error: 'Cannot modify notification after SPK is created or closed'
      });
    }
  }
  
  await notification.update(req.body);
  
  const fresh = await Notification.findByPk(notification.id, {
    include: [{
      model: SpkCorrective,
      as: 'spkCorrective',
    }],
  });
  
  res.json(fresh);
};

// DELETE /api/corrective/requests/:id
const remove = async (req, res) => {
  const notification = await Notification.findByPk(req.params.id);
  if (!notification) return res.status(404).json({ error: 'Notification not found' });
  
  // Cannot delete if SPK already created
  if (notification.status === 'spk_created') {
    return res.status(400).json({
      error: 'Cannot delete notification after SPK is created'
    });
  }
  
  await notification.destroy();
  res.json({ message: 'Notification deleted' });
};

// POST /api/corrective/requests/bulk-delete
const bulkDelete = async (req, res) => {
  const { ids } = req.body;
  if (!Array.isArray(ids) || !ids.length) {
    return res.status(400).json({ error: 'ids array required' });
  }
  
  const count = await Notification.destroy({
    where: {
      id: { [Op.in]: ids },
      status: { [Op.ne]: 'spk_created' }, // Cannot delete if SPK created
    },
  });
  
  res.json({ message: `Deleted ${count} notification(s)` });
};

module.exports = { getAll, getOne, create, update, remove, bulkDelete };
