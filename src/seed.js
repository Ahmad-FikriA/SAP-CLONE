'use strict';

require('dotenv').config();
const path = require('path');
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

// Ensure all relationship and new models are loaded before syncing
require('./models/associations');

// Load JSON data from converted Excel
const funcLocData = require(path.join(__dirname, '..', 'data', 'functional_locations.json'));
const sapEquipmentData = require(path.join(__dirname, '..', 'data', 'sap_equipment.json'));
const taskListData = require(path.join(__dirname, '..', 'data', 'general_task_lists.json'));
const equipmentFileData = require(path.join(__dirname, '..', 'data', 'equipment.json'));

// ────────────────────────────────────────────────────────────────────────────
// USERS
// ────────────────────────────────────────────────────────────────────────────
const users = [
  { id: 'USR-001', username: 'teknisi_01', password: 'password123', name: 'Budi Santoso', role: 'teknisi', email: 'budi@kti-water.co.id' },
  { id: 'USR-002', username: 'planner_01', password: 'password123', name: 'Siti Rahayu', role: 'planner', email: 'siti@kti-water.co.id' },
  { id: 'USR-003', username: 'supervisor_01', password: 'password123', name: 'Ahmad Fauzi', role: 'supervisor', email: 'ahmad@kti-water.co.id' },
  { id: 'USR-004', username: 'manager_01', password: 'password123', name: 'Dewi Kusuma', role: 'manager', email: 'dewi@kti-water.co.id' },
  { id: 'USR-005', username: 'admin_01', password: 'password123', name: 'Admin KTI', role: 'admin', email: 'admin@kti-water.co.id' },
  { id: 'USR-006', username: 'mekanik_01', password: 'password123', name: 'Riko Prasetyo', role: 'teknisi_mekanik', email: 'riko@kti-water.co.id' },
  { id: 'USR-007', username: 'listrik_01', password: 'password123', name: 'Hendra Gunawan', role: 'teknisi_listrik', email: 'hendra@kti-water.co.id' },
  { id: 'USR-008', username: 'sipil_01', password: 'password123', name: 'Agus Wijaya', role: 'teknisi_sipil', email: 'agus@kti-water.co.id' },
  { id: 'USR-009', username: 'otomasi_01', password: 'password123', name: 'Dian Permana', role: 'teknisi_otomasi', email: 'dian@kti-water.co.id' },
  { id: 'USR-010', username: 'user_01', password: 'password123', name: 'Rina Marlina', role: 'user', email: 'rina@kti-water.co.id' },
  // Corrective Maintenance Users
  { id: 'USR-011', username: 'kadis_mekanik', password: 'password123', name: 'Kadis Mekanik', role: 'kadis_mekanik', email: 'kadis.mekanik@kti-water.co.id' },
  { id: 'USR-012', username: 'kadis_listrik', password: 'password123', name: 'Kadis Listrik', role: 'kadis_listrik', email: 'kadis.listrik@kti-water.co.id' },
  { id: 'USR-013', username: 'kadis_sipil', password: 'password123', name: 'Kadis Sipil', role: 'kadis_sipil', email: 'kadis.sipil@kti-water.co.id' },
  { id: 'USR-014', username: 'kadis_otomasi', password: 'password123', name: 'Kadis Otomasi', role: 'kadis_otomasi', email: 'kadis.otomasi@kti-water.co.id' },
  { id: 'USR-015', username: 'kadis_pusat', password: 'password123', name: 'Kadis Pusat Perawatan', role: 'kadis_pusat', email: 'kadis.pusat@kti-water.co.id' },
  { id: 'USR-016', username: 'kasie_mekanik', password: 'password123', name: 'Kasie Mekanik', role: 'kasie_mekanik', email: 'kasie.mekanik@kti-water.co.id' },
  { id: 'USR-017', username: 'kasie_listrik', password: 'password123', name: 'Kasie Listrik', role: 'kasie_listrik', email: 'kasie.listrik@kti-water.co.id' },
  { id: 'USR-018', username: 'kasie_sipil', password: 'password123', name: 'Kasie Sipil', role: 'kasie_sipil', email: 'kasie.sipil@kti-water.co.id' },
  { id: 'USR-019', username: 'kasie_otomasi', password: 'password123', name: 'Kasie Otomasi', role: 'kasie_otomasi', email: 'kasie.otomasi@kti-water.co.id' },
];

// ────────────────────────────────────────────────────────────────────────────
// EQUIPMENT — loaded from data/equipment.json (single source of truth)
//
// Real IDs from data/equipment.json:
//   EQ-001  Pompa Air Utama A         Basement Lantai B1      Mekanik
//   EQ-002  Pompa Air Utama B         Basement Lantai B1      Mekanik
//   EQ-003  Pompa Booster Lantai 5    Ruang Pompa Lantai 5    Mekanik
//   EQ-004  Kompresor Udara Gedung    Ruang Utilitas B2       Mekanik
//   EQ-005  Panel Listrik Utama       Ruang Panel Lantai 1    Listrik
//   EQ-006  Panel Distribusi Lantai 3 Ruang Panel Lantai 3    Listrik
//   EQ-007  Genset Cadangan 200 kVA   Area Genset Basement    Listrik
//   EQ-008  Bak Penampungan Utama     Area Luar Gedung        Sipil
//   EQ-009  Saluran Drainase Utara    Area Drainase Utara     Sipil
//   EQ-010  Sensor Level Air Tank 1   Rooftop Area            Otomasi
// ────────────────────────────────────────────────────────────────────────────
const equipment = [
  ...equipmentFileData,

  // ── TEST EQUIPMENT — QR Scanner GPS Demo Scenarios ────────────────────────
  { equipmentId: 'EQ-TEST-01', equipmentName: '[TEST] Pompa Pusat — Dekat & Dalam',      functionalLocation: 'Area Pusat Pabrik (Test)', category: 'Mekanik', plantId: 'KTI-01', plantName: 'PT Krakatau Tirta Industri', latitude: -6.0135, longitude: 106.0219 },
  { equipmentId: 'EQ-TEST-02', equipmentName: '[TEST] Pompa Timur — Dalam Pabrik, Jauh', functionalLocation: 'Area Timur Pabrik (Test)', category: 'Mekanik', plantId: 'KTI-01', plantName: 'PT Krakatau Tirta Industri', latitude: -6.0117, longitude: 106.0219 },
  { equipmentId: 'EQ-TEST-03', equipmentName: '[TEST] Pompa Remote — Luar Pabrik',       functionalLocation: 'Area Remote Jauh (Test)',  category: 'Mekanik', plantId: 'KTI-01', plantName: 'PT Krakatau Tirta Industri', latitude: -6.0600, longitude: 106.0219 },
];

