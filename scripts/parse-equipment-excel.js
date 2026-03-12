'use strict';
/**
 * scripts/parse-equipment-excel.js
 *
 * One-time parser: reads "Equipment List & Specification (Update).xlsx"
 * and writes data/sap_equipment.json with full fields ready for seed.js.
 *
 * Run: node scripts/parse-equipment-excel.js
 */

const XLSX = require('xlsx');
const fs   = require('fs');
const path = require('path');

// ── Work Center → category (discipline) mapping ───────────────────────────
const WORK_CENTER_MAP = {
  'E1-N01': 'Listrik',
  'M1-N01': 'Mekanik',
  'O1-N01': 'Otomasi',
  'S1-N01': 'Sipil',
};

// ── Column indices (0-based) from the header row ──────────────────────────
// Row 4 is the header row in the Excel:
// [0]No [1]Equipment Code [2]Description [3]Plant Code [4]Plant Section
// [5]ABC Indicator [6]Cost Center [7]Planning Plant [8]Planner Group
// [9]Maint.Work Center [10]Func.Location
const COL = {
  no:          0,
  equipmentId: 1,
  name:        2,
  plantCode:   3,
  abcIndicator:5,
  workCenter:  9,
  funcLocation:10,
};

// ── Parse ─────────────────────────────────────────────────────────────────
const filePath = path.join(__dirname, '..', 'Equipment List & Specification (Update).xlsx');
const wb = XLSX.readFile(filePath);
const ws = wb.Sheets[wb.SheetNames[0]];
const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });

const equipment = [];

for (const row of rows) {
  // Data rows have a sequential number in col 0
  if (typeof row[COL.no] !== 'number' || !row[COL.equipmentId]) continue;

  const workCenter   = String(row[COL.workCenter]).trim();
  const funcLocation = String(row[COL.funcLocation]).trim();
  const abcIndicator = String(row[COL.abcIndicator]).trim();

  equipment.push({
    equipmentId:       String(row[COL.equipmentId]).trim(),
    equipmentName:     String(row[COL.name]).trim(),
    plantId:           String(row[COL.plantCode]).trim(),
    funcLocId:         funcLocation || null,
    functionalLocation:funcLocation || null,
    category:          WORK_CENTER_MAP[workCenter] || null,
    abcIndicator:      abcIndicator || null,
  });
}

// ── Output ────────────────────────────────────────────────────────────────
const outPath = path.join(__dirname, '..', 'data', 'sap_equipment.json');
fs.writeFileSync(outPath, JSON.stringify(equipment, null, 2), 'utf8');

// ── Summary ───────────────────────────────────────────────────────────────
const byPlant = {};
const byCategory = {};
let noFuncLoc = 0;

equipment.forEach(e => {
  byPlant[e.plantId] = (byPlant[e.plantId] || 0) + 1;
  byCategory[e.category || 'unknown'] = (byCategory[e.category || 'unknown'] || 0) + 1;
  if (!e.funcLocId) noFuncLoc++;
});

console.log(`\n  Parsed ${equipment.length} equipment → data/sap_equipment.json\n`);
console.log('  By plant:');
Object.entries(byPlant).forEach(([k, v]) => console.log(`    ${k}: ${v}`));
console.log('\n  By category:');
Object.entries(byCategory).forEach(([k, v]) => console.log(`    ${k}: ${v}`));
console.log(`\n  Equipment without funcLocation: ${noFuncLoc}`);
console.log('');
