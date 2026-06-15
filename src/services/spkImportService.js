'use strict';

const XLSX = require('xlsx');
const { Op } = require('sequelize');
const EquipmentIntervalMapping = require('../models/EquipmentIntervalMapping');
const SipilFunclocMapping = require('../models/SipilFunclocMapping');
const Equipment = require('../models/Equipment');
const FunctionalLocation = require('../models/FunctionalLocation');
const Plant = require('../models/Plant');
const { GeneralTaskList } = require('../models/GeneralTaskList');
const { Spk } = require('../models/Spk');
const PreventiveWeekSchedule = require('../models/PreventiveWeekSchedule');


const PLANNER_GROUP_MAP = {
  '221': 'Mekanik',
  '222': 'Listrik',
  '223': 'Sipil',
  '224': 'Otomasi',
};



function excelSerialToIso(serial) {
  if (!serial || typeof serial !== 'number') return null;

  const info = XLSX.SSF.parse_date_code(serial);
  if (!info) return null;
  const y = String(info.y).padStart(4, '0');
  const m = String(info.m).padStart(2, '0');
  const d = String(info.d).padStart(2, '0');
  return `${y}-${m}-${d}`;
}


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


function normaliseHeader(h) {
  return String(h ?? '').toLowerCase().trim();
}

// ── Duration Plan header aliases (SAP exports vary: "Duration Plan" / "Duration P") ──
const DURATION_PLAN_HEADERS = ['duration plan', 'duration p', 'dur. plan', 'dur plan'];

// ── Parse a duration cell — may be a number, numeric string, or empty ─────────
// Returns null when empty/absent (the fallback) so the column is optional.
function parseDuration(val) {
  if (val === null || val === undefined || val === '') return null;
  const n = typeof val === 'number' ? val : parseFloat(String(val).replace(',', '.'));
  return Number.isFinite(n) ? n : null;
}

// ── FuncLoc prefix → Kadis area ID (per-order, handles mixed-plant files) ────
// Longer prefixes (kadis_keamanan) must come first — A-A1-01-006 would otherwise
// match the shorter A-A1-01 prefix of kadis_airbaku before being checked.
const FUNCLOC_KADIS_MAP = [
  { id: 'kadis_keamanan',           prefixes: ['A-A1-01-006', 'A-A1-02-006', 'A-A1-03-004'] },
  { id: 'kadis_krenceng',           prefixes: ['A-A2-01'] },
  { id: 'kadis_airbaku',            prefixes: ['A-A1-01', 'A-A1-03'] },
  { id: 'kadis_cipasauran_cidanau', prefixes: ['A-A1-02', 'A-A2-09'] },
];

function detectKadisFromFuncLoc(functionalLocation) {
  if (!functionalLocation) return null;
  for (const area of FUNCLOC_KADIS_MAP) {
    if (area.prefixes.some(p => functionalLocation.startsWith(p))) return area.id;
  }
  return null;
}

// ── SAP Location code → Kadis area ID ────────────────────────────────────────
// The "Location" column in SAP IW38 exports contains site codes like P-22L006.
// These are direct KTI plant section codes — map them explicitly.
const LOCATION_CODE_KADIS_MAP = {
  'P-22L006': 'kadis_cipasauran_cidanau',
  'P-22L007': 'kadis_krenceng',
  'P-22L008': 'kadis_airbaku',
  'P-22L009': 'kadis_keamanan',
};

function detectKadisFromLocationCode(locationCode) {
  if (!locationCode) return null;

  if (LOCATION_CODE_KADIS_MAP[locationCode]) return LOCATION_CODE_KADIS_MAP[locationCode];

  for (const [code, kadisId] of Object.entries(LOCATION_CODE_KADIS_MAP)) {
    if (locationCode.startsWith(code.slice(0, 6))) return kadisId;
  }
  return null;
}


