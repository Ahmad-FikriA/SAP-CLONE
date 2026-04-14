'use strict';

const { Op } = require('sequelize');
const { v4: uuid } = require('uuid');
const sequelize = require('../../config/database');
const Notification = require('../../models/Notification');
const SpkCorrective = require('../../models/SpkCorrective');
const { SpkCorrectiveItem, SpkCorrectivePhoto } = require('../../models/SpkCorrectiveItem');
const { KADIS_ROLE, WORK_CENTER_ROLES } = require('../../middleware/correctiveAccess');

// ── Eager-load config ─────────────────────────────────────────────────────────
const SPK_INCLUDE = [
  {
    model: SpkCorrectiveItem,
    as: 'items',
    attributes: ['itemId', 'itemType', 'itemName', 'quantity', 'uom'],
  },
  {
    model: SpkCorrectivePhoto,
    as: 'photos',
    attributes: ['photoId', 'photoType', 'photoPath'],
  },
];

function fmtSpk(spk) {
  const j = spk.toJSON();
  return {
    spkId: j.spkId,
    notificationId: j.notificationId,
    spkNumber: j.spkNumber,
    orderNumber: j.orderNumber,
    createdDate: j.createdDate,
    priority: j.priority,
    equipmentId: j.equipmentId,
    location: j.location,
    requestedFinishDate: j.requestedFinishDate,
    actualStartDate: j.actualStartDate,
    damageClassification: j.damageClassification,
    jobDescription: j.jobDescription,
    jobResultDescription: j.jobResultDescription,
    workCenter: j.workCenter,
    ctrlKey: j.ctrlKey,
    unit: j.unit,
    plannedWorker: j.plannedWorker,
    plannedHourPerWorker: j.plannedHourPerWorker,
    totalPlannedHour: j.totalPlannedHour,
    actualWorker: j.actualWorker,
    actualHourPerWorker: j.actualHourPerWorker,
    totalActualHour: j.totalActualHour,
    kasieApprovedBy: j.kasieApprovedBy,
    kasieApprovedAt: j.kasieApprovedAt,
    kadisPusatApprovedBy: j.kadisPusatApprovedBy,
    kadisPusatApprovedAt: j.kadisPusatApprovedAt,
    kadisPelaporApprovedBy: j.kadisPelaporApprovedBy,
    kadisPelaporApprovedAt: j.kadisPelaporApprovedAt,
    status: j.status,
    rejectedBy: j.rejectedBy,
    rejectedAt: j.rejectedAt,
    rejectionNotes: j.rejectionNotes,
    items: j.items || [],
    photos: j.photos || [],
  };
}

// GET /api/corrective/spk - List all corrective SPKs
// Rules: Teknisi/Kasie (own work center), Planner (all), Kadis Pusat (all), Kadis Pelapor (own)
const getAll = async (req, res) => {
  const { userId, role, workCenter } = req.user;
  const where = {};
  
  if (req.query.status) where.status = req.query.status;
  if (req.query.priority) where.priority = req.query.priority;
  
  // Teknisi/Kasie - only see their work center
  if (WORK_CENTER_ROLES.includes(role) && workCenter) {
    where.workCenter = workCenter;
  }
  
  // Kadis Pelapor - only see own reports, TAPI Kadis PP bisa lihat semua
  if (role === KADIS_ROLE) {
    const { dinas } = req.user;
    const isKadisPusat = dinas && dinas.toLowerCase().includes('pusat perawatan');
    
    if (!isKadisPusat) {
      const notifications = await Notification.findAll({
        where: { kadisPelaporId: userId },
        attributes: ['notificationId'],
      });
      const notificationIds = notifications.map(n => n.notificationId);
      where.notificationId = { [Op.in]: notificationIds };
    }
  }
  
  // Planner and Kadis Pusat see all
  
  const data = await SpkCorrective.findAll({
    where,
    include: SPK_INCLUDE,
    order: [['createdDate', 'DESC']],
  });

  res.json(data.map(fmtSpk));
};