// ────────────────────────────────────────────────────────────────────────────
// SPK
//
// Equipment IDs match data/equipment.json:
//   EQ-001  Pompa Air Utama A      EQ-005  Panel Listrik Utama
//   EQ-002  Pompa Air Utama B      EQ-006  Panel Distribusi Lantai 3
//   EQ-003  Pompa Booster Lantai 5 EQ-007  Genset Cadangan 200 kVA
//   EQ-004  Kompresor Udara Gedung EQ-008  Bak Penampungan Utama
//                                  EQ-009  Saluran Drainase Utara
//                                  EQ-010  Sensor Level Air Tank 1
//
// dueDate comes from the parent LK's periodeEnd (computed in spkController).
// SPK-M-001 → LK-FEB-MEK (periodeEnd = 2026-02-28, PAST) → isOverdue = true.
// ────────────────────────────────────────────────────────────────────────────
const spk = [
  // ── MEKANIK ──────────────────────────────────────────────────────────────

  // ⚠️ OVERDUE: LK periodeEnd = 2026-02-28 (past). Status still pending.
  {
    spkNumber: 'SPK-M-001',
    description: 'Perawatan Rutin Pompa Air Utama A — Bulanan (Februari)',
    interval: '1 Bulan',
    category: 'Mekanik',
    status: 'pending',
    durationActual: null,
    equipmentModels: [
      { equipmentId: 'EQ-001', equipmentName: 'Pompa Air Utama A', functionalLocation: 'Basement Lantai B1' },
    ],
    activitiesModel: [
      { activityNumber: 'ACT-001', operationText: 'Periksa tekanan pompa (bar)',         resultComment: null, durationPlan: 0.5,  durationActual: null, isVerified: false },
      { activityNumber: 'ACT-002', operationText: 'Cek kebocoran pipa dan fitting',       resultComment: null, durationPlan: 0.5,  durationActual: null, isVerified: false },
      { activityNumber: 'ACT-003', operationText: 'Pelumasan bearing motor pompa',        resultComment: null, durationPlan: 0.25, durationActual: null, isVerified: false },
    ],
  },

  {
    spkNumber: 'SPK-M-002',
    description: 'Perawatan Rutin Pompa Air Utama B — Bulanan (Maret)',
    interval: '1 Bulan',
    category: 'Mekanik',
    status: 'pending',
    durationActual: null,
    equipmentModels: [
      { equipmentId: 'EQ-002', equipmentName: 'Pompa Air Utama B', functionalLocation: 'Basement Lantai B1' },
    ],
    activitiesModel: [
      { activityNumber: 'ACT-001', operationText: 'Periksa tekanan dan debit air keluar', resultComment: null, durationPlan: 0.5,  durationActual: null, isVerified: false },
      { activityNumber: 'ACT-002', operationText: 'Bersihkan strainer / saringan pompa',  resultComment: null, durationPlan: 0.5,  durationActual: null, isVerified: false },
      { activityNumber: 'ACT-003', operationText: 'Cek vibrasi dan suara abnormal',       resultComment: null, durationPlan: 0.25, durationActual: null, isVerified: false },
    ],
  },

  // ── LISTRIK ──────────────────────────────────────────────────────────────

  {
    spkNumber: 'SPK-L-001',
    description: 'Inspeksi Panel Listrik Utama — Bulanan (Maret)',
    interval: '1 Bulan',
    category: 'Listrik',
    status: 'in_progress',
    durationActual: null,
    equipmentModels: [
      { equipmentId: 'EQ-005', equipmentName: 'Panel Listrik Utama', functionalLocation: 'Ruang Panel Lantai 1' },
    ],
    activitiesModel: [
      { activityNumber: 'ACT-001', operationText: 'Periksa tegangan input dan output (VAC)', resultComment: null, durationPlan: 0.5, durationActual: null, isVerified: false },
      { activityNumber: 'ACT-002', operationText: 'Cek kondisi MCB dan MCCB',                resultComment: null, durationPlan: 0.5, durationActual: null, isVerified: false },
      { activityNumber: 'ACT-003', operationText: 'Bersihkan debu pada busbar dan terminal', resultComment: null, durationPlan: 1.0, durationActual: null, isVerified: false },
    ],
  },

  {
    spkNumber: 'SPK-L-002',
    description: 'Servis Rutin Genset Cadangan 200 kVA — 6 Bulanan',
    interval: '6 Bulan',
    category: 'Listrik',
    status: 'completed',
    durationActual: 3.0,
    equipmentModels: [
      { equipmentId: 'EQ-007', equipmentName: 'Genset Cadangan 200 kVA', functionalLocation: 'Area Genset Basement' },
    ],
    activitiesModel: [
      { activityNumber: 'ACT-001', operationText: 'Ganti oli mesin genset',                  resultComment: 'Oli diganti dengan Pertamina Fastron 15W40', durationPlan: 0.5, durationActual: 0.5,  isVerified: true },
      { activityNumber: 'ACT-002', operationText: 'Ganti filter oli dan filter bahan bakar',  resultComment: 'Kedua filter sudah diganti baru',             durationPlan: 0.5, durationActual: 0.75, isVerified: true },
      { activityNumber: 'ACT-003', operationText: 'Uji coba operasi beban penuh 30 menit',   resultComment: 'Genset beroperasi normal, output 200V/50Hz',  durationPlan: 1.0, durationActual: 1.25, isVerified: true },
    ],
  },

  // ── SIPIL ─────────────────────────────────────────────────────────────────

  {
    spkNumber: 'SPK-S-001',
    description: 'Pemeriksaan Bak Penampungan Utama — 3 Bulanan',
    interval: '3 Bulan',
    category: 'Sipil',
    status: 'pending',
    durationActual: null,
    equipmentModels: [
      { equipmentId: 'EQ-008', equipmentName: 'Bak Penampungan Utama', functionalLocation: 'Area Luar Gedung' },
    ],
    activitiesModel: [
      { activityNumber: 'ACT-001', operationText: 'Periksa kebocoran dinding dan lantai bak', resultComment: null, durationPlan: 1.0, durationActual: null, isVerified: false },
      { activityNumber: 'ACT-002', operationText: 'Bersihkan sedimen dan lumpur dasar bak',   resultComment: null, durationPlan: 2.0, durationActual: null, isVerified: false },
    ],
  },

  // ── OTOMASI ───────────────────────────────────────────────────────────────

  {
    spkNumber: 'SPK-O-001',
    description: 'Kalibrasi Sensor Level Air Tank 1 — 3 Bulanan',
    interval: '3 Bulan',
    category: 'Otomasi',
    status: 'pending',
    durationActual: null,
    equipmentModels: [
      { equipmentId: 'EQ-010', equipmentName: 'Sensor Level Air Tank 1', functionalLocation: 'Rooftop Area' },
    ],
    activitiesModel: [
      { activityNumber: 'ACT-001', operationText: 'Cek sinyal output sensor (4–20 mA)',       resultComment: null, durationPlan: 0.5,  durationActual: null, isVerified: false },
      { activityNumber: 'ACT-002', operationText: 'Kalibrasi titik 0% dan 100% level',        resultComment: null, durationPlan: 1.0,  durationActual: null, isVerified: false },
      { activityNumber: 'ACT-003', operationText: 'Periksa kabel sinyal dan koneksi terminal', resultComment: null, durationPlan: 0.25, durationActual: null, isVerified: false },
    ],
  },

  // ── EQ-001 Pompa Air Utama A — multi-month history (for EquipmentHistoryPage demo) ──

  // EQ-001 Pompa Air Utama A — Jan + Feb completed (Feb is SPK-M-001, already OVERDUE above)
  {
    spkNumber: 'SPK-M-PMP-A-JAN',
    description: 'Perawatan Rutin Pompa Air Utama A — Bulanan (Januari)',
    interval: '1 Bulan',
    category: 'Mekanik',
    status: 'completed',
    durationActual: 1.5,
    equipmentModels: [
      { equipmentId: 'EQ-001', equipmentName: 'Pompa Air Utama A', functionalLocation: 'Basement Lantai B1' },
    ],
    activitiesModel: [
      { activityNumber: 'ACT-001', operationText: 'Periksa tekanan pompa (bar)',       resultComment: 'Tekanan normal: 4.2 bar',               durationPlan: 0.5,  durationActual: 0.5,  isVerified: true },
      { activityNumber: 'ACT-002', operationText: 'Cek kebocoran pipa dan fitting',    resultComment: 'Tidak ada kebocoran',                   durationPlan: 0.5,  durationActual: 0.5,  isVerified: true },
      { activityNumber: 'ACT-003', operationText: 'Pelumasan bearing motor pompa',    resultComment: 'Bearing dilumasi, kondisi baik',         durationPlan: 0.25, durationActual: 0.25, isVerified: true },
    ],
  },

  // ── EQ-003 Pompa Booster Lantai 5 — 3-month history ──────────────────────

  {
    spkNumber: 'SPK-M-BST-JAN',
    description: 'Perawatan Pompa Booster Lantai 5 — Bulanan (Januari)',
    interval: '1 Bulan',
    category: 'Mekanik',
    status: 'completed',
    durationActual: 1.0,
    equipmentModels: [
      { equipmentId: 'EQ-003', equipmentName: 'Pompa Booster Lantai 5', functionalLocation: 'Ruang Pompa Lantai 5' },
    ],
    activitiesModel: [
      { activityNumber: 'ACT-001', operationText: 'Cek tekanan output pompa booster', resultComment: 'Tekanan normal: 3.8 bar',               durationPlan: 0.5,  durationActual: 0.5,  isVerified: true },
      { activityNumber: 'ACT-002', operationText: 'Inspeksi seal dan gasket',         resultComment: 'Seal dalam kondisi baik',               durationPlan: 0.25, durationActual: 0.25, isVerified: true },
      { activityNumber: 'ACT-003', operationText: 'Cek arus motor (ampere)',          resultComment: 'Arus normal: 8.5 A',                   durationPlan: 0.25, durationActual: 0.25, isVerified: true },
    ],
  },

  {
    spkNumber: 'SPK-M-BST-FEB',
    description: 'Perawatan Pompa Booster Lantai 5 — Bulanan (Februari)',
    interval: '1 Bulan',
    category: 'Mekanik',
    status: 'completed',
    durationActual: 1.25,
    equipmentModels: [
      { equipmentId: 'EQ-003', equipmentName: 'Pompa Booster Lantai 5', functionalLocation: 'Ruang Pompa Lantai 5' },
    ],
    activitiesModel: [
      { activityNumber: 'ACT-001', operationText: 'Cek tekanan output pompa booster', resultComment: 'Tekanan sedikit turun: 3.5 bar, disetel ulang', durationPlan: 0.5,  durationActual: 0.75, isVerified: true },
      { activityNumber: 'ACT-002', operationText: 'Inspeksi seal dan gasket',         resultComment: 'Seal mulai aus, dijadwalkan ganti bulan depan', durationPlan: 0.25, durationActual: 0.25, isVerified: true },
      { activityNumber: 'ACT-003', operationText: 'Cek arus motor (ampere)',          resultComment: 'Arus normal: 8.7 A',                          durationPlan: 0.25, durationActual: 0.25, isVerified: true },
    ],
  },

  {
    spkNumber: 'SPK-M-BST-MAR',
    description: 'Perawatan Pompa Booster Lantai 5 — Bulanan (Maret)',
    interval: '1 Bulan',
    category: 'Mekanik',
    status: 'pending',
    durationActual: null,
    equipmentModels: [
      { equipmentId: 'EQ-003', equipmentName: 'Pompa Booster Lantai 5', functionalLocation: 'Ruang Pompa Lantai 5' },
    ],
    activitiesModel: [
      { activityNumber: 'ACT-001', operationText: 'Cek tekanan output pompa booster', resultComment: null, durationPlan: 0.5,  durationActual: null, isVerified: false },
      { activityNumber: 'ACT-002', operationText: 'Ganti seal (tindak lanjut Feb)',   resultComment: null, durationPlan: 0.5,  durationActual: null, isVerified: false },
      { activityNumber: 'ACT-003', operationText: 'Cek arus motor (ampere)',          resultComment: null, durationPlan: 0.25, durationActual: null, isVerified: false },
    ],
  },

  // ── EQ-005 Panel Listrik Utama — 3-month history (Jan/Feb + SPK-L-001 Mar) ─

  {
    spkNumber: 'SPK-L-PNL-JAN',
    description: 'Inspeksi Panel Listrik Utama — Bulanan (Januari)',
    interval: '1 Bulan',
    category: 'Listrik',
    status: 'completed',
    durationActual: 1.5,
    equipmentModels: [
      { equipmentId: 'EQ-005', equipmentName: 'Panel Listrik Utama', functionalLocation: 'Ruang Panel Lantai 1' },
    ],
    activitiesModel: [
      { activityNumber: 'ACT-001', operationText: 'Periksa tegangan input dan output (VAC)', resultComment: 'Tegangan normal 380V / 220V',              durationPlan: 0.5, durationActual: 0.5,  isVerified: true },
      { activityNumber: 'ACT-002', operationText: 'Cek kondisi MCB dan MCCB',                resultComment: 'Semua MCB berfungsi normal',              durationPlan: 0.5, durationActual: 0.5,  isVerified: true },
      { activityNumber: 'ACT-003', operationText: 'Bersihkan debu pada busbar dan terminal', resultComment: 'Busbar dibersihkan, tidak ada korosi',     durationPlan: 1.0, durationActual: 0.5,  isVerified: true },
    ],
  },

  {
    spkNumber: 'SPK-L-PNL-FEB',
    description: 'Inspeksi Panel Listrik Utama — Bulanan (Februari)',
    interval: '1 Bulan',
    category: 'Listrik',
    status: 'completed',
    durationActual: 2.0,
    equipmentModels: [
      { equipmentId: 'EQ-005', equipmentName: 'Panel Listrik Utama', functionalLocation: 'Ruang Panel Lantai 1' },
    ],
    activitiesModel: [
      { activityNumber: 'ACT-001', operationText: 'Periksa tegangan input dan output (VAC)', resultComment: 'Tegangan normal 382V / 221V',              durationPlan: 0.5, durationActual: 0.5,  isVerified: true },
      { activityNumber: 'ACT-002', operationText: 'Cek kondisi MCB dan MCCB',                resultComment: '1 MCB perlu penggantian, sudah dilaporkan', durationPlan: 0.5, durationActual: 0.5,  isVerified: true },
      { activityNumber: 'ACT-003', operationText: 'Bersihkan debu pada busbar dan terminal', resultComment: 'Busbar bersih',                            durationPlan: 1.0, durationActual: 1.0,  isVerified: true },
    ],
  },
];

