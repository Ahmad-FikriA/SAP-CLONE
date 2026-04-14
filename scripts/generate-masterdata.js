'use strict';

/**
 * scripts/generate-masterdata.js
 *
 * Reads ALL Excel files from ./exceldata/ and merges them into:
 *   data/sap_equipment.json              — full equipment master (966 records)
 *   data/functional_locations.json       — FuncLoc hierarchy (239 records)
 *   data/equipment_interval_mappings.json — equipment → task list + interval (--commit only)
 *   data/maintenance_plan_items.json     — maintenance plan reference (--commit only)
 *   data/MASTERDATA_PREVIEW.xlsx         — review + manual additions (always written)
 *
 * Source priority (high → low):
 *   1. Equipment SAP Update (barcode).xlsx   → category, plantId, funcLocId (837 rows)
 *   2. Mainplant Equipment active.xlsx        → category via WorkCenter, plantId (550 rows)
 *   3. Functional Location.xlsx Equipment     → baseline name for all 966 IDs
 *   4. Barcode PM Funcloc SIPIL.xlsx          → Sipil FuncLoc → building name + task group
 *
 * Run:           node scripts/generate-masterdata.js
 * Commit JSON:   node scripts/generate-masterdata.js --commit
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * HOW TO ADD MANUAL MAPPINGS
 * ─────────────────────────────────────────────────────────────────────────────
 * 1. Open data/MASTERDATA_PREVIEW.xlsx → "Equipment Mappings" sheet
 * 2. Add a row at the bottom:
 *      Type       = "Equipment" (numeric ID) or "Sipil" (FuncLoc code)
 *      ID         = equipment number (e.g. 2210000999) or FuncLoc code (e.g. A-A1-02-001)
 *      Name       = equipment or building description
 *      Task List  = KTI_XXXX (see general_task_lists.json for available codes)
 *      Interval   = number of weeks (1, 2, 4, 8, 12, 16, 24, or 52)
 *      Category   = Mekanik / Listrik / Sipil / Otomasi
 * 3. Save the Excel, then run:  node scripts/generate-masterdata.js --commit
 * ─────────────────────────────────────────────────────────────────────────────
 */

const XLSX = require('xlsx');
const fs   = require('fs');
const path = require('path');

const ROOT     = path.resolve(__dirname, '..');
const EXCEL    = path.join(ROOT, 'exceldata');
const DATA_DIR = path.join(ROOT, 'data');

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────
const PG_TO_CATEGORY = { '221': 'Mekanik', '222': 'Listrik', '223': 'Sipil', '224': 'Otomasi' };
const WC_TO_CATEGORY = {
  'M1-N01': 'Mekanik', 'M1N01': 'Mekanik',
  'E1-N01': 'Listrik', 'E1N01': 'Listrik',
  'S1-N01': 'Sipil',   'S1N01': 'Sipil',
  'O1-N01': 'Otomasi', 'O1N01': 'Otomasi',
};
const PG_TO_CATEGORY_NUM = { 221: 'Mekanik', 222: 'Listrik', 223: 'Sipil', 224: 'Otomasi' };

function s(v) { return v != null ? String(v).trim() : ''; }
function num(v) { return typeof v === 'number' ? v : (parseInt(s(v), 10) || null); }

const WEEKS_TO_INTERVAL = { 1:'1wk', 2:'2wk', 4:'4wk', 8:'8wk', 12:'12wk', 16:'16wk', 24:'24wk', 52:'52wk' };
function weeksToInterval(w) { return WEEKS_TO_INTERVAL[w] || null; }

function openSheet(filename, sheetName) {
  const fp = path.join(EXCEL, filename);
  if (!fs.existsSync(fp)) { console.warn(`  ⚠  File not found: ${filename}`); return null; }
  const wb = XLSX.readFile(fp);
  const ws = wb.Sheets[sheetName] || wb.Sheets[wb.SheetNames[0]];
  return XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
}