// GET /api/corrective/spk/:spkId - Get single corrective SPK
const getOne = async (req, res) => {
  const spk = await SpkCorrective.findByPk(req.params.spkId, {
    include: SPK_INCLUDE,
  });

  if (!spk) return res.status(404).json({ error: 'SPK Corrective not found' });
  res.json(fmtSpk(spk));
};

// POST /api/corrective/spk - Create new corrective SPK
// Rules: Only Planner can create
// Fields: order_number, created_date, priority, equipment_id, location, requested_finish_date,
//         damage_classification, job_description, work_center, ctrl_key, unit,
//         planned_worker, planned_hour_per_worker, total_planned_hour, items
const create = async (req, res) => {
  const {
    notificationId,
    spkNumber,
    orderNumber,
    priority,
    equipmentId,
    location,
    requestedFinishDate,
    damageClassification,
    jobDescription,
    workCenter,
    ctrlKey,
    unit,
    plannedWorker,
    plannedHourPerWorker,
    items = [],
  } = req.body;

  // Validate notification exists
  const notification = await Notification.findByPk(notificationId);
  if (!notification) {
    return res.status(404).json({ error: 'Notification not found' });
  }

  // Check if notification already has SPK
  const existingSpk = await SpkCorrective.findOne({ where: { notificationId } });
  if (existingSpk) {
    return res.status(409).json({ error: 'Notification already has SPK created' });
  }

  // Generate spkId if not provided
  const spkId = req.body.spkId || `SPK-C-${uuid().slice(0, 8).toUpperCase()}`;

  // Calculate total planned hour
  const totalPlannedHour = plannedWorker && plannedHourPerWorker
    ? plannedWorker * plannedHourPerWorker
    : null;

  const t = await sequelize.transaction();
  try {
    const spk = await SpkCorrective.create({
      spkId,
      notificationId,
      spkNumber: spkNumber || spkId,
      orderNumber,
      priority: priority || 'medium',
      equipmentId: equipmentId || notification.equipmentId,
      location: location || notification.functionalLocation,
      requestedFinishDate,
      damageClassification,
      jobDescription,
      workCenter: workCenter || notification.workCenter,
      ctrlKey,
      unit,
      plannedWorker,
      plannedHourPerWorker,
      totalPlannedHour,
      status: 'draft',
    }, { transaction: t });

    // Create items
    for (const item of items) {
      await SpkCorrectiveItem.create({
        spkId,
        itemType: item.itemType || 'material',
        itemName: item.itemName,
        quantity: item.quantity || 1,
        uom: item.uom || 'pcs',
      }, { transaction: t });
    }

    // Update notification status
    await notification.update({ 
      status: 'spk_created',
      approvalStatus: 'menunggu_review_awal_kadis_pp'
    }, { transaction: t });

    await t.commit();

    const fresh = await SpkCorrective.findByPk(spkId, { include: SPK_INCLUDE });
    res.status(201).json(fmtSpk(fresh));
  } catch (err) {
    await t.rollback();
    throw err;
  }
};

// DELETE /api/corrective/spk/:spkId - Delete corrective SPK
const remove = async (req, res) => {
  const spk = await SpkCorrective.findByPk(req.params.spkId);
  if (!spk) return res.status(404).json({ error: 'SPK Corrective not found' });

  const t = await sequelize.transaction();
  try {
    // Update notification status back to submitted
    await Notification.update(
      { status: 'approved', approvalStatus: 'approved' },
      { where: { notificationId: spk.notificationId }, transaction: t }
    );

    await spk.destroy({ transaction: t });
    await t.commit();

    res.json({ message: 'SPK Corrective deleted' });
  } catch (err) {
    await t.rollback();
    throw err;
  }
};

// POST /api/corrective/spk/bulk-delete - Bulk delete
const bulkDelete = async (req, res) => {
  const { ids } = req.body;
  if (!Array.isArray(ids) || !ids.length) {
    return res.status(400).json({ error: 'ids array required' });
  }

  const count = await SpkCorrective.destroy({
    where: { spkId: { [Op.in]: ids } },
  });

  res.json({ message: `Deleted ${count} SPK(s)` });
};