function parseExcelBuffer(buffer) {
  const workbook = XLSX.read(buffer, { type: 'buffer', cellDates: false });

  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];


  const rows = XLSX.utils.sheet_to_json(sheet, { raw: true, defval: '' });

  if (!rows.length) return { orders: [], locationCode: null, detectedKadisId: null };


  const sampleKeys = Object.keys(rows[0]);
  const keyMap = {};
  for (const k of sampleKeys) {
    keyMap[normaliseHeader(k)] = k;
  }


  const get = (row, normKey) => {
    const orig = keyMap[normKey];
    return orig !== undefined ? row[orig] : '';
  };

  // Helper to pull a value by the first matching header from a list of aliases
  const getAny = (row, normKeys) => {
    for (const nk of normKeys) {
      const orig = keyMap[nk];
      if (orig !== undefined) return row[orig];
    }
    return '';
  };

  // Read the Location code from the first data row (same value on every row in a file)
  const locationCode  = String(get(rows[0], 'location') ?? '').trim() || null;
  const detectedKadisId = detectKadisFromLocationCode(locationCode);


  const orderMap = new Map();

  for (const row of rows) {
    const orderNumber = String(get(row, 'order') ?? '').trim();
    if (!orderNumber) continue;

    const activityRaw = String(get(row, 'activity') ?? '').trim();

    if (activityRaw === '0010') continue;
    if (!orderMap.has(orderNumber)) {

      const dateRaw = get(row, 'bas. start date');
      let scheduledDate = null;
      if (typeof dateRaw === 'number') {
        scheduledDate = excelSerialToIso(dateRaw);
      } else if (typeof dateRaw === 'string' && dateRaw.trim()) {

        const s = dateRaw.trim();
        if (/^\d{2}\.\d{2}\.\d{4}$/.test(s)) {
          const [dd, mm, yyyy] = s.split('.');
          scheduledDate = `${yyyy}-${mm}-${dd}`;
        } else {
          scheduledDate = s.slice(0, 10);
        }
      }

      const plannerGroupRaw = String(get(row, 'planner group') ?? '').trim();
      const category = PLANNER_GROUP_MAP[plannerGroupRaw] ?? plannerGroupRaw;

      const rawEquipmentId = String(get(row, 'equipment') ?? '').trim();
      const rawFuncLoc     = String(get(row, 'functional loc.') ?? '').trim();


      const isSipil      = !rawEquipmentId && !!rawFuncLoc;
      const equipmentId  = isSipil ? null : (rawEquipmentId || null);

      // Read Location per-order row — Sipil files mix multiple plants in one file
      const rowLocationCode = String(get(row, 'location') ?? '').trim() || null;

      orderMap.set(orderNumber, {
        orderNumber,
        description: String(get(row, 'description') ?? '').trim(),
        scheduledDate,
        category,
        equipmentId,
        functionalLocation: rawFuncLoc,
        locationCode: rowLocationCode,
        isSipil,
        systemStatus: String(get(row, 'system status') ?? '').trim() || null,
        costCenter:   String(get(row, 'cost center') ?? '').trim() || null,
        operWorkCtr:  String(get(row, 'oper.workcenter') ?? '').trim() || null,
        activitiesModel: [],
      });
    }

    const operationText = String(get(row, 'op. short text') ?? '').trim();
    const controlKey    = String(get(row, 'control key') ?? '').trim() || null;
    const durationPlan  = parseDuration(getAny(row, DURATION_PLAN_HEADERS));
    const rawConfirmation = get(row, 'confirmation');
    let confirmation = null;
    if (rawConfirmation !== null && rawConfirmation !== undefined && rawConfirmation !== '') {
      const parsed = parseInt(String(rawConfirmation).trim(), 10);
      if (Number.isInteger(parsed)) {
        confirmation = parsed;
      }
    }
    if (activityRaw) {
      orderMap.get(orderNumber).activitiesModel.push({
        activityNumber: activityRaw,
        operationText,
        controlKey,
        durationPlan,
        confirmation,
      });
    }
  }

  return { orders: Array.from(orderMap.values()), locationCode, detectedKadisId };
}