// ────────────────────────────────────────────────────────────────────────────
// LEMBAR KERJA
//
// LK-FEB-MEK: Februari 2026 → periodeEnd 2026-02-28 (PAST).
//   SPK-M-001 is linked here → dueDate = 2026-02-28 → isOverdue = true.
//
// All March LKs: periodeEnd 2026-03-31 (future) → no overdue.
// ────────────────────────────────────────────────────────────────────────────
const lembarKerja = [
  // ── Januari 2026 — completed ──────────────────────────────────────────────
  {
    lkNumber: 'LK-JAN-MEK',
    periodeStart: '2026-01-01T00:00:00.000Z',
    periodeEnd:   '2026-01-31T23:59:59.000Z',
    category: 'Mekanik',
    status: 'completed',
    lembarKe: 1,
    totalLembar: 1,
    evaluasi: 'Perawatan Mekanik Januari selesai. Semua peralatan dalam kondisi baik.',
    spkModels: ['SPK-M-PMP-A-JAN', 'SPK-M-BST-JAN'],
  },
  {
    lkNumber: 'LK-JAN-LIS',
    periodeStart: '2026-01-01T00:00:00.000Z',
    periodeEnd:   '2026-01-31T23:59:59.000Z',
    category: 'Listrik',
    status: 'completed',
    lembarKe: 1,
    totalLembar: 1,
    evaluasi: 'Inspeksi Listrik Januari selesai. Tidak ada temuan kritis.',
    spkModels: ['SPK-L-PNL-JAN'],
  },

  // ── Februari 2026 — completed (LK-FEB-MEK PAST → SPK-M-001 OVERDUE) ──────
  {
    lkNumber: 'LK-FEB-MEK',
    periodeStart: '2026-02-01T00:00:00.000Z',
    periodeEnd:   '2026-02-28T23:59:59.000Z',   // ← PAST → SPK-M-001 becomes overdue
    category: 'Mekanik',
    status: 'in_progress',
    lembarKe: 1,
    totalLembar: 1,
    evaluasi: null,
    spkModels: ['SPK-M-001', 'SPK-M-BST-FEB'],
  },
  {
    lkNumber: 'LK-FEB-LIS',
    periodeStart: '2026-02-01T00:00:00.000Z',
    periodeEnd:   '2026-02-28T23:59:59.000Z',
    category: 'Listrik',
    status: 'completed',
    lembarKe: 1,
    totalLembar: 1,
    evaluasi: 'Inspeksi Listrik Februari selesai. 1 MCB perlu penggantian, sudah dilaporkan.',
    spkModels: ['SPK-L-PNL-FEB'],
  },

  // ── Maret 2026 — current month ───────────────────────────────────────────
  {
    lkNumber: 'LK-MAR-MEK',
    periodeStart: '2026-03-01T00:00:00.000Z',
    periodeEnd:   '2026-03-31T23:59:59.000Z',
    category: 'Mekanik',
    status: 'in_progress',
    lembarKe: 1,
    totalLembar: 1,
    evaluasi: null,
    spkModels: ['SPK-M-002', 'SPK-M-BST-MAR'],
  },
  {
    lkNumber: 'LK-MAR-LIS',
    periodeStart: '2026-03-01T00:00:00.000Z',
    periodeEnd:   '2026-03-31T23:59:59.000Z',
    category: 'Listrik',
    status: 'in_progress',
    lembarKe: 1,
    totalLembar: 1,
    evaluasi: null,
    spkModels: ['SPK-L-001', 'SPK-L-002'],
  },
  {
    lkNumber: 'LK-MAR-SIP',
    periodeStart: '2026-03-01T00:00:00.000Z',
    periodeEnd:   '2026-03-31T23:59:59.000Z',
    category: 'Sipil',
    status: 'pending',
    lembarKe: 1,
    totalLembar: 1,
    evaluasi: null,
    spkModels: ['SPK-S-001'],
  },
  {
    lkNumber: 'LK-MAR-OTO',
    periodeStart: '2026-03-01T00:00:00.000Z',
    periodeEnd:   '2026-03-31T23:59:59.000Z',
    category: 'Otomasi',
    status: 'pending',
    lembarKe: 1,
    totalLembar: 1,
    evaluasi: null,
    spkModels: ['SPK-O-001'],
  },
];

