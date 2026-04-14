'use strict';

const { Op } = require('sequelize');
const sequelize = require('../../config/database');
const { Spk, SpkEquipment, SpkActivity } = require('../../models/Spk');
const Equipment = require('../../models/Equipment');
const EquipmentIntervalMapping = require('../../models/EquipmentIntervalMapping');
const User = require('../../models/User');
const NotificationService = require('../../services/notificationService');
const { parseExcelBuffer, resolveIntervals, flagExisting, enrichOrders } = require('../../services/spkImportService');

const CATEGORY_GROUP_MAP = {
  Mekanik: 'Mekanik',
  Listrik: 'Elektrik',
  Sipil: 'Sipil',
  Otomasi: 'Otomasi',
};

const VALID_INTERVALS = ['1wk', '2wk', '4wk', '8wk', '12wk', '16wk', '24wk'];

/**
 * POST /api/spk/import/preview
 * req.file — multer memory buffer (field name: file)
 *
 * Returns { total, orders } where each order has been enriched with
 * interval/intervalResolution/intervalOptions (resolveIntervals) and
 * alreadyExists flag (flagExisting).
 */
const preview = async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded. Send an Excel file in the "file" field.' });
  }

  const orders = parseExcelBuffer(req.file.buffer);

  if (orders.length === 0) {
    return res.status(422).json({ error: 'Excel file parsed successfully but contained 0 orders.' });
  }

  await resolveIntervals(orders);
  await flagExisting(orders);
  await enrichOrders(orders);   // adds equipmentName, funcLocDesc, displayName, autoMapped

  res.json({ total: orders.length, orders });
};

/**
 * POST /api/spk/import/confirm
 * req.body = { orders: [...] }
 *
 * Validates, de-dupes, then creates Spk + SpkEquipment + SpkActivity rows
 * in a single transaction.
 *
 * Returns:
 *   { message, created, skipped, spkNumbers, skippedDetail }
 */
