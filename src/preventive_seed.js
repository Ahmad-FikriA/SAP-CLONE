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

require('./models/associations');

// Load JSON data files
const funcLocData = require(path.join(__dirname, '..', 'data', 'functional_locations.json'));
const sapEquipmentData = require(path.join(__dirname, '..', 'data', 'sap_equipment.json'));
const taskListData = require(path.join(__dirname, '..', 'data', 'general_task_lists.json'));
const equipmentFileData = require(path.join(__dirname, '..', 'data', 'equipment.json'));

// ────────────────────────────────────────────────────────────────────────────
// PLANTS — corrected from SAP sticky note
// ────────────────────────────────────────────────────────────────────────────
const plants = [
  { plantId: 'I-22L001', plantName: 'Cidanau', shortName: 'Cidanau', city: 'Cilegon', centerLat: null, centerLon: null, zoom: 17, sortOrder: 1 },
  { plantId: 'I-22L002', plantName: 'Re-use Plant', shortName: 'Re-use', city: 'Cilegon', centerLat: null, centerLon: null, zoom: 17, sortOrder: 2 },
  { plantId: 'I-22L003', plantName: 'Waduk', shortName: 'Waduk', city: 'Cilegon', centerLat: null, centerLon: null, zoom: 17, sortOrder: 3 },
  { plantId: 'I-22L004', plantName: 'Cipasauran', shortName: 'Cipasauran', city: 'Serang', centerLat: null, centerLon: null, zoom: 17, sortOrder: 4 },
  { plantId: 'I-22L005', plantName: 'Bendung & Jalur Intake', shortName: 'Bendung', city: 'Cilegon', centerLat: null, centerLon: null, zoom: 17, sortOrder: 5 },
  { plantId: 'P-22L006', plantName: 'WTP Cidanau', shortName: 'WTP Cidanau', city: 'Cilegon', centerLat: null, centerLon: null, zoom: 17, sortOrder: 6 },
  { plantId: 'P-22L007', plantName: 'WTP Krenceng', shortName: 'WTP Krenceng', city: 'Cilegon', centerLat: null, centerLon: null, zoom: 17, sortOrder: 7 },
  { plantId: 'P-22L019', plantName: 'Pos Keamanan', shortName: 'Pos', city: 'Cilegon', centerLat: null, centerLon: null, zoom: 17, sortOrder: 8 },
];

// ────────────────────────────────────────────────────────────────────────────
// EQUIPMENT — inline test/demo rows (from data/equipment.json + SAP bulk below)
// ────────────────────────────────────────────────────────────────────────────
const equipment = [
  ...equipmentFileData,

  // ── TEST EQUIPMENT — QR Scanner GPS Demo Scenarios ────────────────────────
  { equipmentId: 'EQ-TEST-01', equipmentName: '[TEST] Pompa Pusat — Dekat & Dalam', funcLocId: 'A-A1-02-001-001', functionalLocation: 'Area Pusat Pabrik (Test)', category: 'Mekanik', plantId: 'I-22L001', plantName: 'PS I Cidanau', latitude: -6.0135, longitude: 106.0219 },
  { equipmentId: 'EQ-TEST-02', equipmentName: '[TEST] Pompa Timur — Dalam Pabrik, Jauh', funcLocId: 'A-A1-02-001-002', functionalLocation: 'Area Timur Pabrik (Test)', category: 'Mekanik', plantId: 'I-22L001', plantName: 'PS I Cidanau', latitude: -6.0117, longitude: 106.0219 },
  { equipmentId: 'EQ-TEST-03', equipmentName: '[TEST] Pompa Remote — Luar Pabrik', funcLocId: 'A-A1-02-002-001', functionalLocation: 'Area Remote Jauh (Test)', category: 'Mekanik', plantId: 'I-22L001', plantName: 'PS I Cidanau', latitude: -6.0600, longitude: 106.0219 },
];

// ────────────────────────────────────────────────────────────────────────────
// SPK
// ────────────────────────────────────────────────────────────────────────────
// SPK Week-number reference:
//   Jan 2026 → WK1–WK4  |  Feb 2026 → WK5–WK8  |  Mar 2026 → WK9–WK13
//   Format: SPK-{CAT}-WK{weekOfYear}
//   CAT codes: M = Mekanik, L = Listrik, S = Sipil, O = Otomasi




