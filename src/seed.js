'use strict';

require('dotenv').config();
const path = require('path');
const XLSX = require('xlsx');
const sequelize = require('./config/database');
const User = require('./models/User');
const Plant = require('./models/Plant');
const Equipment = require('./models/Equipment');
const { Spk, SpkEquipment, SpkActivity } = require('./models/Spk');
const { Submission, SubmissionPhoto, SubmissionActivityResult } = require('./models/Submission');
const FunctionalLocation = require('./models/FunctionalLocation');
const { GeneralTaskList, GeneralTaskListActivity } = require('./models/GeneralTaskList');
const EquipmentIntervalMapping = require('./models/EquipmentIntervalMapping');

// Ensure all relationship and new models are loaded before syncing
require('./models/associations');

// Load JSON data
const funcLocData = require(path.join(__dirname, '..', 'data', 'functional_locations.json'));
const taskListData = require(path.join(__dirname, '..', 'data', 'general_task_lists.json'));

// ────────────────────────────────────────────────────────────────────────────
// USERS — loaded from Excel file at project root
//
// Expected file: <project-root>/Data_Users_*.xlsx  (most recent is used)
// Required columns: NIK, Nama, Jabatan, Dinas, Divisi, Group, Email
// Password defaults to NIK if no Password column is present.
// Falls back to an empty array if no file is found.
// ────────────────────────────────────────────────────────────────────────────
function loadUsersFromExcel() {
  const fs = require('fs');
  const projectRoot = path.join(__dirname, '..');

  // Find the most recently modified Data_Users_*.xlsx file in the project root
  const xlsxFiles = fs.readdirSync(projectRoot)
    .filter(f => /^Data_Users_.*\.xlsx$/i.test(f))
    .map(f => ({ name: f, mtime: fs.statSync(path.join(projectRoot, f)).mtimeMs }))
    .sort((a, b) => b.mtime - a.mtime);

  if (xlsxFiles.length === 0) {
    console.warn('  ⚠  No Data_Users_*.xlsx found in project root — users table will be empty!');
    return [];
  }

  const filePath = path.join(projectRoot, xlsxFiles[0].name);
  console.log(`  ℹ  Loading users from: ${xlsxFiles[0].name}`);

  const workbook = XLSX.readFile(filePath);
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(sheet, { defval: null });

  return rows
    .filter(row => row['NIK'])
    .map(row => {
      const nik      = String(row['NIK']).trim();
      const name     = (row['Nama']    || '').trim()   || nik;
      const rawRole  = (row['Jabatan'] || '').trim().toLowerCase();
      // Normalize sub-type roles → base roles to match app's AppRole enum
      const role = rawRole.startsWith('teknisi') ? 'teknisi'
                 : rawRole.startsWith('kasie')    ? 'kasie'
                 : rawRole.startsWith('kadis')    ? 'kadis'
                 : rawRole || 'teknisi';
      const dinas    = row['Dinas']  && row['Dinas']  !== '-' ? String(row['Dinas']).trim()  : null;
      const divisi   = row['Divisi'] && row['Divisi'] !== '-' ? String(row['Divisi']).trim() : '';
      const group    = row['Group']  && row['Group']  !== '-' ? String(row['Group']).trim()  : null;
      const email    = row['Email']  && row['Email']  !== '-' ? String(row['Email']).trim()  : null;
      // If the Excel has an explicit Password column, use it; otherwise default to 'password123'
      const password = row['Password'] ? String(row['Password']).trim() : 'password123';

      return { id: nik, nik, password, name, role, dinas, divisi, group, email };
    });
}

const users = loadUsersFromExcel();

// ────────────────────────────────────────────────────────────────────────────
// EQUIPMENT — QR Scanner GPS demo scenarios only
// Real SAP equipment is imported via preventive_seed
// ────────────────────────────────────────────────────────────────────────────
const equipment = [
  { equipmentId: 'EQ-TEST-01', equipmentName: '[TEST] Pompa Pusat — Dekat & Dalam', funcLocId: 'A-A1-02-001-001', functionalLocation: 'Area Pusat Pabrik (Test)', category: 'Mekanik', plantId: 'I-22L001', plantName: 'PS I Cidanau', latitude: -6.0135, longitude: 106.0219 },
  { equipmentId: 'EQ-TEST-02', equipmentName: '[TEST] Pompa Timur — Dalam Pabrik, Jauh', funcLocId: 'A-A1-02-001-002', functionalLocation: 'Area Timur Pabrik (Test)', category: 'Mekanik', plantId: 'I-22L001', plantName: 'PS I Cidanau', latitude: -6.0117, longitude: 106.0219 },
  { equipmentId: 'EQ-TEST-03', equipmentName: '[TEST] Pompa Remote — Luar Pabrik', funcLocId: 'A-A1-02-002-001', functionalLocation: 'Area Remote Jauh (Test)', category: 'Mekanik', plantId: 'I-22L001', plantName: 'PS I Cidanau', latitude: -6.0600, longitude: 106.0219 },
];