const confirm = async (req, res) => {
  const { orders } = req.body;

  if (!Array.isArray(orders) || orders.length === 0) {
    return res.status(400).json({ error: 'orders array is required and must not be empty.' });
  }

  // ── Per-order validation ─────────────────────────────────────────────────────
  const validOrders = [];
  const skippedDetail = [];

  for (const order of orders) {
    if (!order.orderNumber) {
      skippedDetail.push({ orderNumber: order.orderNumber ?? null, reason: 'missing orderNumber' });
      continue;
    }
    if (!VALID_INTERVALS.includes(order.interval)) {
      skippedDetail.push({ orderNumber: order.orderNumber, reason: `invalid interval '${order.interval}'. Must be one of: ${VALID_INTERVALS.join(', ')}` });
      continue;
    }
    if (!order.category) {
      skippedDetail.push({ orderNumber: order.orderNumber, reason: 'missing category' });
      continue;
    }
    validOrders.push(order);
  }

  if (validOrders.length === 0) {
    return res.status(422).json({
      message: 'No valid orders to import.',
      created: 0,
      skipped: skippedDetail.length,
      spkNumbers: [],
      skippedDetail,
    });
  }

  // ── Idempotency: check which orderNumbers already exist ──────────────────────
  const candidateNumbers = validOrders.map(o => o.orderNumber);
  const existingSpks = await Spk.findAll({
    where: { spkNumber: { [Op.in]: candidateNumbers } },
    attributes: ['spkNumber'],
  });
  const existingSet = new Set(existingSpks.map(s => s.spkNumber));

  const toCreate = [];
  for (const order of validOrders) {
    if (existingSet.has(order.orderNumber)) {
      skippedDetail.push({ orderNumber: order.orderNumber, reason: 'orderNumber already exists in spk table' });
    } else {
      toCreate.push(order);
    }
  }

  const createdNumbers = [];

  if (toCreate.length > 0) {
    // ── Bulk-fetch equipment names for all new orders ────────────────────────
    const equipmentIds = [...new Set(toCreate.map(o => o.equipmentId).filter(Boolean))];
    const equipmentRecords = await Equipment.findAll({
      where: { equipmentId: { [Op.in]: equipmentIds } },
      attributes: ['equipmentId', 'equipmentName'],
    });
    const equipmentNameMap = {};
    for (const eq of equipmentRecords) {
      equipmentNameMap[eq.equipmentId] = eq.equipmentName;
    }

    // ── Single transaction for all creates ───────────────────────────────────
    const t = await sequelize.transaction();
    try {
      for (const order of toCreate) {
        const spkNumber = order.orderNumber;

        // 1. Spk header
        await Spk.create({
          spkNumber,
          description: order.description ?? null,
          intervalPeriod: order.interval,
          category: order.category,
          scheduledDate: order.scheduledDate ?? null,
          status: 'pending',
        }, { transaction: t });

        // 2. SpkEquipment row (one per order in SAP IW38 import)
        // Sipil orders: equipmentId is null — use functionalLocation as identifier
        const spkEqId   = order.equipmentId ?? order.functionalLocation ?? null;
        const spkEqName = order.equipmentId
          ? (equipmentNameMap[order.equipmentId] ?? null)
          : (order.displayName ?? order.functionalLocation ?? null); // building name for Sipil

        if (spkEqId) {
          await SpkEquipment.create({
            spkNumber,
            equipmentId:       spkEqId,
            equipmentName:     spkEqName,
            functionalLocation: order.functionalLocation ?? null,
          }, { transaction: t });
        }

        // 3. SpkActivity rows — one per item in activitiesModel
        const activities = Array.isArray(order.activitiesModel) ? order.activitiesModel : [];
        for (const act of activities) {
          await SpkActivity.create({
            spkNumber,
            activityNumber: act.activityNumber,
            equipmentId:    spkEqId ?? null,
            operationText:  act.operationText ?? null,
            durationPlan:   null, // SAP Excel doesn't carry duration per activity
          }, { transaction: t });
        }

        createdNumbers.push(spkNumber);
      }

      await t.commit();
    } catch (err) {
      await t.rollback();
      throw err;
    }

    // ── Auto-save new equipment → task list mappings (interval = null until user fills it in) ──
    // Only for non-Sipil orders where autoMapped=true (description matched a task list in DB)
    // and the equipment had no prior mapping. Uses findOrCreate so re-imports are idempotent.
    const autoMappable = toCreate.filter(
      o => !o.isSipil && o.autoMapped && o.suggestedTaskList && o.equipmentId
        && o.intervalResolution === 'unknown'
    );
    for (const order of autoMappable) {
      await EquipmentIntervalMapping.findOrCreate({
        where: { equipmentId: order.equipmentId, taskListId: order.suggestedTaskList },
        defaults: { interval: null },
      });
    }
    if (autoMappable.length > 0) {
      console.log(`[spk-import] Auto-saved ${autoMappable.length} new equipment→task list mappings (interval pending)`);
    }
  }

  // Notify teknisi per category discipline
  if (createdNumbers.length > 0) {
    const categoryGroups = {};
    for (const order of toCreate.filter(o => createdNumbers.includes(o.orderNumber))) {
      if (!categoryGroups[order.category]) categoryGroups[order.category] = [];
      categoryGroups[order.category].push(order.orderNumber);
    }
    for (const [category, spkNums] of Object.entries(categoryGroups)) {
      const groupKeyword = CATEGORY_GROUP_MAP[category];
      if (!groupKeyword) continue;
      const teknisiUsers = await User.findAll({
        where: { role: 'teknisi', group: { [Op.like]: `%${groupKeyword}%` } },
        attributes: ['id'],
      });
      if (teknisiUsers.length > 0) {
        await NotificationService.notify({
          module: 'preventive',
          type: 'spk_created',
          title: 'Ada SPK Baru',
          body: `${spkNums.length} SPK ${category} baru telah diimport dari SAP`,
          data: { spkNumber: spkNums[0], deepLink: 'preventive/spk-detail' },
          recipientIds: teknisiUsers.map(u => u.id),
        });
      }
    }
  }

  const totalSkipped = skippedDetail.length;

  res.status(201).json({
    message: `${createdNumbers.length} SPK berhasil diimport, ${totalSkipped} dilewati.`,
    created: createdNumbers.length,
    skipped: totalSkipped,
    spkNumbers: createdNumbers,
    skippedDetail,
  });
};

module.exports = { preview, confirm };
