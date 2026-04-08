'use strict';

// Preventive-only seed — resets and reseeds:
//   plants, functional_locations, equipment, task_lists
//
// SPK and LK are NOT seeded — they are created via the app or generate-from-task-list.
// Does NOT touch: users, corrective, inspection tables.
// Run with: npm run seed:preventive

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const sequelize = require('./config/database');
const { syncDatabase } = require('./config/syncMode');
const Plant = require('./models/Plant');
const Equipment = require('./models/Equipment');
const { Spk, SpkEquipment, SpkActivity } = require('./models/Spk');
const { LembarKerja, LembarKerjaSpk } = require('./models/LembarKerja');
const { Submission, SubmissionPhoto, SubmissionActivityResult } = require('./models/Submission');
// ↑ Kept for the truncation step (clearing old data on re-seed)
const FunctionalLocation = require('./models/FunctionalLocation');
const { GeneralTaskList, GeneralTaskListActivity } = require('./models/GeneralTaskList');
const EquipmentIntervalMapping = require('./models/EquipmentIntervalMapping');
const PreventiveWeekSchedule = require('./models/PreventiveWeekSchedule');

require('./models/associations');

// Load JSON data files
const funcLocData = require(path.join(__dirname, '..', 'data', 'functional_locations.json'));
const sapEquipmentData = require(path.join(__dirname, '..', 'data', 'sap_equipment.json'));
const taskListData = require(path.join(__dirname, '..', 'data', 'general_task_lists.json'));
const mappingData = require(path.join(__dirname, '..', 'data', 'equipment_interval_mappings.json'));

// ────────────────────────────────────────────────────────────────────────────
// PLANTS — corrected from SAP sticky note
// ────────────────────────────────────────────────────────────────────────────
const plants = [
  { plantId: 'I-22L001', plantName: 'Cidanau', shortName: 'Cidanau', city: 'Cilegon', centerLat: null, centerLon: null, zoom: 17, sortOrder: 1 },
  { plantId: 'I-22L002', plantName: 'Re-use Plant', shortName: 'Re-use', city: 'Cilegon', centerLat: null, centerLon: null, zoom: 17, sortOrder: 2 },
  { plantId: 'I-22L003', plantName: 'Waduk', shortName: 'Waduk', city: 'Cilegon', centerLat: null, centerLon: null, zoom: 17, sortOrder: 3 },
  { plantId: 'I-22L004', plantName: 'Cipasauran', shortName: 'Cipasauran', city: 'Serang', centerLat: null, centerLon: null, zoom: 17, sortOrder: 4 },
  { plantId: 'P-22L006', plantName: 'WTP Cidanau', shortName: 'WTP Cidanau', city: 'Cilegon', centerLat: null, centerLon: null, zoom: 17, sortOrder: 6 },
  { plantId: 'P-22L007', plantName: 'WTP Krenceng', shortName: 'WTP Krenceng', city: 'Cilegon', centerLat: null, centerLon: null, zoom: 17, sortOrder: 7 },
  { plantId: 'P-22L019', plantName: 'Pos Keamanan', shortName: 'Pos', city: 'Cilegon', centerLat: null, centerLon: null, zoom: 17, sortOrder: 8 },
];