// ────────────────────────────────────────────────────────────────────────────
// SUBMISSIONS (for completed SPKs)
// ────────────────────────────────────────────────────────────────────────────
const submissions = [
  // SPK-L-002: Genset 6-bulanan (EQ-007)
  {
    id: 'SUB-001',
    spkNumber: 'SPK-L-002',
    durationActual: 3.0,
    evaluasi: 'Servis genset berjalan lancar. Semua komponen dalam kondisi baik pasca servis.',
    latitude:  -6.0141,
    longitude: 106.0220,
    submittedAt: '2026-02-20T14:00:00.000Z',
    photoPaths: [],
    activityResultsModel: [
      { activityNumber: 'ACT-001', resultComment: 'Oli diganti dengan Pertamina Fastron 15W40', isNormal: true, isVerified: true },
      { activityNumber: 'ACT-002', resultComment: 'Kedua filter sudah diganti baru',            isNormal: true, isVerified: true },
      { activityNumber: 'ACT-003', resultComment: 'Genset beroperasi normal, output 200V/50Hz', isNormal: true, isVerified: true },
    ],
  },
  // SPK-M-PMP-A-JAN: Pompa Air Utama A Januari (EQ-001)
  {
    id: 'SUB-002',
    spkNumber: 'SPK-M-PMP-A-JAN',
    durationActual: 1.5,
    evaluasi: 'Perawatan Pompa A Januari selesai. Tidak ada temuan kritis.',
    latitude:  -6.0131,
    longitude: 106.0215,
    submittedAt: '2026-01-22T09:30:00.000Z',
    photoPaths: [],
    activityResultsModel: [
      { activityNumber: 'ACT-001', resultComment: 'Tekanan normal: 4.2 bar',            isNormal: true, isVerified: true },
      { activityNumber: 'ACT-002', resultComment: 'Tidak ada kebocoran',                isNormal: true, isVerified: true },
      { activityNumber: 'ACT-003', resultComment: 'Bearing dilumasi, kondisi baik',     isNormal: true, isVerified: true },
    ],
  },
  // SPK-M-BST-JAN: Pompa Booster Januari (EQ-003)
  {
    id: 'SUB-003',
    spkNumber: 'SPK-M-BST-JAN',
    durationActual: 1.0,
    evaluasi: 'Perawatan Pompa Booster Januari selesai. Semua normal.',
    latitude:  -6.0128,
    longitude: 106.0222,
    submittedAt: '2026-01-23T11:00:00.000Z',
    photoPaths: [],
    activityResultsModel: [
      { activityNumber: 'ACT-001', resultComment: 'Tekanan normal: 3.8 bar',            isNormal: true, isVerified: true },
      { activityNumber: 'ACT-002', resultComment: 'Seal dalam kondisi baik',            isNormal: true, isVerified: true },
      { activityNumber: 'ACT-003', resultComment: 'Arus normal: 8.5 A',               isNormal: true, isVerified: true },
    ],
  },
  // SPK-L-PNL-JAN: Panel Listrik Utama Januari (EQ-005)
  {
    id: 'SUB-004',
    spkNumber: 'SPK-L-PNL-JAN',
    durationActual: 1.5,
    evaluasi: 'Inspeksi Panel Listrik Januari selesai. Tidak ada temuan kritis.',
    latitude:  -6.0136,
    longitude: 106.0224,
    submittedAt: '2026-01-20T14:00:00.000Z',
    photoPaths: [],
    activityResultsModel: [
      { activityNumber: 'ACT-001', resultComment: 'Tegangan normal 380V / 220V',             isNormal: true, isVerified: true },
      { activityNumber: 'ACT-002', resultComment: 'Semua MCB berfungsi normal',              isNormal: true, isVerified: true },
      { activityNumber: 'ACT-003', resultComment: 'Busbar dibersihkan, tidak ada korosi',    isNormal: true, isVerified: true },
    ],
  },
  // SPK-M-BST-FEB: Pompa Booster Februari (EQ-003)
  {
    id: 'SUB-005',
    spkNumber: 'SPK-M-BST-FEB',
    durationActual: 1.25,
    evaluasi: 'Perawatan Pompa Booster Februari selesai. Tekanan disetel ulang, seal dijadwalkan ganti bulan depan.',
    latitude:  -6.0128,
    longitude: 106.0222,
    submittedAt: '2026-02-21T10:00:00.000Z',
    photoPaths: [],
    activityResultsModel: [
      { activityNumber: 'ACT-001', resultComment: 'Tekanan sedikit turun: 3.5 bar, disetel ulang', isNormal: false, isVerified: true },
      { activityNumber: 'ACT-002', resultComment: 'Seal mulai aus, dijadwalkan ganti bulan depan', isNormal: false, isVerified: true },
      { activityNumber: 'ACT-003', resultComment: 'Arus normal: 8.7 A',                           isNormal: true,  isVerified: true },
    ],
  },
  // SPK-L-PNL-FEB: Panel Listrik Utama Februari (EQ-005)
  {
    id: 'SUB-006',
    spkNumber: 'SPK-L-PNL-FEB',
    durationActual: 2.0,
    evaluasi: 'Inspeksi Panel Listrik Februari selesai. 1 MCB perlu penggantian, sudah dilaporkan ke pengadaan.',
    latitude:  -6.0136,
    longitude: 106.0224,
    submittedAt: '2026-02-19T13:00:00.000Z',
    photoPaths: [],
    activityResultsModel: [
      { activityNumber: 'ACT-001', resultComment: 'Tegangan normal 382V / 221V',                   isNormal: true,  isVerified: true },
      { activityNumber: 'ACT-002', resultComment: '1 MCB perlu penggantian, sudah dilaporkan',     isNormal: false, isVerified: true },
      { activityNumber: 'ACT-003', resultComment: 'Busbar bersih',                                 isNormal: true,  isVerified: true },
    ],
  },
];