// ─────────────────────────────────────────────────────────────────────────────
// 1) Functional Locations (FuncLoc sheet)
// ─────────────────────────────────────────────────────────────────────────────
console.log('\n  KTI SmartCare — Masterdata Generator\n');

const flRows = openSheet('Functional Location.xlsx', 'FuncLoc');
const funcLocs = [];
if (flRows) {
  for (const row of flRows.slice(1)) {
    const id = s(row[0]);
    if (!id) continue;
    const parts = id.split('-');
    funcLocs.push({
      funcLocId:   id,
      description: s(row[1]),
      parentId:    parts.length > 1 ? parts.slice(0, -1).join('-') : null,
      level:       parts.length - 1,
    });
  }
  fs.writeFileSync(path.join(DATA_DIR, 'functional_locations.json'), JSON.stringify(funcLocs, null, 2));
  console.log(`  ✓  functional_locations.json   (${funcLocs.length} rows)`);
}

// ─────────────────────────────────────────────────────────────────────────────
// 2) Baseline equipment from FuncLoc.xlsx Equipment sheet (all 966 IDs)
// ─────────────────────────────────────────────────────────────────────────────
const equipMap = new Map(); // equipmentId → record

const flEqRows = openSheet('Functional Location.xlsx', 'Equipment');
if (flEqRows) {
  for (const row of flEqRows.slice(1)) {
    const id = s(row[0]);
    if (!id || !/^\d+$/.test(id)) continue;
    equipMap.set(id, {
      equipmentId:        id,
      equipmentName:      s(row[1]),
      category:           null,
      funcLocId:          null,
      functionalLocation: null,
      plantId:            null,
      plantName:          null,
      _source:            'FuncLoc-Equipment',
    });
  }
  console.log(`  ✓  Baseline from FuncLoc.xlsx   (${equipMap.size} IDs)`);
}

// ─────────────────────────────────────────────────────────────────────────────
// 3) Enrich from "Equipment SAP Update (barcode).xlsx"
//    Columns (row 5 header): Equipment | Description | Plant | Location | PS | Func.Location | PG
// ─────────────────────────────────────────────────────────────────────────────
const sapUpdateRows = openSheet('Equipment SAP Update ( barcode).xlsx', 'Sheet2');
if (sapUpdateRows) {
  // Find header row — XLSX library col[0]=Equipment, col[5]=Func.Location, col[6]=PG
  let headerIdx = -1;
  for (let i = 0; i < Math.min(10, sapUpdateRows.length); i++) {
    if (s(sapUpdateRows[i][0]).toLowerCase() === 'equipment') { headerIdx = i; break; }
  }
  let enriched = 0;
  if (headerIdx >= 0) {
    for (const row of sapUpdateRows.slice(headerIdx + 1)) {
      const idRaw = row[0];
      if (!idRaw || typeof idRaw !== 'number') continue;
      const id       = String(Math.round(idRaw));
      const name     = s(row[1]);
      const location = s(row[3]);  // Location = plantId (e.g. I-22L001)
      const funcLoc  = s(row[5]);  // Func.Location
      const pg       = num(row[6]);
      const category = pg ? (PG_TO_CATEGORY_NUM[pg] || null) : null;

      const existing = equipMap.get(id) || { equipmentId: id, _source: 'SAPUpdate' };
      equipMap.set(id, {
        ...existing,
        equipmentName:      name || existing.equipmentName || '',
        category:           category || existing.category || null,
        funcLocId:          funcLoc || existing.funcLocId || null,
        functionalLocation: funcLoc || existing.functionalLocation || null,
        plantId:            location || existing.plantId || null,
        plantName:          existing.plantName || null,
        _source:            'SAPUpdate',
      });
      enriched++;
    }
  }
  console.log(`  ✓  Enriched from SAP Update     (${enriched} rows)`);
}