// POST /api/corrective/spk/:spkId/upload-before-photos
// Teknisi uploads before work photos (1-2 photos, max 2MB each)
const uploadBeforePhotos = async (req, res) => {
  const spk = await SpkCorrective.findByPk(req.params.spkId);
  if (!spk) return res.status(404).json({ error: 'SPK Corrective not found' });

  const photos = req.files || [];
  if (photos.length < 1 || photos.length > 2) {
    return res.status(400).json({
      error: 'Please upload 1-2 photos (max 2MB each)'
    });
  }

  const t = await sequelize.transaction();
  try {
    for (const file of photos) {
      await SpkCorrectivePhoto.create({
        spkId: spk.spkId,
        photoType: 'before',
        photoPath: `uploads/corrective/${file.filename}`,
      }, { transaction: t });
    }

    await spk.update({ status: 'in_progress' }, { transaction: t });
    await Notification.update(
      { approvalStatus: 'eksekusi' },
      { where: { notificationId: spk.notificationId }, transaction: t }
    );

    await t.commit();

    const fresh = await SpkCorrective.findByPk(spk.spkId, { include: SPK_INCLUDE });
    res.json({
      message: 'Before work photos uploaded successfully',
      photos: fresh.photos.filter(p => p.photoType === 'before'),
    });
  } catch (err) {
    await t.rollback();
    throw err;
  }
};

// POST /api/corrective/spk/:spkId/upload-after-photos
// Teknisi uploads after work photos (1-2 photos, max 2MB each)
const uploadAfterPhotos = async (req, res) => {
  const spk = await SpkCorrective.findByPk(req.params.spkId);
  if (!spk) return res.status(404).json({ error: 'SPK Corrective not found' });

  const photos = req.files || [];
  if (photos.length < 1 || photos.length > 2) {
    return res.status(400).json({
      error: 'Please upload 1-2 photos (max 2MB each)'
    });
  }

  const t = await sequelize.transaction();
  try {
    for (const file of photos) {
      await SpkCorrectivePhoto.create({
        spkId: spk.spkId,
        photoType: 'after',
        photoPath: `uploads/corrective/${file.filename}`,
      }, { transaction: t });
    }

    await t.commit();

    const fresh = await SpkCorrective.findByPk(spk.spkId, { include: SPK_INCLUDE });
    res.json({
      message: 'After work photos uploaded successfully',
      photos: fresh.photos.filter(p => p.photoType === 'after'),
    });
  } catch (err) {
    await t.rollback();
    throw err;
  }
};

// PUT /api/corrective/spk/:spkId/update-by-teknisi
// Teknisi can update: actual_start_date, job_result_description, actual_worker,
// actual_hour_per_worker, total_actual_hour, items, apd_items
const updateByTeknisi = async (req, res) => {
  const spk = await SpkCorrective.findByPk(req.params.spkId);
  if (!spk) return res.status(404).json({ error: 'SPK Corrective not found' });

  const {
    actualStartDate,
    jobResultDescription,
    actualWorker,
    actualHourPerWorker,
    items,
    apdItems,
  } = req.body;

  // Calculate total actual hour
  const totalActualHour = actualWorker && actualHourPerWorker
    ? actualWorker * actualHourPerWorker
    : spk.totalActualHour;

  const t = await sequelize.transaction();
  try {
    await spk.update({
      actualStartDate: actualStartDate || spk.actualStartDate,
      jobResultDescription: jobResultDescription || spk.jobResultDescription,
      actualWorker: actualWorker ?? spk.actualWorker,
      actualHourPerWorker: actualHourPerWorker ?? spk.actualHourPerWorker,
      totalActualHour,
      status: 'awaiting_kadis_pusat',
    }, { transaction: t });

    // Update Notification status
    await Notification.update(
      { approvalStatus: 'menunggu_review_kadis_pp' },
      { where: { notificationId: spk.notificationId }, transaction: t }
    );

    // Add new items if provided
    if (items && items.length > 0) {
      for (const item of items) {
        await SpkCorrectiveItem.create({
          spkId: spk.spkId,
          itemType: item.itemType || 'material',
          itemName: item.itemName,
          quantity: item.quantity || 1,
          uom: item.uom || 'pcs',
        }, { transaction: t });
      }
    }

    await t.commit();

    const fresh = await SpkCorrective.findByPk(spk.spkId, { include: SPK_INCLUDE });
    res.json(fmtSpk(fresh));
  } catch (err) {
    await t.rollback();
    throw err;
  }
};