// ────────────────────────────────────────────────────────────────────────────
// MAIN
// ────────────────────────────────────────────────────────────────────────────
async function main() {
  await sequelize.authenticate();
  await syncDatabase(sequelize, 'preventive seed');
  console.log('\n  KTI SmartCare — Preventive Seed\n');

  // ── 1a. Snapshot plant coords before wiping ──────────────────────────────
  const plantCoordSnapshot = new Map();
  const existingPlants = await Plant.findAll({ attributes: ['plantId', 'centerLat', 'centerLon'] });
  for (const p of existingPlants) {
    const lat = p.centerLat != null ? parseFloat(p.centerLat) : null;
    const lon = p.centerLon != null ? parseFloat(p.centerLon) : null;
    if (lat != null || lon != null) plantCoordSnapshot.set(p.plantId, { centerLat: lat, centerLon: lon });
  }
  if (plantCoordSnapshot.size > 0) {
    console.log(`  ✓  Snapshotted coords for ${plantCoordSnapshot.size} plant(s)`);
  }

  // ── 1b. Snapshot protected fields before wiping ───────────────────────────
  //  Fields listed here will NEVER be overwritten by the seed, even after a
  //  full destroy + recreate cycle. Add any field you want "locked" here.
  const PROTECTED_FIELDS = ['latitude', 'longitude', 'polygonFeatureName'];

  const protectedSnapshot = new Map(); // equipmentId → { latitude, longitude, polygonFeatureName }
  const existingEquipment = await Equipment.findAll({
    attributes: ['equipmentId', ...PROTECTED_FIELDS],
  });
  for (const row of existingEquipment) {
    const values = {};
    let hasAny = false;
    for (const field of PROTECTED_FIELDS) {
      if (row[field] !== null && row[field] !== undefined) hasAny = true;
      values[field] = row[field] !== null && row[field] !== undefined
        ? parseFloat(row[field]) || row[field]  // parse decimals; keep strings as-is
        : null;
    }
    if (hasAny) protectedSnapshot.set(row.equipmentId, values);
  }
  if (protectedSnapshot.size > 0) {
    console.log(`  ✓  Snapshotted protected fields for ${protectedSnapshot.size} equipment row(s)`);
  }

  // ── 1b. Truncate in FK-safe order ─────────────────────────────────────────
  console.log('  Clearing preventive tables...');
  await SubmissionActivityResult.destroy({ where: {} });
  await SubmissionPhoto.destroy({ where: {} });
  await Submission.destroy({ where: {} });
  await SpkActivity.destroy({ where: {} });
  await SpkEquipment.destroy({ where: {} });
  await LembarKerjaSpk.destroy({ where: {} });
  await LembarKerja.destroy({ where: {} });
  await Spk.destroy({ where: {} });
  await GeneralTaskListActivity.destroy({ where: {} });
  await GeneralTaskList.destroy({ where: {} });
  await Equipment.destroy({ where: {} });
  await FunctionalLocation.destroy({ where: {} });
  await Plant.destroy({ where: {} });
  console.log('  ✓  Tables cleared\n');

  let added, skipped;

  // ── 2. Plants ──────────────────────────────────────────────────────────────
  for (const p of plants) await Plant.create(p);
  console.log(`  ✓  plants         (${plants.length} inserted)`);

  // Restore snapshotted plant coords
  if (plantCoordSnapshot.size > 0) {
    let plantRestored = 0;
    for (const [plantId, coords] of plantCoordSnapshot.entries()) {
      const plant = await Plant.findByPk(plantId);
      if (plant) { await plant.update(coords); plantRestored++; }
    }
    console.log(`  ✓  Restored coords for ${plantRestored} plant(s)`);
  }

  // ── 3. Functional Locations (level-sorted so parent exists before child) ───
  added = 0;
  const sortedFuncLocs = [...funcLocData].sort((a, b) => a.level - b.level);
  for (const fl of sortedFuncLocs) {
    await FunctionalLocation.create(fl);
    added++;
  }
  console.log(`  ✓  func_locs      (${added} inserted)`);

  // ── 4. SAP Equipment (from sap_equipment.json — upsert plantName from seed) ─
  const plantNameMap = Object.fromEntries(plants.map(p => [p.plantId, p.plantName]));
  added = 0;
  for (const se of sapEquipmentData) {
    let safeCategory = null;
    if (se.category) {
      const cat = se.category.toLowerCase().trim();
      if (['mekanik', 'mechanical'].includes(cat)) safeCategory = 'Mekanik';
      else if (['listrik', 'electrical'].includes(cat)) safeCategory = 'Listrik';
      else if (['sipil', 'civil'].includes(cat)) safeCategory = 'Sipil';
      else if (['otomasi', 'automation'].includes(cat)) safeCategory = 'Otomasi';
    }
    const resolvedPlantId = plantNameMap[se.plantId] !== undefined ? se.plantId : null;
    const defaults = {
      equipmentId: se.equipmentId,
      equipmentName: se.equipmentName,
      plantId: resolvedPlantId,
      plantName: plantNameMap[se.plantId] || null,
      funcLocId: se.funcLocId || null,
      functionalLocation: se.functionalLocation || null,
      category: safeCategory,
    };
    try {
      let instance = await Equipment.findOne({ where: { equipmentId: se.equipmentId } });
      if (!instance) {
        await Equipment.create(defaults);
        added++;
      } else {
        await instance.update(defaults);
      }
    } catch (err) {
      console.error(`\nFAILED ON EQUIP ID: ${se.equipmentId}`);
      throw err;
    }
  }
  console.log(`  ✓  sap_equipment  (${added} new + existing updated)`);

  // ── 6. General Task Lists ──────────────────────────────────────────────────
  added = 0;
  for (const tl of taskListData) {
    await GeneralTaskList.create({ taskListId: tl.taskListId, taskListName: tl.taskListName, category: tl.category, workCenter: tl.workCenter });
    added++;
    for (const act of tl.activities) {
      await GeneralTaskListActivity.create({ taskListId: tl.taskListId, stepNumber: act.stepNumber, operationText: act.operationText });
    }
  }
  console.log(`  ✓  task_lists     (${added} inserted)`);

  // ── 7. Equipment Interval Mappings ────────────────────────────────────────
  await EquipmentIntervalMapping.destroy({ where: {} });
  let mappingAdded = 0;
  for (const m of mappingData) {
    try {
      await EquipmentIntervalMapping.create({ equipmentId: m.equipmentId, interval: m.interval, taskListId: m.taskListId });
      mappingAdded++;
    } catch (err) {
      if (err.name !== 'SequelizeUniqueConstraintError') throw err;
    }
  }
  console.log(`  ✓  eq_mappings    (${mappingAdded} inserted)`);

  // ── 8. Preventive Week Schedule 2026 ──────────────────────────────────────
  const SCHEDULE_YEAR = 2026;
  const INTERVALS = [
    { key: '1wk', weeks: 1 },
    { key: '2wk', weeks: 2 },
    { key: '3wk', weeks: 3 },
    { key: '4wk', weeks: 4 },
    { key: '8wk', weeks: 8 },
    { key: '12wk', weeks: 12 },
    { key: '16wk', weeks: 16 },
    { key: '24wk', weeks: 24 },
  ];
  await PreventiveWeekSchedule.destroy({ where: { year: SCHEDULE_YEAR } });
  const scheduleRows = [];
  for (let week = 1; week <= 53; week++) {
    for (const { key, weeks } of INTERVALS) {
      if ((week - 1) % weeks === 0) scheduleRows.push({ year: SCHEDULE_YEAR, weekNumber: week, interval: key });
    }
  }
  await PreventiveWeekSchedule.bulkCreate(scheduleRows, { ignoreDuplicates: true });
  console.log(`  ✓  week_schedule  (${scheduleRows.length} entries for ${SCHEDULE_YEAR})`);

  // ── 10. Restore protected fields from in-memory snapshot ──────────────────
  if (protectedSnapshot.size > 0) {
    let restored = 0;
    let missed = 0;
    for (const [equipmentId, values] of protectedSnapshot) {
      const equip = await Equipment.findOne({ where: { equipmentId } });
      if (equip) {
        await equip.update(values);
        restored++;
      } else {
        // Equipment ID no longer exists after seed (SAP data changed)
        missed++;
      }
    }
    const missedNote = missed > 0 ? ` — ${missed} ID(s) no longer exist, skipped` : '';
    console.log(`  ✓  protected     (${restored} equipment row(s) fields restored${missedNote})`);
  } else {
    console.log('  ✓  protected     (no coordinate data to restore)');
  }

  console.log('\n  Preventive seed complete!\n');
  console.log('  SPK and LK are not seeded — create them via the app.\n');
}

main()
  .then(() => process.exit(0))
  .catch(err => { console.error(err); process.exit(1); });
