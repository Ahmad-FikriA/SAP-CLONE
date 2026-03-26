'use strict';

// Preventive-only seed — resets and reseeds:
//   plants, functional_locations, equipment, task_lists,
//   spk, lembar_kerja, submissions
//
// Does NOT touch: users, corrective, inspection tables.
// Run with: npm run seed:preventive

require('dotenv').config();
const path = require('path');
const sequelize = require('./config/database');
const Plant = require('./models/Plant');
const Equipment = require('./models/Equipment');
const { Spk, SpkEquipment, SpkActivity } = require('./models/Spk');
const { LembarKerja, LembarKerjaSpk } = require('./models/LembarKerja');
const { Submission, SubmissionPhoto, SubmissionActivityResult } = require('./models/Submission');
const FunctionalLocation = require('./models/FunctionalLocation');
const { GeneralTaskList, GeneralTaskListActivity } = require('./models/GeneralTaskList');

require('./models/associations');

// Load JSON data files
const funcLocData      = require(path.join(__dirname, '..', 'data', 'functional_locations.json'));
const sapEquipmentData = require(path.join(__dirname, '..', 'data', 'sap_equipment.json'));
const taskListData     = require(path.join(__dirname, '..', 'data', 'general_task_lists.json'));
const equipmentFileData = require(path.join(__dirname, '..', 'data', 'equipment.json'));

// ────────────────────────────────────────────────────────────────────────────
// PLANTS — corrected from SAP sticky note
// ────────────────────────────────────────────────────────────────────────────
const plants = [
  { plantId: 'I-22L001', plantName: 'PS I Cidanau',               shortName: 'PS I',          city: 'Cilegon', centerLat: null, centerLon: null, zoom: 17 },
  { plantId: 'I-22L002', plantName: 'Re-use Plant',               shortName: 'Re-use',        city: 'Cilegon', centerLat: null, centerLon: null, zoom: 17 },
  { plantId: 'I-22L003', plantName: 'PS II Waduk',                shortName: 'PS II',         city: 'Cilegon', centerLat: null, centerLon: null, zoom: 17 },
  { plantId: 'I-22L004', plantName: 'PS VII Cipasauran',          shortName: 'PS VII',        city: 'Serang',  centerLat: null, centerLon: null, zoom: 17 },
  { plantId: 'I-22L005', plantName: 'Bendung & Jalur Intake',     shortName: 'Bendung',       city: 'Cilegon', centerLat: null, centerLon: null, zoom: 17 },
  { plantId: 'P-22L006', plantName: 'WTP Cidanau',                shortName: 'WTP Cidanau',   city: 'Cilegon', centerLat: null, centerLon: null, zoom: 17 },
  { plantId: 'P-22L007', plantName: 'WTP Krenceng',               shortName: 'WTP Krenceng',  city: 'Cilegon', centerLat: null, centerLon: null, zoom: 17 },
  { plantId: 'D-22L010', plantName: 'Plant SEPS',                 shortName: 'SEPS',          city: 'Cilegon', centerLat: null, centerLon: null, zoom: 17 },
  { plantId: 'P-22L019', plantName: 'Pos Keamanan',               shortName: 'Pos',           city: 'Cilegon', centerLat: null, centerLon: null, zoom: 17 },
];

// ────────────────────────────────────────────────────────────────────────────
// EQUIPMENT — inline test/demo rows (from data/equipment.json + SAP bulk below)
// ────────────────────────────────────────────────────────────────────────────
const equipment = [
  ...equipmentFileData,

  // ── TEST EQUIPMENT — QR Scanner GPS Demo Scenarios ────────────────────────
  { equipmentId: 'EQ-TEST-01', equipmentName: '[TEST] Pompa Pusat — Dekat & Dalam',      funcLocId: 'A-A1-02-001-001', functionalLocation: 'Area Pusat Pabrik (Test)', category: 'Mekanik', plantId: 'I-22L001', plantName: 'PS I Cidanau', latitude: -6.0135, longitude: 106.0219 },
  { equipmentId: 'EQ-TEST-02', equipmentName: '[TEST] Pompa Timur — Dalam Pabrik, Jauh', funcLocId: 'A-A1-02-001-002', functionalLocation: 'Area Timur Pabrik (Test)', category: 'Mekanik', plantId: 'I-22L001', plantName: 'PS I Cidanau', latitude: -6.0117, longitude: 106.0219 },
  { equipmentId: 'EQ-TEST-03', equipmentName: '[TEST] Pompa Remote — Luar Pabrik',       funcLocId: 'A-A1-02-002-001', functionalLocation: 'Area Remote Jauh (Test)',  category: 'Mekanik', plantId: 'I-22L001', plantName: 'PS I Cidanau', latitude: -6.0600, longitude: 106.0219 },
];