// ────────────────────────────────────────────────────────────────────────────
// ASSIGN equipmentId TO EACH ACTIVITY (round-robin per equipmentModels)
// ────────────────────────────────────────────────────────────────────────────
spk.forEach(s => {
  const equips = s.equipmentModels;
  s.activitiesModel.forEach((act, i) => {
    if (!act.equipmentId) {
      act.equipmentId = equips.length > 0 ? equips[i % equips.length].equipmentId : null;
    }
  });
});

// ────────────────────────────────────────────────────────────────────────────
// PLANTS
// All 7 SAP plant codes from the equipment list.
// centerLat/centerLon left null — set them via the Maps UI once zones are drawn.
// ────────────────────────────────────────────────────────────────────────────
const plants = [
  { plantId: 'KTI-01',   plantName: 'PT Krakatau Tirta Industri', shortName: 'KTI',             city: 'Cilegon',  centerLat: -6.0135, centerLon: 106.0219, zoom: 14 },
  { plantId: 'I-22L001', plantName: 'PS I Cidanau',               shortName: 'PS I',            city: 'Cilegon',  centerLat: null,    centerLon: null,     zoom: 17 },
  { plantId: 'P-22L006', plantName: 'WTP Cidanau',                shortName: 'WTP Cidanau',     city: 'Cilegon',  centerLat: null,    centerLon: null,     zoom: 17 },
  { plantId: 'I-22L004', plantName: 'PS VII Cipasauran',          shortName: 'PS VII',          city: 'Serang',   centerLat: null,    centerLon: null,     zoom: 17 },
  { plantId: 'D-22L010', plantName: 'PS V SEPS',                  shortName: 'PS V',            city: 'Cilegon',  centerLat: null,    centerLon: null,     zoom: 17 },
  { plantId: 'I-22L003', plantName: 'PS II Waduk',                shortName: 'PS II',           city: 'Cilegon',  centerLat: null,    centerLon: null,     zoom: 17 },
  { plantId: 'P-22L007', plantName: 'WTP Krenceng',               shortName: 'WTP Krenceng',    city: 'Cilegon',  centerLat: null,    centerLon: null,     zoom: 17 },
  { plantId: 'I-22L002', plantName: 'DECANTER',                   shortName: 'Decanter',        city: 'Cilegon',  centerLat: null,    centerLon: null,     zoom: 17 },
];