async function resolveIntervals(orders) {
  if (!orders.length) return;

  
  const sipilFuncLocs = [...new Set(orders.filter(o => o.isSipil).map(o => o.functionalLocation).filter(Boolean))];
  const sipilRows = sipilFuncLocs.length
    ? await SipilFunclocMapping.findAll({ where: { funcLocId: { [Op.in]: sipilFuncLocs } }, attributes: ['funcLocId', 'interval', 'taskListId', 'plantId'] })
    : [];
  const sipilMap = Object.fromEntries(sipilRows.map(s => [s.funcLocId, s]));

  for (const order of orders.filter(o => o.isSipil)) {
    const sipil = sipilMap[order.functionalLocation];
    order.interval           = sipil?.interval || '1wk';
    order.taskListId         = sipil?.taskListId || null;
    order.plantId            = sipil?.plantId || null;    // plant from mapping table
    order.intervalResolution = 'auto';
    order.intervalOptions    = [order.interval];
  }

  
  const equipmentIds = [...new Set(orders.filter(o => !o.isSipil).map(o => o.equipmentId).filter(Boolean))];

  const mappings = await EquipmentIntervalMapping.findAll({
    where: { equipmentId: { [Op.in]: equipmentIds } },
    attributes: ['equipmentId', 'interval', 'taskListId'],
  });


  const equipMappings = {};
  for (const m of mappings) {
    if (!equipMappings[m.equipmentId]) equipMappings[m.equipmentId] = [];
    equipMappings[m.equipmentId].push({ interval: m.interval, taskListId: m.taskListId });
  }

  for (const order of orders.filter(o => !o.isSipil)) {
    const entries = equipMappings[order.equipmentId] || [];

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

      order._fullEntries       = full;
    } else if (partial.length > 0) {

      order.interval           = null;
      order.taskListId         = partial[0].taskListId || null;
      order.intervalResolution = 'partial';
      order.intervalOptions    = [];
    } else {
      order.interval           = null;
      order.taskListId         = null;
      order.intervalResolution = 'unknown';
      order.intervalOptions    = [];
    }
  }

  

  const ambiguousOrders = orders.filter(
    o => !o.isSipil && o.intervalResolution === 'ambiguous' && o.scheduledDate
  );

  if (ambiguousOrders.length > 0) {

    const weekKeys = new Set();
    for (const order of ambiguousOrders) {
      const { weekNumber, weekYear } = isoToWeek(order.scheduledDate);
      if (weekNumber && weekYear) weekKeys.add(`${weekYear}-${weekNumber}`);
    }


    const weekScheduleRows = await PreventiveWeekSchedule.findAll({
      attributes: ['year', 'weekNumber', 'interval'],
    });


    const weekActiveMap = {};
    for (const row of weekScheduleRows) {
      const key = `${row.year}-${row.weekNumber}`;
      if (!weekActiveMap[key]) weekActiveMap[key] = new Set();
      weekActiveMap[key].add(row.interval);
    }


    for (const order of ambiguousOrders) {
      const { weekNumber, weekYear } = isoToWeek(order.scheduledDate);
      const key = `${weekYear}-${weekNumber}`;
      const activeIntervals = weekActiveMap[key];

      if (!activeIntervals) continue;


      const matches = order.intervalOptions.filter(iv => activeIntervals.has(iv));

      if (matches.length === 1) {

        const suggestedInterval = matches[0];
        const matchedEntry = (order._fullEntries || []).find(e => e.interval === suggestedInterval);
        order.interval           = suggestedInterval;
        order.taskListId         = matchedEntry?.taskListId || null;
        order.intervalResolution = 'suggested';

      }

    }


    for (const order of orders) delete order._fullEntries;
  }
}


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