// ────────────────────────────────────────────────────────────────────────────
// SPK
// ────────────────────────────────────────────────────────────────────────────
const spk = [
  // ── MEKANIK ──────────────────────────────────────────────────────────────
  {
    spkNumber: 'SPK-M-001',
    description: 'Perawatan Rutin Pompa Intake Cidanau 1M1 — Bulanan (Februari)',
    interval: '1 Bulan',
    category: 'Mekanik',
    status: 'pending',
    durationActual: null,
    equipmentModels: [
      { equipmentId: '2210000438', equipmentName: 'Pompa Intake Cidanau 1M1', functionalLocation: 'A-A1-01-005-004' },
    ],
    activitiesModel: [
      { activityNumber: 'ACT-001', operationText: 'Periksa tekanan pompa intake (bar)', resultComment: null, durationPlan: 0.5, durationActual: null, isVerified: false },
      { activityNumber: 'ACT-002', operationText: 'Cek kebocoran pipa dan fitting', resultComment: null, durationPlan: 0.5, durationActual: null, isVerified: false },
      { activityNumber: 'ACT-003', operationText: 'Pelumasan bearing motor pompa intake', resultComment: null, durationPlan: 0.25, durationActual: null, isVerified: false },
    ],
  },
  {
    spkNumber: 'SPK-M-002',
    description: 'Perawatan Rutin Pompa Intake Cidanau 2M1 — Bulanan (Maret)',
    interval: '1 Bulan',
    category: 'Mekanik',
    status: 'pending',
    durationActual: null,
    equipmentModels: [
      { equipmentId: '2210000439', equipmentName: 'Pompa Intake Cidanau 2M1', functionalLocation: 'A-A1-01-005-004' },
    ],
    activitiesModel: [
      { activityNumber: 'ACT-001', operationText: 'Periksa tekanan dan debit air keluar', resultComment: null, durationPlan: 0.5, durationActual: null, isVerified: false },
      { activityNumber: 'ACT-002', operationText: 'Bersihkan strainer / saringan pompa', resultComment: null, durationPlan: 0.5, durationActual: null, isVerified: false },
      { activityNumber: 'ACT-003', operationText: 'Cek vibrasi dan suara abnormal', resultComment: null, durationPlan: 0.25, durationActual: null, isVerified: false },
    ],
  },

  // ── LISTRIK ──────────────────────────────────────────────────────────────
  {
    spkNumber: 'SPK-L-001',
    description: 'Inspeksi Panel Katodik Cidanau I — Bulanan (Maret)',
    interval: '1 Bulan',
    category: 'Listrik',
    status: 'in_progress',
    durationActual: null,
    equipmentModels: [
      { equipmentId: '2210000640', equipmentName: 'Panel Katodik Cidanau I', functionalLocation: 'A-A1-01-005' },
    ],
    activitiesModel: [
      { activityNumber: 'ACT-001', operationText: 'Periksa tegangan output panel katodik (VDC)', resultComment: null, durationPlan: 0.5, durationActual: null, isVerified: false },
      { activityNumber: 'ACT-002', operationText: 'Cek kondisi elektroda dan sambungan kabel', resultComment: null, durationPlan: 0.5, durationActual: null, isVerified: false },
      { activityNumber: 'ACT-003', operationText: 'Bersihkan terminal dan periksa korosi', resultComment: null, durationPlan: 1.0, durationActual: null, isVerified: false },
    ],
  },
  {
    spkNumber: 'SPK-L-002',
    description: 'Servis Rutin Transformator BT 02 — 6 Bulanan',
    interval: '6 Bulan',
    category: 'Listrik',
    status: 'completed',
    durationActual: 3.0,
    equipmentModels: [
      { equipmentId: '2210000652', equipmentName: 'Transformator BT 02', functionalLocation: 'A-A1-01-004-002' },
    ],
    activitiesModel: [
      { activityNumber: 'ACT-001', operationText: 'Cek dan ambil sampel minyak isolasi trafo', resultComment: 'Minyak isolasi dalam kondisi baik, tidak ada kontaminasi', durationPlan: 0.5, durationActual: 0.5, isVerified: true },
      { activityNumber: 'ACT-002', operationText: 'Periksa tegangan primer dan sekunder (kV)', resultComment: 'Tegangan primer 20kV, sekunder 380V — normal', durationPlan: 0.5, durationActual: 0.75, isVerified: true },
      { activityNumber: 'ACT-003', operationText: 'Inspeksi bushing, terminal, dan grounding', resultComment: 'Semua bushing bersih, grounding terpasang baik', durationPlan: 1.0, durationActual: 1.25, isVerified: true },
    ],
  },

  // ── SIPIL ─────────────────────────────────────────────────────────────────
  {
    spkNumber: 'SPK-S-001',
    description: 'Pemeriksaan Manhole SLD Basin — 3 Bulanan',
    interval: '3 Bulan',
    category: 'Sipil',
    status: 'pending',
    durationActual: null,
    equipmentModels: [
      { equipmentId: '2210000327', equipmentName: 'Manhole SLD Basin', functionalLocation: 'A-A2-03-012' },
    ],
    activitiesModel: [
      { activityNumber: 'ACT-001', operationText: 'Periksa kondisi struktur dan tutup manhole', resultComment: null, durationPlan: 1.0, durationActual: null, isVerified: false },
      { activityNumber: 'ACT-002', operationText: 'Bersihkan sedimen dan lumpur dalam basin', resultComment: null, durationPlan: 2.0, durationActual: null, isVerified: false },
    ],
  },

  // ── OTOMASI ───────────────────────────────────────────────────────────────
  {
    spkNumber: 'SPK-O-001',
    description: 'Kalibrasi Sensor AWLR — 3 Bulanan',
    interval: '3 Bulan',
    category: 'Otomasi',
    status: 'pending',
    durationActual: null,
    equipmentModels: [
      { equipmentId: '2210000605', equipmentName: 'Sensor AWLR', functionalLocation: 'A-A1-01-001' },
    ],
    activitiesModel: [
      { activityNumber: 'ACT-001', operationText: 'Cek sinyal output sensor AWLR (4–20 mA)', resultComment: null, durationPlan: 0.5, durationActual: null, isVerified: false },
      { activityNumber: 'ACT-002', operationText: 'Kalibrasi titik ukur level air (0–100%)', resultComment: null, durationPlan: 1.0, durationActual: null, isVerified: false },
      { activityNumber: 'ACT-003', operationText: 'Periksa kabel sinyal dan koneksi terminal', resultComment: null, durationPlan: 0.25, durationActual: null, isVerified: false },
    ],
  },

  // ── Multi-month history ───────────────────────────────────────────────────
  {
    spkNumber: 'SPK-M-PMP-A-JAN',
    description: 'Perawatan Rutin Pompa Intake Cidanau 1M1 — Bulanan (Januari)',
    interval: '1 Bulan',
    category: 'Mekanik',
    status: 'completed',
    durationActual: 1.5,
    equipmentModels: [
      { equipmentId: '2210000438', equipmentName: 'Pompa Intake Cidanau 1M1', functionalLocation: 'A-A1-01-005-004' },
    ],
    activitiesModel: [
      { activityNumber: 'ACT-001', operationText: 'Periksa tekanan pompa intake (bar)', resultComment: 'Tekanan normal: 4.2 bar', durationPlan: 0.5, durationActual: 0.5, isVerified: true },
      { activityNumber: 'ACT-002', operationText: 'Cek kebocoran pipa dan fitting', resultComment: 'Tidak ada kebocoran', durationPlan: 0.5, durationActual: 0.5, isVerified: true },
      { activityNumber: 'ACT-003', operationText: 'Pelumasan bearing motor pompa intake', resultComment: 'Bearing dilumasi, kondisi baik', durationPlan: 0.25, durationActual: 0.25, isVerified: true },
    ],
  },
  {
    spkNumber: 'SPK-M-BST-JAN',
    description: 'Perawatan Pompa Booster Clorine Cidanau — Bulanan (Januari)',
    interval: '1 Bulan',
    category: 'Mekanik',
    status: 'completed',
    durationActual: 1.0,
    equipmentModels: [
      { equipmentId: '2210000449', equipmentName: 'Pompa Booster Clorine Cidanau', functionalLocation: 'A-A1-01-005-006' },
    ],
    activitiesModel: [
      { activityNumber: 'ACT-001', operationText: 'Cek tekanan output pompa booster clorine', resultComment: 'Tekanan normal: 3.8 bar', durationPlan: 0.5, durationActual: 0.5, isVerified: true },
      { activityNumber: 'ACT-002', operationText: 'Inspeksi seal dan gasket', resultComment: 'Seal dalam kondisi baik', durationPlan: 0.25, durationActual: 0.25, isVerified: true },
      { activityNumber: 'ACT-003', operationText: 'Cek arus motor (ampere)', resultComment: 'Arus normal: 8.5 A', durationPlan: 0.25, durationActual: 0.25, isVerified: true },
    ],
  },
  {
    spkNumber: 'SPK-M-BST-FEB',
    description: 'Perawatan Pompa Booster Clorine Cidanau — Bulanan (Februari)',
    interval: '1 Bulan',
    category: 'Mekanik',
    status: 'completed',
    durationActual: 1.25,
    equipmentModels: [
      { equipmentId: '2210000449', equipmentName: 'Pompa Booster Clorine Cidanau', functionalLocation: 'A-A1-01-005-006' },
    ],
    activitiesModel: [
      { activityNumber: 'ACT-001', operationText: 'Cek tekanan output pompa booster clorine', resultComment: 'Tekanan sedikit turun: 3.5 bar, disetel ulang', durationPlan: 0.5, durationActual: 0.75, isVerified: true },
      { activityNumber: 'ACT-002', operationText: 'Inspeksi seal dan gasket', resultComment: 'Seal mulai aus, dijadwalkan ganti bulan depan', durationPlan: 0.25, durationActual: 0.25, isVerified: true },
      { activityNumber: 'ACT-003', operationText: 'Cek arus motor (ampere)', resultComment: 'Arus normal: 8.7 A', durationPlan: 0.25, durationActual: 0.25, isVerified: true },
    ],
  },
  {
    spkNumber: 'SPK-M-BST-MAR',
    description: 'Perawatan Pompa Booster Clorine Cidanau — Bulanan (Maret)',
    interval: '1 Bulan',
    category: 'Mekanik',
    status: 'pending',
    durationActual: null,
    equipmentModels: [
      { equipmentId: '2210000449', equipmentName: 'Pompa Booster Clorine Cidanau', functionalLocation: 'A-A1-01-005-006' },
    ],
    activitiesModel: [
      { activityNumber: 'ACT-001', operationText: 'Cek tekanan output pompa booster clorine', resultComment: null, durationPlan: 0.5, durationActual: null, isVerified: false },
      { activityNumber: 'ACT-002', operationText: 'Ganti seal (tindak lanjut Februari)', resultComment: null, durationPlan: 0.5, durationActual: null, isVerified: false },
      { activityNumber: 'ACT-003', operationText: 'Cek arus motor (ampere)', resultComment: null, durationPlan: 0.25, durationActual: null, isVerified: false },
    ],
  },
  {
    spkNumber: 'SPK-L-PNL-JAN',
    description: 'Inspeksi Panel Katodik Cidanau I — Bulanan (Januari)',
    interval: '1 Bulan',
    category: 'Listrik',
    status: 'completed',
    durationActual: 1.5,
    equipmentModels: [
      { equipmentId: '2210000640', equipmentName: 'Panel Katodik Cidanau I', functionalLocation: 'A-A1-01-005' },
    ],
    activitiesModel: [
      { activityNumber: 'ACT-001', operationText: 'Periksa tegangan output panel katodik (VDC)', resultComment: 'Tegangan output normal: 24 VDC', durationPlan: 0.5, durationActual: 0.5, isVerified: true },
      { activityNumber: 'ACT-002', operationText: 'Cek kondisi elektroda dan sambungan kabel', resultComment: 'Elektroda dan kabel dalam kondisi baik', durationPlan: 0.5, durationActual: 0.5, isVerified: true },
      { activityNumber: 'ACT-003', operationText: 'Bersihkan terminal dan periksa korosi', resultComment: 'Terminal dibersihkan, tidak ada korosi', durationPlan: 1.0, durationActual: 0.5, isVerified: true },
    ],
  },
  {
    spkNumber: 'SPK-L-PNL-FEB',
    description: 'Inspeksi Panel Katodik Cidanau I — Bulanan (Februari)',
    interval: '1 Bulan',
    category: 'Listrik',
    status: 'completed',
    durationActual: 2.0,
    equipmentModels: [
      { equipmentId: '2210000640', equipmentName: 'Panel Katodik Cidanau I', functionalLocation: 'A-A1-01-005' },
    ],
    activitiesModel: [
      { activityNumber: 'ACT-001', operationText: 'Periksa tegangan output panel katodik (VDC)', resultComment: 'Tegangan output: 23.5 VDC, sedikit turun', durationPlan: 0.5, durationActual: 0.5, isVerified: true },
      { activityNumber: 'ACT-002', operationText: 'Cek kondisi elektroda dan sambungan kabel', resultComment: '1 sambungan kabel longgar, sudah dikencangkan', durationPlan: 0.5, durationActual: 0.5, isVerified: true },
      { activityNumber: 'ACT-003', operationText: 'Bersihkan terminal dan periksa korosi', resultComment: 'Ditemukan sedikit korosi pada terminal, dibersihkan', durationPlan: 1.0, durationActual: 1.0, isVerified: true },
    ],
  },
];