// ────────────────────────────────────────────────────────────────────────────
// PLANTS
// All SAP plant codes from the equipment list.
// centerLat/centerLon left null — set them via the Maps UI once zones are drawn.
// ────────────────────────────────────────────────────────────────────────────
const plants = [
  { plantId: 'I-22L001', plantName: 'PS I Cidanau',         shortName: 'PS I',        city: 'Cilegon', centerLat: null, centerLon: null, zoom: 17, sortOrder: 1 },
  { plantId: 'I-22L002', plantName: 'Re-use Plant',          shortName: 'Re-use',      city: 'Cilegon', centerLat: null, centerLon: null, zoom: 17, sortOrder: 2 },
  { plantId: 'I-22L003', plantName: 'PS II Waduk',           shortName: 'PS II',       city: 'Cilegon', centerLat: null, centerLon: null, zoom: 17, sortOrder: 3 },
  { plantId: 'I-22L004', plantName: 'PS VII Cipasauran',     shortName: 'PS VII',      city: 'Serang',  centerLat: null, centerLon: null, zoom: 17, sortOrder: 4 },
  { plantId: 'I-22L005', plantName: 'Bendung & Jalur Intake',shortName: 'Bendung',     city: 'Cilegon', centerLat: null, centerLon: null, zoom: 17, sortOrder: 5 },
  { plantId: 'P-22L006', plantName: 'WTP Cidanau',           shortName: 'WTP Cidanau', city: 'Cilegon', centerLat: null, centerLon: null, zoom: 17, sortOrder: 6 },
  { plantId: 'P-22L007', plantName: 'WTP Krenceng',          shortName: 'WTP Krenceng',city: 'Cilegon', centerLat: null, centerLon: null, zoom: 17, sortOrder: 7 },
  { plantId: 'D-22L010', plantName: 'Plant SEPS',            shortName: 'SEPS',        city: 'Cilegon', centerLat: null, centerLon: null, zoom: 17, sortOrder: 8 },
  { plantId: 'P-22L019', plantName: 'Pos Keamanan',          shortName: 'Pos',         city: 'Cilegon', centerLat: null, centerLon: null, zoom: 17, sortOrder: 9 },
];

// ────────────────────────────────────────────────────────────────────────────
// MAIN
// ────────────────────────────────────────────────────────────────────────────
async function main() {
  await sequelize.authenticate();
  console.log('\n  KTI SmartCare — Seed\n');

  // Temporarily disable foreign key checks to allow dropping and recreating
  // tables safely without referencing errors
  await sequelize.query('SET FOREIGN_KEY_CHECKS = 0');
  await sequelize.sync({ force: true });
  console.log('  ✓  Tables synced (force rebuilt with FK checks disabled)');

  let added, skipped;

  // ── Users ──────────────────────────────────────────────────────────────────
  added = 0; skipped = 0;
  for (const u of users) {
    const [, created] = await User.findOrCreate({ where: { id: u.id }, defaults: u });
    created ? added++ : skipped++;
  }
  console.log(`  ✓  users        (+${added} added, ${skipped} already existed)`);

  // ── Plants ─────────────────────────────────────────────────────────────────
  added = 0; skipped = 0;
  for (const p of plants) {
    const [, created] = await Plant.findOrCreate({ where: { plantId: p.plantId }, defaults: p });
    created ? added++ : skipped++;
  }
  console.log(`  ✓  plants       (+${added} added, ${skipped} already existed)`);

  // ── Functional Locations ───────────────────────────────────────────────────
  // Must seed BEFORE Equipment because Equipment has FK to FunctionalLocations
  added = 0; skipped = 0;
  const sortedFuncLocs = [...funcLocData].sort((a, b) => a.level - b.level);
  for (const fl of sortedFuncLocs) {
    const [, created] = await FunctionalLocation.findOrCreate({ where: { funcLocId: fl.funcLocId }, defaults: fl });
    created ? added++ : skipped++;
  }
  console.log(`  ✓  func_locs    (+${added} added, ${skipped} already existed)`);

  // ── Equipment (test/GPS demo rows only — SAP equipment handled by preventive_seed) ─
  added = 0; skipped = 0;
  for (const e of equipment) {
    const [instance, created] = await Equipment.findOrCreate({ where: { equipmentId: e.equipmentId }, defaults: e });
    if (!created && (e.latitude != null || e.longitude != null)) {
      await instance.update({ latitude: e.latitude, longitude: e.longitude });
      skipped++;
    } else {
      created ? added++ : skipped++;
    }
  }
  console.log(`  ✓  equipment    (+${added} added, ${skipped} updated/existed)`);

  // ── General Task Lists ─────────────────────────────────────────────────────
  added = 0; skipped = 0;
  for (const tl of taskListData) {
    const [, tlCreated] = await GeneralTaskList.findOrCreate({
      where: { taskListId: tl.taskListId },
      defaults: { taskListId: tl.taskListId, taskListName: tl.taskListName, category: tl.category, workCenter: tl.workCenter },
    });
    tlCreated ? added++ : skipped++;
    for (const act of tl.activities) {
      const exists = await GeneralTaskListActivity.findOne({ where: { taskListId: tl.taskListId, stepNumber: act.stepNumber } });
      if (!exists) await GeneralTaskListActivity.create({ taskListId: tl.taskListId, stepNumber: act.stepNumber, operationText: act.operationText });
    }
  }
  console.log(`  ✓  task_lists   (+${added} added, ${skipped} already existed)`);

  console.log('\n  Seed complete!\n');
  await sequelize.query('SET FOREIGN_KEY_CHECKS = 1');
  await sequelize.close();
}

main().catch(async err => {
  console.error('  ✗  Seed failed:\n', err);
  try { await sequelize.query('SET FOREIGN_KEY_CHECKS = 1'); } catch (e) { }
  process.exit(1);
});