// ─────────────────────────────────────────────────────────────────────────────
// 4) Fill gaps from "Mainplant Equipment active.xlsx"
//    Columns: MaintItem | MaintenancePlan | Strategy | MaintItem text | Equipment |
//             Functional Loc. | Planner Group | Main WorkCtr | ... | Location | Plant Section
// ─────────────────────────────────────────────────────────────────────────────
const mainRows = openSheet('Mainplant Equipment active.xlsx', 'Sheet1');
if (mainRows) {
  const hdr = mainRows[0] || [];
  const COL = {};
  hdr.forEach((h, i) => {
    const hn = s(h).toLowerCase();
    if (hn === 'equipment')       COL.eq = i;
    if (hn === 'functional loc.') COL.fl = i;
    if (hn === 'planner group')   COL.pg = i;
    if (hn === 'main workctr')    COL.wc = i;
    if (hn === 'location')        COL.loc = i;
  });

  let filled = 0;
  for (const row of mainRows.slice(1)) {
    const id = s(row[COL.eq]);
    if (!id) continue;
    const rec = equipMap.get(id);
    if (!rec) continue; // unknown equipment — skip

    let changed = false;
    if (!rec.category) {
      const pg = s(row[COL.pg]);
      const wc = s(row[COL.wc]);
      rec.category = PG_TO_CATEGORY[pg] || WC_TO_CATEGORY[wc] || WC_TO_CATEGORY[wc.replace('-', '')] || null;
      if (rec.category) changed = true;
    }
    if (!rec.funcLocId) {
      const fl = s(row[COL.fl]);
      if (fl) { rec.funcLocId = fl; rec.functionalLocation = fl; changed = true; }
    }
    if (!rec.plantId) {
      const loc = s(row[COL.loc]);
      if (loc) { rec.plantId = loc; changed = true; }
    }
    if (changed) filled++;
  }
  console.log(`  ✓  Gap-filled from Mainplant    (${filled} rows improved)`);
}

// ─────────────────────────────────────────────────────────────────────────────
// 5) Build final sorted array
// ─────────────────────────────────────────────────────────────────────────────
const final = Array.from(equipMap.values())
  .sort((a, b) => a.equipmentId.localeCompare(b.equipmentId));

const missingCategory  = final.filter(r => !r.category);
const missingFuncLoc   = final.filter(r => !r.funcLocId);
const missingPlant     = final.filter(r => !r.plantId);
const fullyComplete    = final.filter(r => r.category && r.funcLocId && r.plantId);

// ─────────────────────────────────────────────────────────────────────────────
// 6) Always write an Excel preview for review
// ─────────────────────────────────────────────────────────────────────────────
const PLANT_NAME_MAP = {
  'I-22L001': 'Cidanau',
  'I-22L002': 'Re-use Plant',
  'I-22L003': 'Waduk',
  'I-22L004': 'Cipasauran',
  'P-22L006': 'WTP Cidanau',
  'P-22L007': 'WTP Krenceng',
  'P-22L019': 'Pos Keamanan',
};

const sheetData = [
  // Header row
  ['No', 'Equipment ID', 'Equipment Name', 'Category', 'Plant ID', 'Plant Name', 'Func Loc ID', 'Status', 'Source'],
];

final.forEach((r, i) => {
  const missing = [];
  if (!r.category)  missing.push('Category');
  if (!r.plantId)   missing.push('Plant');
  if (!r.funcLocId) missing.push('FuncLoc');
  const status = missing.length === 0 ? 'COMPLETE' : 'MISSING: ' + missing.join(', ');
  const plantName = r.plantId ? (PLANT_NAME_MAP[r.plantId] || r.plantId) : '';
  sheetData.push([
    i + 1,
    r.equipmentId,
    r.equipmentName,
    r.category || '',
    r.plantId || '',
    plantName,
    r.funcLocId || '',
    status,
    r._source || '',
  ]);
});

const previewWb  = XLSX.utils.book_new();
const previewWs  = XLSX.utils.aoa_to_sheet(sheetData);