// Assign equipmentId to each activity (round-robin)
spk.forEach(s => {
  const equips = s.equipmentModels;
  s.activitiesModel.forEach((act, i) => {
    if (!act.equipmentId) {
      act.equipmentId = equips.length > 0 ? equips[i % equips.length].equipmentId : null;
    }
  });
});

// ────────────────────────────────────────────────────────────────────────────
// LEMBAR KERJA
// ────────────────────────────────────────────────────────────────────────────
const lembarKerja = [
  { lkNumber: 'LK-JAN-MEK', periodeStart: '2026-01-01T00:00:00.000Z', periodeEnd: '2026-01-31T23:59:59.000Z', category: 'Mekanik', status: 'completed', lembarKe: 1, totalLembar: 1, evaluasi: 'Perawatan Mekanik Januari selesai. Semua peralatan dalam kondisi baik.', spkModels: ['SPK-M-PMP-A-JAN', 'SPK-M-BST-JAN'] },
  { lkNumber: 'LK-JAN-LIS', periodeStart: '2026-01-01T00:00:00.000Z', periodeEnd: '2026-01-31T23:59:59.000Z', category: 'Listrik', status: 'completed', lembarKe: 1, totalLembar: 1, evaluasi: 'Inspeksi Listrik Januari selesai. Tidak ada temuan kritis.', spkModels: ['SPK-L-PNL-JAN'] },
  { lkNumber: 'LK-FEB-MEK', periodeStart: '2026-02-01T00:00:00.000Z', periodeEnd: '2026-02-28T23:59:59.000Z', category: 'Mekanik', status: 'in_progress', lembarKe: 1, totalLembar: 1, evaluasi: null, spkModels: ['SPK-M-001', 'SPK-M-BST-FEB'] },
  { lkNumber: 'LK-FEB-LIS', periodeStart: '2026-02-01T00:00:00.000Z', periodeEnd: '2026-02-28T23:59:59.000Z', category: 'Listrik', status: 'completed', lembarKe: 1, totalLembar: 1, evaluasi: 'Inspeksi Listrik Februari selesai. 1 MCB perlu penggantian, sudah dilaporkan.', spkModels: ['SPK-L-PNL-FEB'] },
  { lkNumber: 'LK-MAR-MEK', periodeStart: '2026-03-01T00:00:00.000Z', periodeEnd: '2026-03-31T23:59:59.000Z', category: 'Mekanik', status: 'in_progress', lembarKe: 1, totalLembar: 1, evaluasi: null, spkModels: ['SPK-M-002', 'SPK-M-BST-MAR'] },
  { lkNumber: 'LK-MAR-LIS', periodeStart: '2026-03-01T00:00:00.000Z', periodeEnd: '2026-03-31T23:59:59.000Z', category: 'Listrik', status: 'in_progress', lembarKe: 1, totalLembar: 1, evaluasi: null, spkModels: ['SPK-L-001', 'SPK-L-002'] },
  { lkNumber: 'LK-MAR-SIP', periodeStart: '2026-03-01T00:00:00.000Z', periodeEnd: '2026-03-31T23:59:59.000Z', category: 'Sipil', status: 'pending', lembarKe: 1, totalLembar: 1, evaluasi: null, spkModels: ['SPK-S-001'] },
  { lkNumber: 'LK-MAR-OTO', periodeStart: '2026-03-01T00:00:00.000Z', periodeEnd: '2026-03-31T23:59:59.000Z', category: 'Otomasi', status: 'pending', lembarKe: 1, totalLembar: 1, evaluasi: null, spkModels: ['SPK-O-001'] },
];