// // ────────────────────────────────────────────────────────────────────────────
// // LEMBAR KERJA
// // ────────────────────────────────────────────────────────────────────────────
// const lembarKerja = [
//   { lkNumber: 'LK-JAN-MEK', periodeStart: '2026-01-01T00:00:00.000Z', periodeEnd: '2026-01-31T23:59:59.000Z', category: 'Mekanik', status: 'completed', lembarKe: 1, totalLembar: 1, evaluasi: 'Perawatan Mekanik Januari selesai. Semua peralatan dalam kondisi baik.', spkModels: ['SPK-M-001', 'SPK-M-002'] },
//   { lkNumber: 'LK-JAN-LIS', periodeStart: '2026-01-01T00:00:00.000Z', periodeEnd: '2026-01-31T23:59:59.000Z', category: 'Listrik', status: 'completed', lembarKe: 1, totalLembar: 1, evaluasi: 'Inspeksi Listrik Januari selesai. Tidak ada temuan kritis.', spkModels: ['SPK-L-001'] },
//   { lkNumber: 'LK-FEB-MEK', periodeStart: '2026-02-01T00:00:00.000Z', periodeEnd: '2026-02-28T23:59:59.000Z', category: 'Mekanik', status: 'in_progress', lembarKe: 1, totalLembar: 1, evaluasi: null, spkModels: ['SPK-M-004', 'SPK-M-003'] },
//   { lkNumber: 'LK-FEB-LIS', periodeStart: '2026-02-01T00:00:00.000Z', periodeEnd: '2026-02-28T23:59:59.000Z', category: 'Listrik', status: 'completed', lembarKe: 1, totalLembar: 1, evaluasi: 'Inspeksi Listrik Februari selesai. 1 MCB perlu penggantian, sudah dilaporkan.', spkModels: ['SPK-L-002'] },
//   { lkNumber: 'LK-MAR-MEK', periodeStart: '2026-03-01T00:00:00.000Z', periodeEnd: '2026-03-31T23:59:59.000Z', category: 'Mekanik', status: 'in_progress', lembarKe: 1, totalLembar: 1, evaluasi: null, spkModels: ['SPK-M-006', 'SPK-M-005'] },
//   { lkNumber: 'LK-MAR-LIS', periodeStart: '2026-03-01T00:00:00.000Z', periodeEnd: '2026-03-31T23:59:59.000Z', category: 'Listrik', status: 'in_progress', lembarKe: 1, totalLembar: 1, evaluasi: null, spkModels: ['SPK-L-004', 'SPK-L-003'] },
//   { lkNumber: 'LK-MAR-SIP', periodeStart: '2026-03-01T00:00:00.000Z', periodeEnd: '2026-03-31T23:59:59.000Z', category: 'Sipil', status: 'pending', lembarKe: 1, totalLembar: 1, evaluasi: null, spkModels: ['SPK-S-001'] },
//   { lkNumber: 'LK-MAR-OTO', periodeStart: '2026-03-01T00:00:00.000Z', periodeEnd: '2026-03-31T23:59:59.000Z', category: 'Otomasi', status: 'pending', lembarKe: 1, totalLembar: 1, evaluasi: null, spkModels: ['SPK-O-001'] },
// ];