// POST /api/corrective/spk/:spkId/approve-kadis-pusat
const approveKadisPusat = async (req, res) => {
  const { userId } = req.user;
  const spk = await SpkCorrective.findByPk(req.params.spkId);

  if (!spk) return res.status(404).json({ error: 'SPK Corrective not found' });

  if (spk.status === 'completed' || spk.status === 'rejected') {
    return res.status(400).json({ error: `SPK is already ${spk.status}` });
  }

  if (spk.status !== 'awaiting_kadis_pusat') {
    return res.status(400).json({ error: 'SPK is not awaiting Kadis Pusat review' });
  }

  const now = new Date().toISOString();

  await spk.update({
    status: 'awaiting_kadis_pelapor',
    kadisPusatApprovedBy: userId,
    kadisPusatApprovedAt: now,
  });

  const fresh = await SpkCorrective.findByPk(spk.spkId, { include: SPK_INCLUDE });
  res.json(fmtSpk(fresh));
};

// POST /api/corrective/spk/:spkId/approve-kadis-pelapor
const approveKadisPelapor = async (req, res) => {
  const { userId } = req.user;
  const spk = await SpkCorrective.findByPk(req.params.spkId, {
    include: [{ model: Notification, as: 'notification' }],
  });

  if (!spk) return res.status(404).json({ error: 'SPK Corrective not found' });

  if (spk.status === 'completed' || spk.status === 'rejected') {
    return res.status(400).json({ error: `SPK is already ${spk.status}` });
  }

  if (spk.status !== 'awaiting_kadis_pelapor') {
    return res.status(400).json({ error: 'SPK is not awaiting Kadis Pelapor approval' });
  }

  const now = new Date().toISOString();

  const t = await sequelize.transaction();
  try {
    await spk.update({
      status: 'completed',
      kadisPelaporApprovedBy: userId,
      kadisPelaporApprovedAt: now,
    }, { transaction: t });

    // Update notification status to closed
    await Notification.update(
      { status: 'closed' },
      { where: { notificationId: spk.notificationId }, transaction: t }
    );

    await t.commit();

    const fresh = await SpkCorrective.findByPk(spk.spkId, { include: SPK_INCLUDE });
    res.json(fmtSpk(fresh));
  } catch (err) {
    await t.rollback();
    throw err;
  }
};

// POST /api/corrective/spk/:spkId/reject
const reject = async (req, res) => {
  const { userId } = req.user;
  const spk = await SpkCorrective.findByPk(req.params.spkId);

  if (!spk) return res.status(404).json({ error: 'SPK Corrective not found' });

  if (spk.status === 'completed') {
    return res.status(400).json({ error: 'Cannot reject completed SPK' });
  }

  if (spk.status === 'rejected') {
    return res.status(400).json({ error: 'SPK is already rejected' });
  }

  const now = new Date().toISOString();

  await spk.update({
    status: 'rejected',
    rejectedBy: userId,
    rejectedAt: now,
    rejectionNotes: req.body.notes || null,
  });

  const fresh = await SpkCorrective.findByPk(spk.spkId, { include: SPK_INCLUDE });
  res.json(fmtSpk(fresh));
};