// ────────────────────────────────────────────────────────────────────────────
// SUBMISSIONS
// ────────────────────────────────────────────────────────────────────────────
const submissions = [
  {
    id: 'SUB-001', spkNumber: 'SPK-L-002', durationActual: 3.0,
    evaluasi: 'Servis genset berjalan lancar. Semua komponen dalam kondisi baik pasca servis.',
    latitude: -6.0141, longitude: 106.0220, submittedAt: '2026-02-20T14:00:00.000Z', photoPaths: [],
    activityResultsModel: [
      { activityNumber: 'ACT-001', resultComment: 'Oli diganti dengan Pertamina Fastron 15W40', isNormal: true, isVerified: true },
      { activityNumber: 'ACT-002', resultComment: 'Kedua filter sudah diganti baru', isNormal: true, isVerified: true },
      { activityNumber: 'ACT-003', resultComment: 'Genset beroperasi normal, output 200V/50Hz', isNormal: true, isVerified: true },
    ],
  },
  {
    id: 'SUB-002', spkNumber: 'SPK-M-PMP-A-JAN', durationActual: 1.5,
    evaluasi: 'Perawatan Pompa A Januari selesai. Tidak ada temuan kritis.',
    latitude: -6.0131, longitude: 106.0215, submittedAt: '2026-01-22T09:30:00.000Z', photoPaths: [],
    activityResultsModel: [
      { activityNumber: 'ACT-001', resultComment: 'Tekanan normal: 4.2 bar', isNormal: true, isVerified: true },
      { activityNumber: 'ACT-002', resultComment: 'Tidak ada kebocoran', isNormal: true, isVerified: true },
      { activityNumber: 'ACT-003', resultComment: 'Bearing dilumasi, kondisi baik', isNormal: true, isVerified: true },
    ],
  },
  {
    id: 'SUB-003', spkNumber: 'SPK-M-BST-JAN', durationActual: 1.0,
    evaluasi: 'Perawatan Pompa Booster Januari selesai. Semua normal.',
    latitude: -6.0128, longitude: 106.0222, submittedAt: '2026-01-23T11:00:00.000Z', photoPaths: [],
    activityResultsModel: [
      { activityNumber: 'ACT-001', resultComment: 'Tekanan normal: 3.8 bar', isNormal: true, isVerified: true },
      { activityNumber: 'ACT-002', resultComment: 'Seal dalam kondisi baik', isNormal: true, isVerified: true },
      { activityNumber: 'ACT-003', resultComment: 'Arus normal: 8.5 A', isNormal: true, isVerified: true },
    ],
  },
  {
    id: 'SUB-004', spkNumber: 'SPK-L-PNL-JAN', durationActual: 1.5,
    evaluasi: 'Inspeksi Panel Listrik Januari selesai. Tidak ada temuan kritis.',
    latitude: -6.0136, longitude: 106.0224, submittedAt: '2026-01-20T14:00:00.000Z', photoPaths: [],
    activityResultsModel: [
      { activityNumber: 'ACT-001', resultComment: 'Tegangan normal 380V / 220V', isNormal: true, isVerified: true },
      { activityNumber: 'ACT-002', resultComment: 'Semua MCB berfungsi normal', isNormal: true, isVerified: true },
      { activityNumber: 'ACT-003', resultComment: 'Busbar dibersihkan, tidak ada korosi', isNormal: true, isVerified: true },
    ],
  },
  {
    id: 'SUB-005', spkNumber: 'SPK-M-BST-FEB', durationActual: 1.25,
    evaluasi: 'Perawatan Pompa Booster Februari selesai. Tekanan disetel ulang, seal dijadwalkan ganti bulan depan.',
    latitude: -6.0128, longitude: 106.0222, submittedAt: '2026-02-21T10:00:00.000Z', photoPaths: [],
    activityResultsModel: [
      { activityNumber: 'ACT-001', resultComment: 'Tekanan sedikit turun: 3.5 bar, disetel ulang', isNormal: false, isVerified: true },
      { activityNumber: 'ACT-002', resultComment: 'Seal mulai aus, dijadwalkan ganti bulan depan', isNormal: false, isVerified: true },
      { activityNumber: 'ACT-003', resultComment: 'Arus normal: 8.7 A', isNormal: true, isVerified: true },
    ],
  },
  {
    id: 'SUB-006', spkNumber: 'SPK-L-PNL-FEB', durationActual: 2.0,
    evaluasi: 'Inspeksi Panel Listrik Februari selesai. 1 MCB perlu penggantian, sudah dilaporkan ke pengadaan.',
    latitude: -6.0136, longitude: 106.0224, submittedAt: '2026-02-19T13:00:00.000Z', photoPaths: [],
    activityResultsModel: [
      { activityNumber: 'ACT-001', resultComment: 'Tegangan normal 382V / 221V', isNormal: true, isVerified: true },
      { activityNumber: 'ACT-002', resultComment: '1 MCB perlu penggantian, sudah dilaporkan', isNormal: false, isVerified: true },
      { activityNumber: 'ACT-003', resultComment: 'Busbar bersih', isNormal: true, isVerified: true },
    ],
  },
];

