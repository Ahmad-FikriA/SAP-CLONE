'use strict';

const XLSX = require('xlsx');
const { Op } = require('sequelize');
const EquipmentIntervalMapping = require('../models/EquipmentIntervalMapping');
const PreventiveWeekSchedule = require('../models/PreventiveWeekSchedule');
const { Spk } = require('../models/Spk');

// ── Planner Group → category name ────────────────────────────────────────────
const PLANNER_GROUP_MAP = {
  '221': 'Mekanik',
  '222': 'Listrik',
  '223': 'Sipil',
  '224': 'Otomasi',
};

// ── Excel serial date → ISO date string ──────────────────────────────────────
// Excel serial 1 = 1900-01-01 (with Lotus 1-2-3 leap-year bug: serial 60 = 1900-02-28+1)
function excelSerialToIso(serial) {
  if (!serial || typeof serial !== 'number') return null;
  // XLSX uses JS Date internally; use XLSX.SSF.parse_date_code for accurate conversion
  const info = XLSX.SSF.parse_date_code(serial);
  if (!info) return null;
  const y = String(info.y).padStart(4, '0');
  const m = String(info.m).padStart(2, '0');
  const d = String(info.d).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

// ── ISO week calculation (replicated from spkController.js getISOWeek) ────────
function isoToWeek(dateStr) {
  if (!dateStr) return { weekNumber: null, weekYear: null };
  const d = new Date(dateStr + 'T00:00:00Z');
  const thu = new Date(d);
  thu.setUTCDate(d.getUTCDate() + (4 - (d.getUTCDay() || 7)));
  const yearStart = new Date(Date.UTC(thu.getUTCFullYear(), 0, 4));
  const jan4Day = yearStart.getUTCDay() || 7;
  const week1Mon = new Date(yearStart);
  week1Mon.setUTCDate(yearStart.getUTCDate() - (jan4Day - 1));
  const weekNumber = Math.floor((thu - week1Mon) / (7 * 86400000)) + 1;
  return { weekNumber, weekYear: thu.getUTCFullYear() };
}

// ── Normalise a raw header string to a lookup key ────────────────────────────
function normaliseHeader(h) {
  return String(h ?? '').toLowerCase().trim();
}

/**
 * parseExcelBuffer(buffer)
 * Synchronous. Parses a SAP IW38 Excel export buffer.
 * Returns an array of order objects grouped by Order column.
 *
 * Each object:
 * {
 *   orderNumber, description, scheduledDate, category,
 *   equipmentId, functionalLocation,
 *   activitiesModel: [{ activityNumber, operationText }, ...]
 * }
 */
function parseExcelBuffer(buffer) {
  const workbook = XLSX.read(buffer, { type: 'buffer', cellDates: false });
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];

  // Convert to row-of-objects array; raw:true keeps numeric date serials
  const rows = XLSX.utils.sheet_to_json(sheet, { raw: true, defval: '' });

  if (!rows.length) return [];

  // Build a header-normalised key map from the first row's keys
  // (sheet_to_json uses the first row as headers automatically)
  const sampleKeys = Object.keys(rows[0]);
  const keyMap = {}; // normalised → original key
  for (const k of sampleKeys) {
    keyMap[normaliseHeader(k)] = k;
  }

  // Helper to pull a value by normalised header name
  const get = (row, normKey) => {
    const orig = keyMap[normKey];
    return orig !== undefined ? row[orig] : '';
  };

  // Group rows by Order number
  const orderMap = new Map(); // orderNumber → order object

  for (const row of rows) {
    const orderNumber = String(get(row, 'order') ?? '').trim();
    if (!orderNumber) continue;

    const activityRaw = String(get(row, 'activity') ?? '').trim();

    // Skip the SAP header operation (0010)
    if (activityRaw === '0010') continue;

    if (!orderMap.has(orderNumber)) {
      // Parse scheduled date — may be an Excel serial number or already a string
      const dateRaw = get(row, 'bas. start date');
      let scheduledDate = null;
      if (typeof dateRaw === 'number') {
        scheduledDate = excelSerialToIso(dateRaw);
      } else if (typeof dateRaw === 'string' && dateRaw.trim()) {
        // Try to handle string dates like "13.04.2026" (DD.MM.YYYY) or "2026-04-13"
        const s = dateRaw.trim();
        if (/^\d{2}\.\d{2}\.\d{4}$/.test(s)) {
          const [dd, mm, yyyy] = s.split('.');
          scheduledDate = `${yyyy}-${mm}-${dd}`;
        } else {
          scheduledDate = s.slice(0, 10); // take ISO portion
        }
      }

      const plannerGroupRaw = String(get(row, 'planner group') ?? '').trim();
      const category = PLANNER_GROUP_MAP[plannerGroupRaw] ?? plannerGroupRaw;

      orderMap.set(orderNumber, {
        orderNumber,
        description: String(get(row, 'description') ?? '').trim(),
        scheduledDate,
        category,
        equipmentId: String(get(row, 'equipment') ?? '').trim(),
        functionalLocation: String(get(row, 'functional loc.') ?? '').trim(),
        activitiesModel: [],
      });
    }

    // Add activity if it has an activity number and op text
    const operationText = String(get(row, 'op. short text') ?? '').trim();
    if (activityRaw) {
      orderMap.get(orderNumber).activitiesModel.push({
        activityNumber: activityRaw,
        operationText,
      });
    }
  }

  return Array.from(orderMap.values());
}