// GET /api/corrective/spk/history
// Get completed and rejected SPK history for user's work center
const getHistory = async (req, res) => {
  const { userId, role, workCenter } = req.user;
  const where = { status: { [Op.in]: ['completed', 'rejected'] } };
  
  // Teknisi/Kasie - only see their work center history
  if (WORK_CENTER_ROLES.includes(role) && workCenter) {
    where.workCenter = workCenter;
  }
  
  // Kadis Pelapor - only see own reports, TAPI Kadis PP bisa lihat semua
  if (role === KADIS_ROLE) {
    const { dinas } = req.user;
    const isKadisPusat = dinas && dinas.toLowerCase().includes('pusat perawatan');
    
    if (!isKadisPusat) {
      const notifications = await Notification.findAll({
        where: { kadisPelaporId: userId },
        attributes: ['notificationId'],
      });
      const notificationIds = notifications.map(n => n.notificationId);
      where.notificationId = { [Op.in]: notificationIds };
    }
  }
  
  const data = await SpkCorrective.findAll({
    where,
    include: SPK_INCLUDE,
    order: [['createdDate', 'DESC']],
  });

  res.json(data.map(fmtSpk));
};

// PUT /api/corrective/spk/:spkId
// Planner can update SPK if status is still draft
const updateByPlanner = async (req, res) => {
  const spk = await SpkCorrective.findByPk(req.params.spkId);
  if (!spk) return res.status(404).json({ error: 'SPK Corrective not found' });

  if (spk.status !== 'draft') {
    return res.status(400).json({ error: 'Cannot edit SPK that is no longer in draft status' });
  }

  const {
    orderNumber,
    priority,
    equipmentId,
    location,
    requestedFinishDate,
    damageClassification,
    jobDescription,
    workCenter,
    ctrlKey,
    unit,
    plannedWorker,
    plannedHourPerWorker,
    items,
  } = req.body;

  const totalPlannedHour = plannedWorker && plannedHourPerWorker
    ? plannedWorker * plannedHourPerWorker
    : spk.totalPlannedHour;

  const t = await sequelize.transaction();
  try {
    await spk.update({
      orderNumber: orderNumber !== undefined ? orderNumber : spk.orderNumber,
      priority: priority !== undefined ? priority : spk.priority,
      equipmentId: equipmentId !== undefined ? equipmentId : spk.equipmentId,
      location: location !== undefined ? location : spk.location,
      requestedFinishDate: requestedFinishDate !== undefined ? requestedFinishDate : spk.requestedFinishDate,
      damageClassification: damageClassification !== undefined ? damageClassification : spk.damageClassification,
      jobDescription: jobDescription !== undefined ? jobDescription : spk.jobDescription,
      workCenter: workCenter !== undefined ? workCenter : spk.workCenter,
      ctrlKey: ctrlKey !== undefined ? ctrlKey : spk.ctrlKey,
      unit: unit !== undefined ? unit : spk.unit,
      plannedWorker: plannedWorker !== undefined ? plannedWorker : spk.plannedWorker,
      plannedHourPerWorker: plannedHourPerWorker !== undefined ? plannedHourPerWorker : spk.plannedHourPerWorker,
      totalPlannedHour: totalPlannedHour,
    }, { transaction: t });

    // Handle items (delete existing and insert new if provided)
    if (items && Array.isArray(items)) {
      await SpkCorrectiveItem.destroy({ where: { spkId: spk.spkId }, transaction: t });
      for (const item of items) {
        await SpkCorrectiveItem.create({
          spkId: spk.spkId,
          itemType: item.itemType || 'material',
          itemName: item.itemName,
          quantity: item.quantity || 1,
          uom: item.uom || 'pcs',
        }, { transaction: t });
      }
    }

    await t.commit();
    const fresh = await SpkCorrective.findByPk(spk.spkId, { include: SPK_INCLUDE });
    res.json(fmtSpk(fresh));
  } catch (err) {
    await t.rollback();
    throw err;
  }
};

module.exports = {
  getAll, getOne, create, remove, bulkDelete,
  uploadBeforePhotos, uploadAfterPhotos, updateByTeknisi,
  approveKadisPusat, approveKadisPelapor, reject,
  getHistory, updateByPlanner,
};