// ────────────────────────────────────────────────────────────────────────────
// MAIN
// ────────────────────────────────────────────────────────────────────────────
async function main() {
  await sequelize.authenticate();
  console.log('\n  KTI SmartCare — Seed\n');

  // Note: Don't use { alter: true } here to avoid FK constraint issues
  // when Equipment table has data but FunctionalLocations hasn't been seeded yet.
  // Schema migrations should be handled separately via proper migration files.
  await sequelize.sync({ force: false });
  console.log('  ✓  Tables synced');

  let added, skipped;

  // ── Users (insert-if-not-exists) ───────────────────────────────────────────
  added = 0; skipped = 0;
  for (const u of users) {
    const [, created] = await User.findOrCreate({ where: { id: u.id }, defaults: u });
    created ? added++ : skipped++;
  }
  console.log(`  ✓  users        (+${added} added, ${skipped} already existed)`);

  // ── Plants (insert-if-not-exists) ──────────────────────────────────────────
  added = 0; skipped = 0;
  for (const p of plants) {
    const [, created] = await Plant.findOrCreate({ where: { plantId: p.plantId }, defaults: p });
    created ? added++ : skipped++;
  }
  console.log(`  ✓  plants       (+${added} added, ${skipped} already existed)`);

  // ── Functional Locations (insert-if-not-exists) ────────────────────────────
  // MUST seed BEFORE Equipment because Equipment has FK to FunctionalLocations
  added = 0; skipped = 0;
  const sortedFuncLocs = [...funcLocData].sort((a, b) => a.level - b.level);
  for (const fl of sortedFuncLocs) {
    const [, created] = await FunctionalLocation.findOrCreate({ where: { funcLocId: fl.funcLocId }, defaults: fl });
    created ? added++ : skipped++;
  }
  console.log(`  ✓  func_locs    (+${added} added, ${skipped} already existed)`);

  // ── Equipment (insert-if-not-exists) ───────────────────────────────────────
  added = 0; skipped = 0;
  for (const e of equipment) {
    const [, created] = await Equipment.findOrCreate({ where: { equipmentId: e.equipmentId }, defaults: e });
    created ? added++ : skipped++;
  }
  console.log(`  ✓  equipment    (+${added} added, ${skipped} already existed)`);

  // ── SAP Equipment (upsert — update existing rows with full data) ───────────
  added = 0; skipped = 0;
  const plantNameMap = Object.fromEntries(plants.map(p => [p.plantId, p.plantName]));
  for (const se of sapEquipmentData) {
    const defaults = {
      equipmentId:        se.equipmentId,
      equipmentName:      se.equipmentName,
      plantId:            se.plantId,
      plantName:          plantNameMap[se.plantId] || null,
      funcLocId:          se.funcLocId   || null,
      functionalLocation: se.functionalLocation || null,
      category:           se.category    || null,
      abcIndicator:       se.abcIndicator || null,
    };
    const [instance, created] = await Equipment.findOrCreate({
      where: { equipmentId: se.equipmentId },
      defaults,
    });
    if (!created) {
      // Update fields that may have been missing from older sparse seed
      await instance.update({
        equipmentName:      defaults.equipmentName,
        plantId:            defaults.plantId,
        plantName:          defaults.plantName,
        funcLocId:          defaults.funcLocId,
        functionalLocation: defaults.functionalLocation,
        category:           defaults.category,
        abcIndicator:       defaults.abcIndicator,
      });
      skipped++;
    } else {
      added++;
    }
  }
  console.log(`  ✓  sap_equip    (+${added} added, ${skipped} updated)`);

  // ── General Task Lists (insert-if-not-exists) ─────────────────────────────
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

  // ── RESET SPK / LK / Submission tables ────────────────────────────────────
  // Truncate in dependency order (children first), then re-insert clean data.
  console.log('\n  Resetting SPK / LembarKerja / Submission tables...');
  await SubmissionActivityResult.destroy({ where: {}, truncate: false });
  await SubmissionPhoto.destroy({ where: {}, truncate: false });
  await Submission.destroy({ where: {}, truncate: false });
  await SpkActivity.destroy({ where: {}, truncate: false });
  await SpkEquipment.destroy({ where: {}, truncate: false });
  await LembarKerjaSpk.destroy({ where: {}, truncate: false });
  await LembarKerja.destroy({ where: {}, truncate: false });
  await Spk.destroy({ where: {}, truncate: false });
  console.log('  ✓  Tables cleared');

  // ── SPK ────────────────────────────────────────────────────────────────────
  for (const s of spk) {
    await Spk.create({
      spkNumber: s.spkNumber, description: s.description, intervalPeriod: s.interval,
      category: s.category, status: s.status, durationActual: s.durationActual,
    });
    for (const eq of s.equipmentModels) {
      await SpkEquipment.create({ spkNumber: s.spkNumber, equipmentId: eq.equipmentId, equipmentName: eq.equipmentName, functionalLocation: eq.functionalLocation });
    }
    for (const act of s.activitiesModel) {
      await SpkActivity.create({ spkNumber: s.spkNumber, activityNumber: act.activityNumber, equipmentId: act.equipmentId || null, operationText: act.operationText, resultComment: act.resultComment || null, durationPlan: act.durationPlan, durationActual: act.durationActual || null, isVerified: act.isVerified || false });
    }
  }
  console.log(`  ✓  spk          (${spk.length} inserted)`);

  // ── Lembar Kerja ───────────────────────────────────────────────────────────
  for (const lk of lembarKerja) {
    await LembarKerja.create({ lkNumber: lk.lkNumber, periodeStart: lk.periodeStart, periodeEnd: lk.periodeEnd, category: lk.category, status: lk.status, lembarKe: lk.lembarKe, totalLembar: lk.totalLembar, evaluasi: lk.evaluasi || null });
    for (const spkNum of lk.spkModels) {
      await LembarKerjaSpk.create({ lkNumber: lk.lkNumber, spkNumber: spkNum });
    }
  }
  console.log(`  ✓  lembar_kerja (${lembarKerja.length} inserted)`);

  // ── Submissions ────────────────────────────────────────────────────────────
  for (const sub of submissions) {
    await Submission.create({ id: sub.id, spkNumber: sub.spkNumber, durationActual: sub.durationActual, evaluasi: sub.evaluasi || null, latitude: sub.latitude, longitude: sub.longitude, submittedAt: sub.submittedAt });
    for (const p of (sub.photoPaths || [])) {
      await SubmissionPhoto.create({ submissionId: sub.id, photoPath: p });
    }
    for (const r of (sub.activityResultsModel || [])) {
      await SubmissionActivityResult.create({ submissionId: sub.id, activityNumber: r.activityNumber, resultComment: r.resultComment || null, isNormal: r.isNormal ?? true, isVerified: r.isVerified ?? false });
    }
  }
  console.log(`  ✓  submissions  (${submissions.length} inserted)`);

  console.log('\n  Seed complete!\n');
  console.log('  SPK summary:');
  console.log('    SPK-M-001        Mekanik  pending     ← OVERDUE  EQ-001 Pompa Air A (dueDate = 2026-02-28)');
  console.log('    SPK-M-002        Mekanik  pending                EQ-002 Pompa Air B (dueDate = 2026-03-31)');
  console.log('    SPK-L-001        Listrik  in_progress            EQ-005 Panel Listrik Utama');
  console.log('    SPK-L-002        Listrik  completed              EQ-007 Genset Cadangan 200 kVA');
  console.log('    SPK-S-001        Sipil    pending                EQ-008 Bak Penampungan Utama');
  console.log('    SPK-O-001        Otomasi  pending                EQ-010 Sensor Level Air Tank 1');
  console.log('    SPK-M-PMP-A-JAN  Mekanik  completed              EQ-001 Pompa Air A Januari');
  console.log('    SPK-M-BST-JAN    Mekanik  completed              EQ-003 Pompa Booster Januari');
  console.log('    SPK-M-BST-FEB    Mekanik  completed              EQ-003 Pompa Booster Februari');
  console.log('    SPK-M-BST-MAR    Mekanik  pending                EQ-003 Pompa Booster Maret');
  console.log('    SPK-L-PNL-JAN    Listrik  completed              EQ-005 Panel Listrik Januari');
  console.log('    SPK-L-PNL-FEB    Listrik  completed              EQ-005 Panel Listrik Februari\n');
  console.log('  Equipment with QR scan history (scan these IDs):');
  console.log('    EQ-001  → 2 SPK (Jan completed, Feb OVERDUE)');
  console.log('    EQ-003  → 3 SPK (Jan+Feb completed, Mar pending)');
  console.log('    EQ-005  → 3 SPK (Jan+Feb completed, Mar in_progress)');
  console.log('    EQ-007  → 1 SPK (6-bulanan completed)\n');

  // ── Corrective Maintenance ──────────────────────────────────────────────────
  // Notifications (Sample data for different work centers)
  const notifications = [
    {
      notificationId: 'NOTIF-001',
      notificationDate: '2026-03-10',
      notificationType: 'Kerusakan',
      description: 'Pompa Air Utama A tidak berfungsi',
      functionalLocation: 'Basement Lantai B1',
      equipment: 'Pompa Air Utama A',
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
      notificationType: 'Kerusakan',
      description: 'Panel Listrik Utama sering trip',
      functionalLocation: 'Ruang Panel Lantai 1',
      equipment: 'Panel Listrik Utama',
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
      equipment: 'Bak Penampungan Utama',
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
      notificationType: 'Kerusakan',
      description: 'Sensor Level tidak akurat',
      functionalLocation: 'Rooftop Area',
      equipment: 'Sensor Level Air Tank 1',
      equipmentId: 'EQ-010',
      requiredStart: '2026-03-10',
      requiredEnd: '2026-03-14',
      reportedBy: 'Kadis Otomasi',
      longText: 'Sensor menunjukkan level 80% padahal tanki hanya terisi 50%. Perlu kalibrasi ulang.',
      photo1: null,
      photo2: null,
      status: 'spk_created',
      workCenter: 'automation',
      kadisPelaporId: 'USR-014',
      submittedBy: 'USR-014',
      submittedAt: '2026-03-09T14:20:00.000Z',
    },
    {
      notificationId: 'NOTIF-005',
      notificationDate: '2026-03-08',
      notificationType: 'Kerusakan',
      description: 'Genset tidak bisa start',
      functionalLocation: 'Area Genset Basement',
      equipment: 'Genset Cadangan 200 kVA',
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

  // SPK Corrective (Sample data)
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
      // Create items
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
  await sequelize.close();
}

main().catch(err => {
  console.error('  ✗  Seed failed:', err.message);
  process.exit(1);
});