// ────────────────────────────────────────────────────────────────────────────
// MAIN
// ────────────────────────────────────────────────────────────────────────────
async function main() {
  await sequelize.authenticate();
  await sequelize.sync({ alter: true });
  console.log('\n  KTI SmartCare — Preventive Seed\n');

  // ── 1. Truncate in FK-safe order ──────────────────────────────────────────
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
    const defaults = {
      equipmentId: se.equipmentId,
      equipmentName: se.equipmentName,
      plantId: se.plantId,
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

  // ── 7. SPK ────────────────────────────────────────────────────────────────
  for (const s of spk) {
    await Spk.create({ spkNumber: s.spkNumber, description: s.description, intervalPeriod: s.interval, category: s.category, status: s.status, durationActual: s.durationActual });
    for (const eq of s.equipmentModels) {
      await SpkEquipment.create({ spkNumber: s.spkNumber, equipmentId: eq.equipmentId, equipmentName: eq.equipmentName, functionalLocation: eq.functionalLocation });
    }
    for (const act of s.activitiesModel) {
      await SpkActivity.create({ spkNumber: s.spkNumber, activityNumber: act.activityNumber, equipmentId: act.equipmentId || null, operationText: act.operationText, resultComment: act.resultComment || null, durationPlan: act.durationPlan, durationActual: act.durationActual || null, isVerified: act.isVerified || false });
    }
  }
  console.log(`  ✓  spk            (${spk.length} inserted)`);

  // ── 8. Lembar Kerja ───────────────────────────────────────────────────────
  for (const lk of lembarKerja) {
    await LembarKerja.create({ lkNumber: lk.lkNumber, periodeStart: lk.periodeStart, periodeEnd: lk.periodeEnd, category: lk.category, status: lk.status, lembarKe: lk.lembarKe, totalLembar: lk.totalLembar, evaluasi: lk.evaluasi || null });
    for (const spkNum of lk.spkModels) {
      await LembarKerjaSpk.create({ lkNumber: lk.lkNumber, spkNumber: spkNum });
    }
  }
  console.log(`  ✓  lembar_kerja   (${lembarKerja.length} inserted)`);

  // ── 9. Submissions ────────────────────────────────────────────────────────
  for (const sub of submissions) {
    await Submission.create({ id: sub.id, spkNumber: sub.spkNumber, durationActual: sub.durationActual, evaluasi: sub.evaluasi || null, latitude: sub.latitude, longitude: sub.longitude, submittedAt: sub.submittedAt });
    for (const p of (sub.photoPaths || [])) {
      await SubmissionPhoto.create({ submissionId: sub.id, photoPath: p });
    }
    for (const r of (sub.activityResultsModel || [])) {
      await SubmissionActivityResult.create({ submissionId: sub.id, activityNumber: r.activityNumber, resultComment: r.resultComment || null, isNormal: r.isNormal ?? true, isVerified: r.isVerified ?? false });
    }
  }
  console.log(`  ✓  submissions    (${submissions.length} inserted)`);

  console.log('\n  Preventive seed complete!\n');
}

main()
  .then(() => process.exit(0))
  .catch(err => { console.error(err); process.exit(1); });
