'use strict';

const { Op } = require('sequelize');
const { v4: uuid } = require('uuid');
const Notification = require('../../models/Notification');
const { SpkCorrective, SpkCorrectiveItem, SpkCorrectivePhoto } = require('../../models/associations');
const { KADIS_ROLE, KADIS_PUSAT_ROLE } = require('../../middleware/correctiveAccess');

function fmtRequest(notif) {
  const n = notif.toJSON ? notif.toJSON() : notif;
  const spk = n.spkCorrective || {};
  
  // Format images
  const images = [];
  if (n.photo1) images.push(n.photo1);
  if (n.photo2) images.push(n.photo2);
  
  const beforeImages = (spk.photos || []).filter(p => p.photoType === 'before').map(p => p.photoPath);
  const afterImages = (spk.photos || []).filter(p => p.photoType === 'after').map(p => p.photoPath);
  
  const materials = (spk.items || []).filter(i => i.itemType === 'material').map(i => i.itemName);
  const tools = (spk.items || []).filter(i => i.itemType === 'tool').map(i => i.itemName);
  
  return {
    id: n.notificationId || n.id,
    notificationDate: n.notificationDate,
    notificationType: n.notificationType,
    description: n.description,
    functionalLocation: n.functionalLocation,
    equipment: n.equipmentName || n.equipment, 
    requiredStart: n.requiredStart,
    requiredEnd: n.requiredEnd,
    reportedBy: n.reportedBy,
    longText: n.longText,
    submittedBy: n.submittedBy,
    submittedAt: n.submittedAt,
    status: n.status,
    approvalStatus: n.approvalStatus || 'pending',
    workCenter: spk.workCenter || n.workCenter,
    images,
    
    // SPK mapped fields
    spkId: spk.spkId,
    spkNumber: spk.spkNumber,
    priority: spk.priority,
    targetDate: spk.requestedFinishDate,
    classification: spk.damageClassification,
    personnelCount: spk.plannedWorker,
    estimatedDuration: spk.totalPlannedHour,
    instructions: spk.jobDescription,
    
    // Execution fields
    beforeImages,
    afterImages,
    materials,
    tools,
    actualPersonnelCount: spk.actualWorker,
    actualDuration: spk.totalActualHour,
    executionResultText: spk.jobResultDescription,
  };
}

const SPK_INCLUDE = {
  model: SpkCorrective,
  as: 'spkCorrective',
  include: [
    { model: SpkCorrectiveItem, as: 'items' },
    { model: SpkCorrectivePhoto, as: 'photos' }
  ]
};

// GET /api/corrective/requests
const getAll = async (req, res) => {
  const { userId, role } = req.user;
  const where = {};
  
  if (req.query.status) where.status = req.query.status;
  
  // Kadis Pelapor can only see own notifications
  if (role === KADIS_ROLE) {
    where.kadisPelaporId = userId;
  }
  
  const data = await Notification.findAll({
    where,
    include: [SPK_INCLUDE],
    order: [['submittedAt', 'DESC']],
  });
  
  res.json(data.map(fmtRequest));
};

// GET /api/corrective/requests/:id
const getOne = async (req, res) => {
  const notification = await Notification.findByPk(req.params.id, {
    include: [SPK_INCLUDE],
  });
  
  if (!notification) return res.status(404).json({ error: 'Notification not found' });
  res.json(fmtRequest(notification));
};

// POST /api/corrective/requests
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
  
  const photos = req.files || [];
  if (photos.length < 1 || photos.length > 2) {
    return res.status(400).json({ error: 'Notification requires 1-2 photos (max 2MB each)' });
  }
  
  const photoPaths = photos.map(file => `uploads/corrective/${file.filename}`);
  const id = `NOTIF-${uuid().slice(0, 8).toUpperCase()}`;
  
  await Notification.create({
    notificationId: id, // using correct primary key mapped to id in the payload
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
    status: 'menunggu_review_awal_kadis_pp',
    approvalStatus: 'menunggu_review_awal_kadis_pp',
    workCenter: workCenter || null,
  });
  
  const fresh = await Notification.findByPk(id, { include: [SPK_INCLUDE] });
  res.status(201).json(fmtRequest(fresh));
};

// PUT /api/corrective/requests/:id
const update = async (req, res) => {
  const { userId, role } = req.user;
  const notification = await Notification.findByPk(req.params.id);
  
  if (!notification) return res.status(404).json({ error: 'Notification not found' });
  
  if (role === 'planner') {
    return res.status(403).json({ error: 'Planner cannot modify notification fields directly.' });
  }
  
  if (role === KADIS_ROLE) {
    if (notification.status === 'spk_created' || notification.status === 'closed') {
      return res.status(400).json({ error: 'Cannot modify notification after SPK is created or closed' });
    }
  }
  
  await notification.update(req.body);
  
  const fresh = await Notification.findByPk(notification.notificationId || notification.id, { include: [SPK_INCLUDE] });
  res.json(fmtRequest(fresh));
};

// POST /api/corrective/requests/:id/approve
const approveKadisPusat = async (req, res) => {
  const notification = await Notification.findByPk(req.params.id);
  
  if (!notification) return res.status(404).json({ error: 'Notification not found' });
  
  if (notification.status !== 'menunggu_review_awal_kadis_pp') {
    return res.status(400).json({ error: 'Notification is not awaiting awal review' });
  }
  
  await notification.update({
    status: 'approved',
    approvalStatus: 'approved' // Tunggu SPK state in Flutter
  });
  
  const fresh = await Notification.findByPk(notification.notificationId || notification.id, { include: [SPK_INCLUDE] });
  res.json(fmtRequest(fresh));
};

// POST /api/corrective/requests/:id/reject
const rejectKadisPusat = async (req, res) => {
  const notification = await Notification.findByPk(req.params.id);
  
  if (!notification) return res.status(404).json({ error: 'Notification not found' });
  
  if (notification.status !== 'menunggu_review_awal_kadis_pp') {
    return res.status(400).json({ error: 'Notification is not awaiting awal review' });
  }
  
  await notification.update({
    status: 'ditolak_kadis_pp_awal',
    approvalStatus: 'ditolak_kadis_pp_awal'
  });
  
  const fresh = await Notification.findByPk(notification.notificationId || notification.id, { include: [SPK_INCLUDE] });
  res.json(fmtRequest(fresh));
};

// DELETE /api/corrective/requests/:id
const remove = async (req, res) => {
  const notification = await Notification.findByPk(req.params.id);
  if (!notification) return res.status(404).json({ error: 'Notification not found' });
  
  if (notification.status === 'spk_created') {
    return res.status(400).json({ error: 'Cannot delete notification after SPK is created' });
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
      notificationId: { [Op.in]: ids },
      status: { [Op.ne]: 'spk_created' }, 
    },
  });
  
  res.json({ message: `Deleted ${count} notification(s)` });
};

module.exports = { getAll, getOne, create, update, remove, bulkDelete, approveKadisPusat, rejectKadisPusat };