// // ────────────────────────────────────────────────────────────────────────────
// // SUBMISSIONS
// // ────────────────────────────────────────────────────────────────────────────
// const submissions = [
//   {
//     id: 'SUB-001', spkNumber: 'SPK-L-003', durationActual: 3.0,
//     evaluasi: 'Servis genset berjalan lancar. Semua komponen dalam kondisi baik pasca servis.',
//     latitude: -6.0141, longitude: 106.0220, submittedAt: '2026-02-20T14:00:00.000Z', photoPaths: [],
//     activityResultsModel: [
//       { activityNumber: 'ACT-001', resultComment: 'Oli diganti dengan Pertamina Fastron 15W40', isNormal: true, isVerified: true },
//       { activityNumber: 'ACT-002', resultComment: 'Kedua filter sudah diganti baru', isNormal: true, isVerified: true },
//       { activityNumber: 'ACT-003', resultComment: 'Genset beroperasi normal, output 200V/50Hz', isNormal: true, isVerified: true },
//     ],
//   },
//   {
//     id: 'SUB-002', spkNumber: 'SPK-M-001', durationActual: 1.5,
//     evaluasi: 'Perawatan Pompa A Januari selesai. Tidak ada temuan kritis.',
//     latitude: -6.0131, longitude: 106.0215, submittedAt: '2026-01-22T09:30:00.000Z', photoPaths: [],
//     activityResultsModel: [
//       { activityNumber: 'ACT-001', resultComment: 'Tekanan normal: 4.2 bar', isNormal: true, isVerified: true },
//       { activityNumber: 'ACT-002', resultComment: 'Tidak ada kebocoran', isNormal: true, isVerified: true },
//       { activityNumber: 'ACT-003', resultComment: 'Bearing dilumasi, kondisi baik', isNormal: true, isVerified: true },
//     ],
//   },
//   {
//     id: 'SUB-003', spkNumber: 'SPK-M-002', durationActual: 1.0,
//     evaluasi: 'Perawatan Pompa Booster Januari selesai. Semua normal.',
//     latitude: -6.0128, longitude: 106.0222, submittedAt: '2026-01-23T11:00:00.000Z', photoPaths: [],
//     activityResultsModel: [
//       { activityNumber: 'ACT-001', resultComment: 'Tekanan normal: 3.8 bar', isNormal: true, isVerified: true },
//       { activityNumber: 'ACT-002', resultComment: 'Seal dalam kondisi baik', isNormal: true, isVerified: true },
//       { activityNumber: 'ACT-003', resultComment: 'Arus normal: 8.5 A', isNormal: true, isVerified: true },
//     ],
//   },
//   {
//     id: 'SUB-004', spkNumber: 'SPK-L-001', durationActual: 1.5,
//     evaluasi: 'Inspeksi Panel Listrik Januari selesai. Tidak ada temuan kritis.',
//     latitude: -6.0136, longitude: 106.0224, submittedAt: '2026-01-20T14:00:00.000Z', photoPaths: [],
//     activityResultsModel: [
//       { activityNumber: 'ACT-001', resultComment: 'Tegangan normal 380V / 220V', isNormal: true, isVerified: true },
//       { activityNumber: 'ACT-002', resultComment: 'Semua MCB berfungsi normal', isNormal: true, isVerified: true },
//       { activityNumber: 'ACT-003', resultComment: 'Busbar dibersihkan, tidak ada korosi', isNormal: true, isVerified: true },
//     ],
//   },
//   {
//     id: 'SUB-005', spkNumber: 'SPK-M-003', durationActual: 1.25,
//     evaluasi: 'Perawatan Pompa Booster Februari selesai. Tekanan disetel ulang, seal dijadwalkan ganti bulan depan.',
//     latitude: -6.0128, longitude: 106.0222, submittedAt: '2026-02-21T10:00:00.000Z', photoPaths: [],
//     activityResultsModel: [
//       { activityNumber: 'ACT-001', resultComment: 'Tekanan sedikit turun: 3.5 bar, disetel ulang', isNormal: false, isVerified: true },
//       { activityNumber: 'ACT-002', resultComment: 'Seal mulai aus, dijadwalkan ganti bulan depan', isNormal: false, isVerified: true },
//       { activityNumber: 'ACT-003', resultComment: 'Arus normal: 8.7 A', isNormal: true, isVerified: true },
//     ],
//   },
//   {
//     id: 'SUB-006', spkNumber: 'SPK-L-002', durationActual: 2.0,
//     evaluasi: 'Inspeksi Panel Listrik Februari selesai. 1 MCB perlu penggantian, sudah dilaporkan ke pengadaan.',
//     latitude: -6.0136, longitude: 106.0224, submittedAt: '2026-02-19T13:00:00.000Z', photoPaths: [],
//     activityResultsModel: [
//       { activityNumber: 'ACT-001', resultComment: 'Tegangan normal 382V / 221V', isNormal: true, isVerified: true },
//       { activityNumber: 'ACT-002', resultComment: '1 MCB perlu penggantian, sudah dilaporkan', isNormal: false, isVerified: true },
//       { activityNumber: 'ACT-003', resultComment: 'Busbar bersih', isNormal: true, isVerified: true },
//     ],
//   },
// ];

// ────────────────────────────────────────────────────────────────────────────
// MAIN
// ────────────────────────────────────────────────────────────────────────────
async function main() {
  await sequelize.authenticate();
  await syncDatabase(sequelize, 'preventive seed');
  console.log('\n  KTI SmartCare — Preventive Seed\n');

  // ── 1a. Snapshot protected fields before wiping ───────────────────────────
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

  // ── 3. Functional Locations (level-sorted so parent exists before child) ───
  added = 0;
  const sortedFuncLocs = [...funcLocData].sort((a, b) => a.level - b.level);
  for (const fl of sortedFuncLocs) {
    await FunctionalLocation.create(fl);
    added++;
  }
  console.log(`  ✓  func_locs      (${added} inserted)`);

  // ── 4. Equipment (from equipment.json + inline test rows) ─────────────────
  for (const e of equipment) await Equipment.create(e);
  console.log(`  ✓  equipment      (${equipment.length} inserted)`);

  // ── 5. SAP Equipment (from sap_equipment.json — upsert plantName from seed) ─
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
      abcIndicator: se.abcIndicator || null,
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

  // ── 7. Restore protected fields from in-memory snapshot ───────────────────
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