// Column widths
previewWs['!cols'] = [
  { wch: 5 },   // No
  { wch: 14 },  // Equipment ID
  { wch: 45 },  // Name
  { wch: 10 },  // Category
  { wch: 12 },  // Plant ID
  { wch: 18 },  // Plant Name
  { wch: 22 },  // FuncLoc
  { wch: 30 },  // Status
  { wch: 12 },  // Source
];

XLSX.utils.book_append_sheet(previewWb, previewWs, 'Equipment Masterdata');

// Second sheet: FuncLoc
const flData = [['FuncLoc ID', 'Description', 'Parent', 'Level'], ...funcLocs.map(f => [f.funcLocId, f.description, f.parentId || '', f.level])];
const flWs = XLSX.utils.aoa_to_sheet(flData);
flWs['!cols'] = [{ wch: 22 }, { wch: 40 }, { wch: 22 }, { wch: 7 }];
XLSX.utils.book_append_sheet(previewWb, flWs, 'Functional Locations');

// Third sheet: Gap analysis (missing records only)
const gapData = [
  ['Equipment ID', 'Equipment Name', 'Missing Fields'],
  ...final.filter(r => !r.category || !r.funcLocId || !r.plantId).map(r => {
    const missing = [];
    if (!r.category)  missing.push('Category');
    if (!r.plantId)   missing.push('Plant ID');
    if (!r.funcLocId) missing.push('Func Loc');
    return [r.equipmentId, r.equipmentName, missing.join(', ')];
  }),
];
const gapWs = XLSX.utils.aoa_to_sheet(gapData);
gapWs['!cols'] = [{ wch: 14 }, { wch: 45 }, { wch: 30 }];
XLSX.utils.book_append_sheet(previewWb, gapWs, 'Missing Data (Request SAP)');

// ─────────────────────────────────────────────────────────────────────────────
// Fourth + Fifth sheets: Maintenance Plan + Items (for auto-SPK generation)
// ─────────────────────────────────────────────────────────────────────────────
// Human-readable interval labels — plain and consistent
function weekLabel(w) {
  if (!w) return '';
  const rounded = Math.round(w);
  if (rounded === 1)  return '1 Minggu';
  if (rounded === 52) return '52 Minggu (1 Tahun)';
  return `${rounded} Minggu`;
}

const maintPlanRows = openSheet('Active Maintenance Plan KTI.xlsx', 'Sheet1');
const maintItemRows = openSheet('Mainplant Equipment active.xlsx', 'Sheet1');

const maintPlans = new Map(); // planId → { planId, planText, intervalWeeks, intervalLabel }

if (maintPlanRows) {
  const hdr = maintPlanRows[0] || [];
  const COL = {};
  hdr.forEach((h, i) => {
    const hn = s(h).toLowerCase().replace(/\s+/g, '');
    if (hn === 'maintenanceplan') COL.id = i;
    if (hn === 'maintplantext')   COL.text = i;
    if (hn === 'inweeks')         COL.weeks = i;
    if (hn === 'cycletext')       COL.cycleText = i;
    if (hn === 'cyclestart')      COL.start = i;
  });
  for (const row of maintPlanRows.slice(1)) {
    const id = s(row[COL.id]);
    if (!id) continue;
    // Prefer Cycle text (e.g. "16 WK") — more reliable than the numeric "in Weeks"
    // column which SAP sometimes stores with wrong scaling (e.g. 16 WK → 1.6 float)
    let weeks = null;
    if (COL.cycleText !== undefined) {
      const ct = s(row[COL.cycleText]).toUpperCase().trim(); // e.g. "16 WK"
      const m = ct.match(/^(\d+(?:\.\d+)?)\s*WK$/);
      if (m) weeks = parseFloat(m[1]);
    }
    // Fallback to numeric column only if cycle text parse failed
    if (weeks === null && typeof row[COL.weeks] === 'number') {
      weeks = row[COL.weeks];
    }
    maintPlans.set(id, {
      planId:         id,
      planText:       s(row[COL.text]),
      intervalWeeks:  weeks,
      intervalLabel:  weekLabel(weeks),
    });
  }
}

