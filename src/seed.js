'use strict';

require('dotenv').config();
const path = require('path');
const XLSX = require('xlsx');
const sequelize = require('./config/database');
const User = require('./models/User');
const Plant = require('./models/Plant');
const Equipment = require('./models/Equipment');
const { Spk, SpkEquipment, SpkActivity } = require('./models/Spk');
const { LembarKerja, LembarKerjaSpk } = require('./models/LembarKerja');
const { Submission, SubmissionPhoto, SubmissionActivityResult } = require('./models/Submission');
const Notification = require('./models/Notification');
const SpkCorrective = require('./models/SpkCorrective');
const { SpkCorrectiveItem, SpkCorrectivePhoto } = require('./models/SpkCorrectiveItem');
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
                 : rawRole.startsWith('kadis')   ? 'kadis'
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

  // ── Corrective Maintenance — Sample Data ───────────────────────────────────
  const notifications = [
    {
      notificationId: 'NOTIF-001',
      notificationDate: '2026-03-10',
      notificationType: 'Kerusakan',
      description: 'Pompa Air Utama A tidak berfungsi',
      functionalLocation: 'Basement Lantai B1',
      equipmentName: 'Pompa Air Utama A',
      equipmentId: 'EQ-001',
      requiredStart: '2026-03-11',
      requiredEnd: '2026-03-15',
      reportedBy: 'Kadis Mekanik',
      longText: 'Pompa tidak menyala saat tombol start ditekan. Terdapat suara aneh dari motor.',
      photo1: null,
      photo2: null,
      status: 'submitted',
      workCenter: 'mechanical',
      kadisPelaporId: 'USR-011',
      submittedBy: 'USR-011',
      submittedAt: '2026-03-10T08:00:00.000Z',
    },
    {
      notificationId: 'NOTIF-002',
      notificationDate: '2026-03-11',
      notificationType: 'Anomali',
      description: 'Panel Listrik Utama berbau hangus',
      functionalLocation: 'Ruang Panel Lantai 1',
      equipmentName: 'Panel Listrik Utama',
      equipmentId: 'EQ-005',
      requiredStart: '2026-03-12',
      requiredEnd: '2026-03-16',
      reportedBy: 'Kadis Listrik',
      longText: 'MCB sering trip tanpa beban berlebih. Perlu pemeriksaan menyeluruh.',
      photo1: null,
      photo2: null,
      status: 'spk_created',
      workCenter: 'electrical',
      kadisPelaporId: 'USR-012',
      submittedBy: 'USR-012',
      submittedAt: '2026-03-11T09:30:00.000Z',
    },
    {
      notificationId: 'NOTIF-003',
      notificationDate: '2026-03-12',
      notificationType: 'Kerusakan',
      description: 'Bak Penampungan bocor',
      functionalLocation: 'Area Luar Gedung',
      equipmentName: 'Bak Penampungan Utama',
      equipmentId: 'EQ-008',
      requiredStart: '2026-03-13',
      requiredEnd: '2026-03-18',
      reportedBy: 'Kadis Sipil',
      longText: 'Terdapat kebocoran pada sambungan pipa. Air merembes ke dinding.',
      photo1: null,
      photo2: null,
      status: 'submitted',
      workCenter: 'civil',
      kadisPelaporId: 'USR-013',
      submittedBy: 'USR-013',
      submittedAt: '2026-03-12T10:15:00.000Z',
    },
    {
      notificationId: 'NOTIF-004',
      notificationDate: '2026-03-09',
      notificationType: 'Anomali',
      description: 'Sensor Level Air sering memberi nilai kosong',
      functionalLocation: 'Rooftop Area',
      equipmentName: 'Sensor Level Air Tank 1',
      equipmentId: 'EQ-010',
      requiredStart: '2026-03-10',
      requiredEnd: '2026-03-14',
      reportedBy: 'Kadis Otomasi',
      longText: 'Sensor menunjukkan level 80% padahal tanki hanya terisi 50%. Perlu kalibrasi ulang.',
      photo1: null,
      photo2: null,
      status: 'spk_created',
      workCenter: 'automation',
      kadisPelaporId: 'USR-009',
      submittedBy: 'USR-009',
      submittedAt: '2026-03-09T14:20:00.000Z',
    },
    {
      notificationId: 'NOTIF-005',
      notificationDate: '2026-03-08',
      notificationType: 'Kerusakan',
      description: 'Genset tidak bisa start',
      functionalLocation: 'Area Genset Basement',
      equipmentName: 'Genset Cadangan 200 kVA',
      equipmentId: 'EQ-007',
      requiredStart: '2026-03-09',
      requiredEnd: '2026-03-13',
      reportedBy: 'Kadis Listrik',
      longText: 'Genset tidak merespon saat tombol start ditekan. Baterai dalam kondisi baik.',
      photo1: null,
      photo2: null,
      status: 'closed',
      workCenter: 'electrical',
      kadisPelaporId: 'USR-012',
      submittedBy: 'USR-012',
      submittedAt: '2026-03-08T11:00:00.000Z',
    },
  ];

  added = 0; skipped = 0;
  for (const n of notifications) {
    const [, created] = await Notification.findOrCreate({ where: { notificationId: n.notificationId }, defaults: n });
    created ? added++ : skipped++;
  }
  console.log(`  ✓  notifications (+${added} added, ${skipped} already existed)`);

  const spkCorrective = [
    {
      spkId: 'SPK-C-001',
      notificationId: 'NOTIF-002',
      spkNumber: 'SPK-C-2026-001',
      orderNumber: 'ORD-2026-001',
      createdDate: '2026-03-11',
      priority: 'high',
      equipmentId: 'EQ-005',
      location: 'Ruang Panel Lantai 1',
      requestedFinishDate: '2026-03-16',
      actualStartDate: '2026-03-12',
      damageClassification: 'Electrical Failure',
      jobDescription: 'Pemeriksaan dan perbaikan panel listrik utama',
      workCenter: 'electrical',
      ctrlKey: 'PM01',
      unit: 'Hours',
      plannedWorker: 2,
      plannedHourPerWorker: 4.0,
      totalPlannedHour: 8.0,
      actualWorker: 2,
      actualHourPerWorker: 3.5,
      totalActualHour: 7.0,
      status: 'awaiting_kasie',
      items: [
        { itemType: 'material', itemName: 'MCB 32A', quantity: 2, uom: 'pcs' },
        { itemType: 'material', itemName: 'Kabel NYM 4x2.5', quantity: 10, uom: 'm' },
      ],
    },
    {
      spkId: 'SPK-C-002',
      notificationId: 'NOTIF-004',
      spkNumber: 'SPK-C-2026-002',
      orderNumber: 'ORD-2026-002',
      createdDate: '2026-03-09',
      priority: 'medium',
      equipmentId: 'EQ-010',
      location: 'Rooftop Area',
      requestedFinishDate: '2026-03-14',
      actualStartDate: null,
      damageClassification: 'Sensor Calibration',
      jobDescription: 'Kalibrasi ulang sensor level air',
      workCenter: 'automation',
      ctrlKey: 'PM02',
      unit: 'Hours',
      plannedWorker: 1,
      plannedHourPerWorker: 3.0,
      totalPlannedHour: 3.0,
      actualWorker: null,
      actualHourPerWorker: null,
      totalActualHour: null,
      status: 'draft',
      items: [
        { itemType: 'tool', itemName: 'Kalibrator', quantity: 1, uom: 'set' },
      ],
    },
    {
      spkId: 'SPK-C-003',
      notificationId: 'NOTIF-005',
      spkNumber: 'SPK-C-2026-003',
      orderNumber: 'ORD-2026-003',
      createdDate: '2026-03-08',
      priority: 'urgent',
      equipmentId: 'EQ-007',
      location: 'Area Genset Basement',
      requestedFinishDate: '2026-03-13',
      actualStartDate: '2026-03-09',
      damageClassification: 'Mechanical Failure',
      jobDescription: 'Perbaikan sistem starter genset',
      workCenter: 'electrical',
      ctrlKey: 'PM01',
      unit: 'Hours',
      plannedWorker: 2,
      plannedHourPerWorker: 5.0,
      totalPlannedHour: 10.0,
      actualWorker: 2,
      actualHourPerWorker: 4.0,
      totalActualHour: 8.0,
      kasieApprovedBy: 'USR-017',
      kasieApprovedAt: '2026-03-10T16:00:00.000Z',
      kadisPusatApprovedBy: 'USR-015',
      kadisPusatApprovedAt: '2026-03-11T10:00:00.000Z',
      kadisPelaporApprovedBy: 'USR-012',
      kadisPelaporApprovedAt: '2026-03-12T09:00:00.000Z',
      status: 'completed',
      items: [
        { itemType: 'material', itemName: 'Starter Motor', quantity: 1, uom: 'pcs' },
        { itemType: 'material', itemName: 'Relay 12V', quantity: 2, uom: 'pcs' },
      ],
    },
  ];

  added = 0; skipped = 0;
  for (const s of spkCorrective) {
    const { items, ...spkData } = s;
    const [, created] = await SpkCorrective.findOrCreate({ where: { spkId: s.spkId }, defaults: spkData });

    if (created) {
      added++;
      for (const item of items) {
        const exists = await SpkCorrectiveItem.findOne({ where: { spkId: s.spkId, itemName: item.itemName } });
        if (!exists) await SpkCorrectiveItem.create({ ...item, spkId: s.spkId });
      }
    } else {
      skipped++;
    }
  }
  console.log(`  ✓  spk_corrective (+${added} added, ${skipped} already existed)`);

  console.log('\n  Seed complete! (no existing data was modified)\n');
  await sequelize.query('SET FOREIGN_KEY_CHECKS = 1');
  await sequelize.close();
}

main().catch(async err => {
  console.error('  ✗  Seed failed:\n', err);
  try { await sequelize.query('SET FOREIGN_KEY_CHECKS = 1'); } catch (e) { }
  process.exit(1);
});