/**
 * resolveIntervals(orders)
 * Async. Mutates each order in-place, adding:
 *   interval, intervalResolution, intervalOptions
 *
 * Uses 2 bulk DB queries total (not N queries).
 */
async function resolveIntervals(orders) {
  if (!orders.length) return;

  // Collect all unique equipmentIds
  const equipmentIds = [...new Set(orders.map(o => o.equipmentId).filter(Boolean))];

  // Query 1: all intervals registered for these equipment IDs
  const mappings = await EquipmentIntervalMapping.findAll({
    where: { equipmentId: { [Op.in]: equipmentIds } },
    attributes: ['equipmentId', 'interval'],
  });

  // Build map: equipmentId → Set of intervals
  const equipIntervals = {}; // equipmentId → Set<interval>
  for (const m of mappings) {
    if (!equipIntervals[m.equipmentId]) equipIntervals[m.equipmentId] = new Set();
    equipIntervals[m.equipmentId].add(m.interval);
  }

  // Collect all (weekNumber, weekYear) pairs needed
  const weekKeys = new Set();
  const orderWeekMap = {}; // orderNumber → { weekNumber, weekYear }
  for (const order of orders) {
    const { weekNumber, weekYear } = isoToWeek(order.scheduledDate);
    orderWeekMap[order.orderNumber] = { weekNumber, weekYear };
    if (weekNumber !== null && weekYear !== null) {
      weekKeys.add(`${weekYear}:${weekNumber}`);
    }
  }

  // Query 2: all schedule rows matching any of the needed week/year combos
  const weekConditions = [];
  for (const key of weekKeys) {
    const [yr, wk] = key.split(':').map(Number);
    weekConditions.push({ year: yr, weekNumber: wk });
  }

  let weekIntervals = {}; // `${year}:${weekNumber}` → Set<interval>
  if (weekConditions.length) {
    const schedules = await PreventiveWeekSchedule.findAll({
      where: { [Op.or]: weekConditions },
      attributes: ['year', 'weekNumber', 'interval'],
    });
    for (const s of schedules) {
      const k = `${s.year}:${s.weekNumber}`;
      if (!weekIntervals[k]) weekIntervals[k] = new Set();
      weekIntervals[k].add(s.interval);
    }
  }

  // Resolve each order
  for (const order of orders) {
    const { weekNumber, weekYear } = orderWeekMap[order.orderNumber];
    const equipSet = equipIntervals[order.equipmentId] || new Set();
    const weekKey = weekNumber !== null ? `${weekYear}:${weekNumber}` : null;
    const schedSet = (weekKey && weekIntervals[weekKey]) ? weekIntervals[weekKey] : new Set();

    // Intersection
    const matches = [...equipSet].filter(iv => schedSet.has(iv));

    if (matches.length === 1) {
      order.interval = matches[0];
      order.intervalResolution = 'auto';
      order.intervalOptions = [matches[0]];
    } else if (matches.length > 1) {
      order.interval = null;
      order.intervalResolution = 'ambiguous';
      order.intervalOptions = matches;
    } else {
      order.interval = null;
      order.intervalResolution = 'unknown';
      order.intervalOptions = [];
    }
  }
}

/**
 * flagExisting(orders)
 * Async. Mutates each order in-place, adding:
 *   alreadyExists: boolean
 *
 * Checks spk table: spkNumber = order.orderNumber
 */
async function flagExisting(orders) {
  if (!orders.length) return;

  const orderNumbers = orders.map(o => o.orderNumber).filter(Boolean);

  const existing = await Spk.findAll({
    where: { spkNumber: { [Op.in]: orderNumbers } },
    attributes: ['spkNumber'],
  });

  const existingSet = new Set(existing.map(s => s.spkNumber));

  for (const order of orders) {
    order.alreadyExists = existingSet.has(order.orderNumber);
  }
}

module.exports = { parseExcelBuffer, resolveIntervals, flagExisting };