// Build maintenance items — join plan + equipment + task group
const maintItemData = [
  ['MaintPlan ID', 'Plan Description', 'Interval', 'Equipment ID', 'Equipment Name', 'Category', 'Plant ID', 'Func Loc', 'Task Group', 'Work Center'],
];

const maintItemJson = []; // for JSON export later

if (maintItemRows) {
  const hdr = maintItemRows[0] || [];
  const COL = {};
  hdr.forEach((h, i) => {
    const hn = s(h).toLowerCase().replace(/[\s.]/g, '');
    if (hn === 'maintenanceplan') COL.plan = i;
    if (hn === 'equipment')       COL.eq = i;
    if (hn === 'functionalloc')   COL.fl = i;
    if (hn === 'plannergroup')    COL.pg = i;
    if (hn === 'mainworkctr')     COL.wc = i;
    if (hn === 'group')           COL.grp = i;
    if (hn === 'location')        COL.loc = i;
  });

  for (const row of maintItemRows.slice(1)) {
    const planId = s(row[COL.plan]);
    const eqId   = s(row[COL.eq]);
    if (!planId || !eqId) continue;

    const plan     = maintPlans.get(planId) || {};
    const eqRec    = equipMap.get(eqId) || {};
    const pg       = s(row[COL.pg]);
    const wc       = s(row[COL.wc]);
    const category = PG_TO_CATEGORY[pg] || WC_TO_CATEGORY[wc] || eqRec.category || '';
    const plantId  = s(row[COL.loc]) || eqRec.plantId || '';
    const funcLoc  = s(row[COL.fl]) || eqRec.funcLocId || '';
    const taskGroup = s(row[COL.grp]);

    maintItemData.push([
      planId,
      plan.planText || '',
      plan.intervalLabel || '',
      eqId,
      eqRec.equipmentName || '',
      category,
      plantId,
      funcLoc,
      taskGroup,
      wc,
    ]);

    maintItemJson.push({
      planId,
      planText:       plan.planText || '',
      intervalWeeks:  plan.intervalWeeks || null,
      intervalLabel:  plan.intervalLabel || '',
      equipmentId:    eqId,
      equipmentName:  eqRec.equipmentName || '',
      category,
      plantId,
      funcLocId:      funcLoc,
      taskGroup,
      workCenter:     wc,
    });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 5B) Derive Equipment Interval Mappings (1A — from Mainplant + Active Plan join)
// ─────────────────────────────────────────────────────────────────────────────
// equipMappings: id → { type, id, name, taskListId, intervalWeeks, intervalLabel, category }
const equipMappings = new Map();

for (const item of maintItemJson) {
  if (!item.taskGroup || !item.intervalWeeks) continue;
  const key = item.equipmentId;
  if (equipMappings.has(key)) continue; // keep first occurrence per equipment
  equipMappings.set(key, {
    type:          'Equipment',
    id:            item.equipmentId,
    name:          item.equipmentName,
    taskListId:    item.taskGroup,
    intervalWeeks: item.intervalWeeks,
    intervalLabel: item.intervalLabel,
    category:      item.category,
  });
}
console.log(`  ✓  Equipment mappings derived   (${equipMappings.size} from maintenance plans)`);

// ─────────────────────────────────────────────────────────────────────────────
// 5C) Derive Sipil FuncLoc Mappings (1B — from Barcode PM Funcloc SIPIL.xlsx)
// ─────────────────────────────────────────────────────────────────────────────
const sipolRows = openSheet('Barcode PM Funcloc SIPIL.xlsx', 'Sheet1');
let sipilCount = 0;
if (sipolRows) {
  // Header is row 3 (index 2): MaintItem | maintPlant | Strat. | Maint.item text |
  //   Equipment | Functional Loc | PG | Mn.wk.ctr | MAT | Group | SF |
  //   Costctr | Func.Descr | Desc | Location | PIS
  // Data starts at row 4 (index 3)
  for (const row of sipolRows.slice(3)) {
    const funcLoc  = s(row[5]);  // Functional Loc
    const group    = s(row[9]);  // Group (KTI_XXXX)
    const descr    = s(row[12]); // Func.Descr (building name)
    const location = s(row[14]); // Location (plant area)
    if (!funcLoc || !group) continue;
    if (equipMappings.has(funcLoc)) continue; // avoid duplicate
    equipMappings.set(funcLoc, {
      type:          'Sipil',
      id:            funcLoc,
      name:          descr || funcLoc,
      taskListId:    group,
      intervalWeeks: 1,
      intervalLabel: '1 Minggu',
      category:      'Sipil',
      location,
    });
    sipilCount++;
  }
}
console.log(`  ✓  Sipil mappings derived       (${sipilCount} from Barcode Funcloc Sipil)`);

// ─────────────────────────────────────────────────────────────────────────────
// 5D) Build Equipment Mappings sheet data
// Show ALL 966 equipment + 67 Sipil so user only needs to fill in blank rows.
// Rows already derived from maintenance plans are pre-filled; unmapped are blank.
// ─────────────────────────────────────────────────────────────────────────────
const mappingSheetData = [
  ['Type', 'ID', 'Name', 'Task List', 'Interval (weeks)', 'Interval Label', 'Category', 'Status'],
];

// 1) All 966 equipment — pre-fill task list + interval if derived, else blank
for (const eq of final) {
  const mapped = equipMappings.get(eq.equipmentId);
  mappingSheetData.push([
    'Equipment',
    eq.equipmentId,
    eq.equipmentName || '',
    mapped ? mapped.taskListId  : '',
    mapped ? mapped.intervalWeeks : '',
    mapped ? mapped.intervalLabel : '',
    eq.category || mapped?.category || '',
    mapped ? 'MAPPED' : 'UNMAPPED',
  ]);
}

// 2) Sipil FuncLoc rows (always mapped — interval always 1 week)
for (const m of equipMappings.values()) {
  if (m.type !== 'Sipil') continue;
  mappingSheetData.push([
    'Sipil',
    m.id,
    m.name,
    m.taskListId,
    m.intervalWeeks,
    m.intervalLabel,
    m.category,
    'MAPPED',
  ]);
}

// Equipment Mappings sheet (4th sheet — the main manual-edit target)
const mappingWs = XLSX.utils.aoa_to_sheet(mappingSheetData);
mappingWs['!cols'] = [
  { wch: 10 },  // Type
  { wch: 22 },  // ID
  { wch: 42 },  // Name
  { wch: 12 },  // Task List
  { wch: 16 },  // Interval weeks
  { wch: 14 },  // Interval label
  { wch: 10 },  // Category
  { wch: 10 },  // Status
];
XLSX.utils.book_append_sheet(previewWb, mappingWs, 'Equipment Mappings');

const mpWs = XLSX.utils.aoa_to_sheet([['Plan ID', 'Plan Description', 'Interval (weeks)', 'Interval Label'],
  ...Array.from(maintPlans.values()).map(p => [p.planId, p.planText, p.intervalWeeks || '', p.intervalLabel])]);
mpWs['!cols'] = [{ wch: 12 }, { wch: 50 }, { wch: 16 }, { wch: 16 }];
XLSX.utils.book_append_sheet(previewWb, mpWs, 'Maintenance Plans');

const miWs = XLSX.utils.aoa_to_sheet(maintItemData);
miWs['!cols'] = [{ wch: 12 }, { wch: 45 }, { wch: 14 }, { wch: 14 }, { wch: 40 }, { wch: 10 }, { wch: 12 }, { wch: 22 }, { wch: 12 }, { wch: 10 }];
XLSX.utils.book_append_sheet(previewWb, miWs, 'Maint Items (Auto-SPK)');

console.log(`  ✓  Maintenance Plans parsed     (${maintPlans.size} plans, ${maintItemJson.length} items)`);
const mappedCount   = final.filter(eq => equipMappings.has(eq.equipmentId)).length;
const unmappedCount = final.length - mappedCount;
console.log(`  ✓  Equipment Mappings sheet    (${final.length} equipment + ${[...equipMappings.values()].filter(m=>m.type==='Sipil').length} Sipil — ${mappedCount} MAPPED, ${unmappedCount} UNMAPPED)`);

const previewPath = path.join(DATA_DIR, 'MASTERDATA_PREVIEW.xlsx');
XLSX.writeFile(previewWb, previewPath);
console.log(`  ✓  MASTERDATA_PREVIEW.xlsx     → data/MASTERDATA_PREVIEW.xlsx\n`);

// ─────────────────────────────────────────────────────────────────────────────
// 7) Gap analysis summary
// ─────────────────────────────────────────────────────────────────────────────
console.log('  ═══════════════════════════════════════════════════');
console.log('  GAP ANALYSIS — What is still missing from SAP');
console.log('  ═══════════════════════════════════════════════════');
console.log(`  Total equipment:       ${final.length}`);
console.log(`  Fully complete:        ${fullyComplete.length}`);
console.log(`  Missing category:      ${missingCategory.length}`);
console.log(`  Missing funcLocId:     ${missingFuncLoc.length}`);
console.log(`  Missing plantId:       ${missingPlant.length}`);

if (missingCategory.length > 0) {
  console.log('\n  ⚠  Equipment missing CATEGORY — see "Missing Data" sheet');
  console.log('     Request from SAP: Equipment List with Planner Group (PG) column');
}
if (missingPlant.length > 0) {
  console.log('\n  ⚠  Equipment missing PLANT ID — see "Missing Data" sheet');
  console.log('     Request from SAP: Equipment List with Location / Plant Section column');
}

// ─────────────────────────────────────────────────────────────────────────────
// 8) Only write JSON if --commit flag is passed
// ─────────────────────────────────────────────────────────────────────────────
const commit = process.argv.includes('--commit');
if (commit) {
  const cleanFinal = final.map(({ _source, ...r }) => r);
  fs.writeFileSync(path.join(DATA_DIR, 'sap_equipment.json'), JSON.stringify(cleanFinal, null, 2));
  fs.writeFileSync(path.join(DATA_DIR, 'functional_locations.json'), JSON.stringify(funcLocs, null, 2));
  fs.writeFileSync(path.join(DATA_DIR, 'maintenance_plan_items.json'), JSON.stringify(maintItemJson, null, 2));
  console.log(`\n  ✓  sap_equipment.json written              (${cleanFinal.length} rows)`);
  console.log(`  ✓  functional_locations.json written       (${funcLocs.length} rows)`);
  console.log(`  ✓  maintenance_plan_items.json written     (${maintItemJson.length} items)`);

  // ── equipment_interval_mappings.json ──────────────────────────────────────
  // Start from the derived set, then merge in any manual rows from the preview Excel
  const derivedMappings = new Map(equipMappings); // clone

  const previewFile = path.join(DATA_DIR, 'MASTERDATA_PREVIEW.xlsx');
  if (fs.existsSync(previewFile)) {
    try {
      const pvWb = XLSX.readFile(previewFile);
      const pvWs = pvWb.Sheets['Equipment Mappings'];
      if (pvWs) {
        const pvRows = XLSX.utils.sheet_to_json(pvWs, { header: 1, defval: '' });
        let manualAdded = 0;
        // Skip header row (row 0). All 966 equipment now appear in the sheet;
        // rows already in derivedMappings are skipped, rows the user filled in
        // (previously UNMAPPED, now has Task List + Interval) are merged in.
        for (const row of pvRows.slice(1)) {
          const type    = s(row[0]);
          const id      = s(row[1]);
          const name    = s(row[2]);
          const tl      = s(row[3]);
          const weeks   = num(row[4]);
          const cat     = s(row[6]);
          if (!id || !tl || !weeks) continue;
          if (derivedMappings.has(id)) continue; // already in derived set, skip
          derivedMappings.set(id, { type: type || 'Equipment', id, name, taskListId: tl, intervalWeeks: weeks, category: cat });
          manualAdded++;
        }
        if (manualAdded > 0) console.log(`  ✓  Manual additions merged         (+${manualAdded} rows from Equipment Mappings sheet)`);
      }
    } catch (e) {
      console.warn(`  ⚠  Could not read MASTERDATA_PREVIEW.xlsx for manual rows: ${e.message}`);
    }
  }

  // Write final mappings JSON (format expected by preventive_seed.js)
  // ⚠ Exclude Sipil rows — EquipmentIntervalMapping has FK to Equipment table,
  //   and Sipil uses FuncLoc codes that are not in the Equipment table.
  //   Sipil mappings are written separately to sipil_funcloc_mappings.json.
  // ⚠ Exclude non-standard intervals — only seed values the import confirm accepts.
  const VALID_INTERVAL_WEEKS = new Set([1, 2, 4, 8, 12, 16, 24, 52]);

  const mappingsJson = Array.from(derivedMappings.values())
    .filter(m => {
      if (m.type === 'Sipil') return false;                    // FK safety
      if (!m.taskListId || !m.intervalWeeks) return false;
      if (!VALID_INTERVAL_WEEKS.has(m.intervalWeeks)) return false; // no floats
      return true;
    })
    .map(m => ({
      equipmentId: m.id,
      taskListId:  m.taskListId,
      interval:    weeksToInterval(m.intervalWeeks),
    }));

  const sipilJson = Array.from(derivedMappings.values())
    .filter(m => m.type === 'Sipil' && m.taskListId)
    .map(m => ({
      funcLocId:   m.id,
      name:        m.name,
      taskListId:  m.taskListId,
      interval:    weeksToInterval(m.intervalWeeks),
      location:    m.location || null,
    }));

  const skippedNonStandard = Array.from(derivedMappings.values())
    .filter(m => m.type !== 'Sipil' && m.intervalWeeks && !VALID_INTERVAL_WEEKS.has(m.intervalWeeks));

  fs.writeFileSync(path.join(DATA_DIR, 'equipment_interval_mappings.json'), JSON.stringify(mappingsJson, null, 2));
  fs.writeFileSync(path.join(DATA_DIR, 'sipil_funcloc_mappings.json'), JSON.stringify(sipilJson, null, 2));
  console.log(`  ✓  equipment_interval_mappings.json written (${mappingsJson.length} rows)`);
  console.log(`  ✓  sipil_funcloc_mappings.json written      (${sipilJson.length} rows)`);
  if (skippedNonStandard.length) {
    console.log(`  ⚠  Skipped ${skippedNonStandard.length} equipment with non-standard intervals (e.g. ${skippedNonStandard[0].intervalWeeks} wk) — check SAP maintenance plan config`);
    skippedNonStandard.slice(0, 5).forEach(m => console.log(`     ${m.id}  ${m.name}  → ${m.intervalWeeks} wk`));
  }
  console.log('\n  ───────────────────────────────────────────────────');
  console.log('  To seed into DB, run:  npm run seed:preventive');
} else {
  console.log('\n  ─────────────────────────────────────────────────────────────────────────');
  console.log('  Preview Excel written. Open data/MASTERDATA_PREVIEW.xlsx to review.');
  console.log('  "Equipment Mappings" sheet: add rows for unmapped equipment, then run:');
  console.log('    node scripts/generate-masterdata.js --commit');
  console.log('  That writes all JSON files used by the database seed.');
}
console.log('  ═══════════════════════════════════════════════════\n');
