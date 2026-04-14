'use strict';

const XLSX = require('xlsx');
const { Op } = require('sequelize');
const EquipmentIntervalMapping = require('../models/EquipmentIntervalMapping');
const SipilFunclocMapping = require('../models/SipilFunclocMapping');
const Equipment = require('../models/Equipment');
const FunctionalLocation = require('../models/FunctionalLocation');
const { GeneralTaskList } = require('../models/GeneralTaskList');
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

      const rawEquipmentId = String(get(row, 'equipment') ?? '').trim();
      const rawFuncLoc     = String(get(row, 'functional loc.') ?? '').trim();

      // Sipil: equipment column empty but FuncLoc present — building is the subject
      const isSipil      = !rawEquipmentId && !!rawFuncLoc;
      const equipmentId  = isSipil ? null : (rawEquipmentId || null);

      orderMap.set(orderNumber, {
        orderNumber,
        description: String(get(row, 'description') ?? '').trim(),
        scheduledDate,
        category,
        equipmentId,
        functionalLocation: rawFuncLoc,
        isSipil,
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
 * Resolves solely from equipment_interval_mappings (single bulk query).
 * We trust SAP's schedule for which equipment is due — no week schedule
 * cross-reference needed. If equipment has one mapping → auto. Multiple → ambiguous.
 */
async function resolveIntervals(orders) {
  if (!orders.length) return;

  // ── Sipil orders: look up interval + task list from SipilFunclocMapping ──────
  const sipilFuncLocs = [...new Set(orders.filter(o => o.isSipil).map(o => o.functionalLocation).filter(Boolean))];
  const sipilRows = sipilFuncLocs.length
    ? await SipilFunclocMapping.findAll({ where: { funcLocId: { [Op.in]: sipilFuncLocs } }, attributes: ['funcLocId', 'interval', 'taskListId'] })
    : [];
  const sipilMap = Object.fromEntries(sipilRows.map(s => [s.funcLocId, s]));

  for (const order of orders.filter(o => o.isSipil)) {
    const sipil = sipilMap[order.functionalLocation];
    order.interval           = sipil?.interval || '1wk';  // Sipil is always 1wk
    order.taskListId         = sipil?.taskListId || null;
    order.intervalResolution = 'auto';
    order.intervalOptions    = [order.interval];
  }

  // ── Regular equipment: look up from EquipmentIntervalMapping ─────────────
  const equipmentIds = [...new Set(orders.filter(o => !o.isSipil).map(o => o.equipmentId).filter(Boolean))];

  const mappings = await EquipmentIntervalMapping.findAll({
    where: { equipmentId: { [Op.in]: equipmentIds } },
    attributes: ['equipmentId', 'interval', 'taskListId'],
  });

  // equipmentId → array of { interval, taskListId }
  const equipMappings = {};
  for (const m of mappings) {
    if (!equipMappings[m.equipmentId]) equipMappings[m.equipmentId] = [];
    equipMappings[m.equipmentId].push({ interval: m.interval, taskListId: m.taskListId });
  }

  for (const order of orders.filter(o => !o.isSipil)) {
    const entries = equipMappings[order.equipmentId] || [];
    // Separate fully-mapped (have interval) from partial (task list only, no interval yet)
    const full    = entries.filter(e => e.interval);
    const partial = entries.filter(e => !e.interval);

    if (full.length === 1) {
      order.interval           = full[0].interval;
      order.taskListId         = full[0].taskListId || null;
      order.intervalResolution = 'auto';
      order.intervalOptions    = full.map(e => e.interval);
    } else if (full.length > 1) {
      order.interval           = null;
      order.taskListId         = null;
      order.intervalResolution = 'ambiguous';
      order.intervalOptions    = full.map(e => e.interval);
    } else if (partial.length > 0) {
      // Task list saved from a previous auto-learn, but interval not yet filled in
      order.interval           = null;
      order.taskListId         = partial[0].taskListId || null;
      order.intervalResolution = 'partial';   // needs interval
      order.intervalOptions    = [];
    } else {
      order.interval           = null;
      order.taskListId         = null;
      order.intervalResolution = 'unknown';
      order.intervalOptions    = [];
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

/**
 * enrichOrders(orders)
 * Async. Mutates each order in-place, adding:
 *   equipmentName    — from Equipment table (null if not found)
 *   funcLocDesc      — FuncLoc description from FunctionalLocation table
 *   displayName      — resolved display name (equipmentName, or funcLocDesc for Sipil)
 *   autoMapped       — true if task list was auto-detected from description (unmapped equipment)
 *   suggestedTaskList — KTI_XXXX code if auto-detected, null otherwise
 *
 * For Sipil orders (isSipil=true):
 *   - displayName = FuncLoc description (building name)
 *   - equipmentId stays null
 *
 * For unmapped non-Sipil orders (intervalResolution='unknown'):
 *   - Tries to match description against GeneralTaskList.taskListName
 *   - If matched, sets autoMapped=true + suggestedTaskList
 *   - Does NOT save to DB (interval unknown; user fills in Equipment Mappings sheet)
 */
async function enrichOrders(orders) {
  if (!orders.length) return;

  // ── 1. Bulk-fetch equipment names ──────────────────────────────────────────
  const equipIds = [...new Set(orders.map(o => o.equipmentId).filter(Boolean))];
  const equipRows = equipIds.length
    ? await Equipment.findAll({ where: { equipmentId: { [Op.in]: equipIds } }, attributes: ['equipmentId', 'equipmentName'] })
    : [];
  const equipNameMap = Object.fromEntries(equipRows.map(e => [e.equipmentId, e.equipmentName]));

  // ── 2. Bulk-fetch FuncLoc descriptions (FunctionalLocation + Sipil building names) ──
  const funcLocIds = [...new Set(orders.map(o => o.functionalLocation).filter(Boolean))];
  const flRows = funcLocIds.length
    ? await FunctionalLocation.findAll({ where: { funcLocId: { [Op.in]: funcLocIds } }, attributes: ['funcLocId', 'description'] })
    : [];
  const flDescMap = Object.fromEntries(flRows.map(f => [f.funcLocId, f.description]));

  // Also look up Sipil building names from SipilFunclocMapping (not in FunctionalLocation table)
  const sipilFuncLocIds = [...new Set(orders.filter(o => o.isSipil).map(o => o.functionalLocation).filter(Boolean))];
  const sipilNameRows = sipilFuncLocIds.length
    ? await SipilFunclocMapping.findAll({ where: { funcLocId: { [Op.in]: sipilFuncLocIds } }, attributes: ['funcLocId', 'name'] })
    : [];
  for (const s of sipilNameRows) {
    if (!flDescMap[s.funcLocId]) flDescMap[s.funcLocId] = s.name; // fill gap if not in FunctionalLocation
  }

  // ── 3. Collect unique descriptions for unmapped equipment (auto-learn) ──────
  const unmappedDescriptions = [...new Set(
    orders
      .filter(o => !o.isSipil && o.intervalResolution === 'unknown' && o.description)
      .map(o => o.description)
  )];

  // Bulk-match against GeneralTaskList — partial LIKE per description
  const taskListMatchMap = {}; // description → taskListId
  if (unmappedDescriptions.length) {
    const allTaskLists = await GeneralTaskList.findAll({ attributes: ['taskListId', 'taskListName'] });
    for (const desc of unmappedDescriptions) {
      const descUpper = desc.toUpperCase().trim();
      // Require exact match or that the task list BASE name (before parenthesis)
      // equals the description exactly — avoid "PREV POMPA" matching "PREV POMPA VAKUM"
      const match = allTaskLists.find(tl => {
        const baseName = tl.taskListName.toUpperCase().split('(')[0].trim();
        return baseName === descUpper || tl.taskListName.toUpperCase() === descUpper;
      });
      if (match) taskListMatchMap[desc] = match.taskListId;
    }
  }

  // ── 4. Apply to each order ─────────────────────────────────────────────────
  for (const order of orders) {
    const funcLocDesc = flDescMap[order.functionalLocation] || null;

    if (order.isSipil) {
      // Sipil: building name is the display name
      order.equipmentName  = null;
      order.funcLocDesc    = funcLocDesc || order.functionalLocation;
      order.displayName    = funcLocDesc || order.functionalLocation;
      order.autoMapped     = false;
      order.suggestedTaskList = null;
    } else {
      const equipmentName = equipNameMap[order.equipmentId] || null;
      order.equipmentName  = equipmentName;
      order.funcLocDesc    = funcLocDesc;
      order.displayName    = equipmentName || order.equipmentId;

      if (order.intervalResolution === 'auto' && order.taskListId) {
        // Fully mapped in DB — task list + interval both known
        order.autoMapped        = false;
        order.suggestedTaskList = order.taskListId;
      } else if (order.intervalResolution === 'partial' && order.taskListId) {
        // Task list saved from previous import, interval still missing
        order.autoMapped        = false;
        order.suggestedTaskList = order.taskListId;
      } else if (order.intervalResolution === 'unknown' && order.description) {
        // Unmapped equipment — try to suggest task list from description match
        const suggested = taskListMatchMap[order.description] || null;
        order.autoMapped        = !!suggested;
        order.suggestedTaskList = suggested;
      } else {
        order.autoMapped        = false;
        order.suggestedTaskList = null;
      }
    }
  }
}

module.exports = { parseExcelBuffer, resolveIntervals, flagExisting, enrichOrders };