async function enrichOrders(orders) {
  if (!orders.length) return;

  
  const equipIds = [...new Set(orders.map(o => o.equipmentId).filter(Boolean))];
  const equipRows = equipIds.length
    ? await Equipment.findAll({ where: { equipmentId: { [Op.in]: equipIds } }, attributes: ['equipmentId', 'equipmentName'] })
    : [];
  const equipNameMap = Object.fromEntries(equipRows.map(e => [e.equipmentId, e.equipmentName]));

  
  const locationCodes = [...new Set(orders.map(o => o.locationCode).filter(Boolean))];
  const plantRows = locationCodes.length
    ? await Plant.findAll({ where: { plantId: { [Op.in]: locationCodes } }, attributes: ['plantId', 'plantName'] })
    : [];
  const plantNameMap = Object.fromEntries(plantRows.map(p => [p.plantId, p.plantName]));

  
  const funcLocIds = [...new Set(orders.map(o => o.functionalLocation).filter(Boolean))];
  const flRows = funcLocIds.length
    ? await FunctionalLocation.findAll({ where: { funcLocId: { [Op.in]: funcLocIds } }, attributes: ['funcLocId', 'description'] })
    : [];
  const flDescMap = Object.fromEntries(flRows.map(f => [f.funcLocId, f.description]));


  const sipilFuncLocIds = [...new Set(orders.filter(o => o.isSipil).map(o => o.functionalLocation).filter(Boolean))];
  const sipilNameRows = sipilFuncLocIds.length
    ? await SipilFunclocMapping.findAll({ where: { funcLocId: { [Op.in]: sipilFuncLocIds } }, attributes: ['funcLocId', 'name'] })
    : [];
  for (const s of sipilNameRows) {
    if (!flDescMap[s.funcLocId]) flDescMap[s.funcLocId] = s.name;
  }

  
  const unmappedDescriptions = [...new Set(
    orders
      .filter(o => !o.isSipil && o.intervalResolution === 'unknown' && o.description)
      .map(o => o.description)
  )];


  const taskListMatchMap = {};
  if (unmappedDescriptions.length) {
    const allTaskLists = await GeneralTaskList.findAll({ attributes: ['taskListId', 'taskListName'] });
    for (const desc of unmappedDescriptions) {
      const descUpper = desc.toUpperCase().trim();

      const match = allTaskLists.find(tl => {
        const baseName = tl.taskListName.toUpperCase().split('(')[0].trim();
        return baseName === descUpper || tl.taskListName.toUpperCase() === descUpper;
      });
      if (match) taskListMatchMap[desc] = match.taskListId;
    }
  }

  
  for (const order of orders) {
    const funcLocDesc = flDescMap[order.functionalLocation] || null;

    order.plantName = plantNameMap[order.locationCode] ?? null;

    if (order.isSipil) {

      order.equipmentName   = null;
      order.equipmentExists = true;
      order.funcLocDesc     = funcLocDesc || order.functionalLocation;
      order.displayName     = funcLocDesc || order.functionalLocation;
      order.autoMapped      = false;
      order.suggestedTaskList = null;
    } else {
      const equipmentName = equipNameMap[order.equipmentId] || null;
      order.equipmentName   = equipmentName;
      order.equipmentExists = order.equipmentId ? Object.prototype.hasOwnProperty.call(equipNameMap, order.equipmentId) : true;
      order.funcLocDesc     = funcLocDesc;
      order.displayName     = equipmentName || order.equipmentId;

      if (order.intervalResolution === 'auto' && order.taskListId) {

        order.autoMapped        = false;
        order.suggestedTaskList = order.taskListId;
      } else if (order.intervalResolution === 'partial' && order.taskListId) {

        order.autoMapped        = false;
        order.suggestedTaskList = order.taskListId;
      } else if (order.intervalResolution === 'unknown' && order.description) {

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

module.exports = { parseExcelBuffer, resolveIntervals, flagExisting, enrichOrders, detectKadisFromLocationCode, detectKadisFromFuncLoc };
