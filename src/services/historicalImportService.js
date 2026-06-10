'use strict';

const XLSX = require('xlsx');
const { Op } = require('sequelize');
const sequelize = require('../config/database');
const { Spk, SpkEquipment, SpkActivity } = require('../models/Spk');
const Equipment = require('../models/Equipment');
const { detectKadisFromFuncLoc } = require('./spkImportService');

const PLANNER_GROUP_MAP = { '221': 'Mekanik', '222': 'Listrik', '223': 'Sipil', '224': 'Otomasi' };

function normaliseHeader(h) {
  return String(h ?? '').toLowerCase().trim();
}

/**
 * parseHistoricalBuffer(buffer)
 * Reads standard SAP IW38 Excel export.
 * Detects SUDAH/BELUM from System Status: contains 'TECO' = done.
 * Returns array of order objects.
 */
function parseHistoricalBuffer(buffer) {
  const workbook = XLSX.read(buffer, { type: 'buffer', cellDates: false });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(sheet, { raw: true, defval: '' });
  if (!rows.length) return [];

  const sampleKeys = Object.keys(rows[0]);
  const keyMap = {};
  for (const k of sampleKeys) keyMap[normaliseHeader(k)] = k;
  const get = (row, normKey) => {
    const orig = keyMap[normKey];
    return orig !== undefined ? row[orig] : '';
  };

  const orderMap = new Map();

  for (const row of rows) {
    const orderNumber = String(get(row, 'order') ?? '').trim();
    if (!orderNumber) continue;

    if (!orderMap.has(orderNumber)) {
      // Parse scheduled date
      const dateRaw = get(row, 'bas. start date');
      let scheduledDate = null;
      if (typeof dateRaw === 'number') {
        const info = XLSX.SSF.parse_date_code(dateRaw);
        if (info) {
          scheduledDate = `${String(info.y).padStart(4,'0')}-${String(info.m).padStart(2,'0')}-${String(info.d).padStart(2,'0')}`;
        }
      } else if (typeof dateRaw === 'string' && dateRaw.trim()) {
        const s = dateRaw.trim();
        scheduledDate = /^\d{2}\.\d{2}\.\d{4}$/.test(s)
          ? `${s.slice(6)}-${s.slice(3,5)}-${s.slice(0,2)}`
          : s.slice(0, 10);
      }

      // Detect SUDAH from System Status — TECO means technically completed
      const systemStatusRaw = String(get(row, 'system status') ?? '').trim();
      const sudah = systemStatusRaw.toUpperCase().includes('TECO');

      const plannerGroupRaw = String(get(row, 'planner group') ?? '').trim();
      const category = PLANNER_GROUP_MAP[plannerGroupRaw] ?? null;

      const rawEquipmentId = String(get(row, 'equipment') ?? '').trim();
      const rawFuncLoc     = String(get(row, 'functional loc.') ?? '').trim();
      const isSipil        = !rawEquipmentId && !!rawFuncLoc;

      orderMap.set(orderNumber, {
        orderNumber,
        description:        String(get(row, 'description') ?? '').trim(),
        scheduledDate,
        category,
        equipmentId:        isSipil ? null : (rawEquipmentId || null),
        functionalLocation: rawFuncLoc,
        systemStatus:       systemStatusRaw || null,
        costCenter:         String(get(row, 'cost center') ?? '').trim() || null,
        operWorkCtr:        String(get(row, 'oper.workcenter') ?? '').trim() || null,
        isSipil,
        sudah,
        activitiesModel: [],
      });
    }

    const activityRaw   = String(get(row, 'activity') ?? '').trim();
    const operationText = String(get(row, 'op. short text') ?? '').trim();
    const controlKey    = String(get(row, 'control key') ?? '').trim() || null;
    if (activityRaw && operationText) {
      orderMap.get(orderNumber).activitiesModel.push({ activityNumber: activityRaw, operationText, controlKey });
    }
  }

  return Array.from(orderMap.values());
}

/**
 * importHistorical(orders)
 * Bulk-inserts historical SPKs. Skips duplicates.
 * Returns { imported, closed, tunggakan, skipped, skippedDetail }
 */
async function importHistorical(orders) {
  const orderNumbers = orders.map(o => String(o.orderNumber).trim());

  const existing = await Spk.findAll({
    where: { spkNumber: { [Op.in]: orderNumbers } },
    attributes: ['spkNumber'],
    raw: true,
  });
  const existingSet = new Set(existing.map(s => String(s.spkNumber).trim()));

  const toCreate      = orders.filter(o => !existingSet.has(String(o.orderNumber).trim()));
  const skippedDetail = orders
    .filter(o => existingSet.has(String(o.orderNumber).trim()))
    .map(o => ({ orderNumber: o.orderNumber, reason: 'already exists' }));

  const equipmentIds = [...new Set(toCreate.map(o => o.equipmentId).filter(Boolean))];
  const eqRecords = equipmentIds.length
    ? await Equipment.findAll({ where: { equipmentId: { [Op.in]: equipmentIds } }, attributes: ['equipmentId', 'equipmentName'] })
    : [];
  const eqMap = Object.fromEntries(eqRecords.map(e => [e.equipmentId, e.equipmentName]));

  let closed = 0, tunggakan = 0;

  const t = await sequelize.transaction();
  try {
    for (const order of toCreate) {
      const isSudah = order.sudah;

      await Spk.create({
        spkNumber:    String(order.orderNumber).trim(),
        description:  order.description || null,
        category:     order.category    || null,
        scheduledDate: order.scheduledDate ?? null,
        status:       isSudah ? 'approved' : 'pending',
        source:       'manual_import',
        systemStatus: order.systemStatus ?? null,
        costCenter:   order.costCenter   ?? null,
        operWorkCtr:  order.operWorkCtr  ?? null,
        kadisArea:    detectKadisFromFuncLoc(order.functionalLocation) || null,
        evaluasi:     isSudah ? 'Dikerjakan secara manual sebelum sistem MANTIS' : null,
      }, { transaction: t });

      const eqId   = order.equipmentId ?? order.functionalLocation ?? null;
      const eqName = order.equipmentId
        ? (eqMap[order.equipmentId] ?? null)
        : (order.functionalLocation ?? null);

      if (eqId) {
        await SpkEquipment.create({
          spkNumber:          String(order.orderNumber).trim(),
          equipmentId:        eqId,
          equipmentName:      eqName,
          functionalLocation: order.functionalLocation ?? null,
          plantName:          null,
        }, { transaction: t });
      }

      if (order.activitiesModel?.length) {
        await SpkActivity.bulkCreate(
          order.activitiesModel.map(a => ({
            spkNumber:      String(order.orderNumber).trim(),
            activityNumber: a.activityNumber,
            operationText:  a.operationText,
            controlKey:     a.controlKey ?? null,
            equipmentId:    eqId,
          })),
          { transaction: t }
        );
      }

      isSudah ? closed++ : tunggakan++;
    }
    await t.commit();
  } catch (err) {
    await t.rollback();
    throw err;
  }

  return { imported: toCreate.length, closed, tunggakan, skipped: skippedDetail.length, skippedDetail };
}

module.exports = { parseHistoricalBuffer, importHistorical };
