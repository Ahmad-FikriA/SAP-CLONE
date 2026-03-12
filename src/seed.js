'use strict';

require('dotenv').config();
const sequelize  = require('./config/database');
const User       = require('./models/User');
const Plant      = require('./models/Plant');
const Equipment  = require('./models/Equipment');
const { Spk, SpkEquipment, SpkActivity }               = require('./models/Spk');
const { LembarKerja, LembarKerjaSpk }                  = require('./models/LembarKerja');
const { Submission, SubmissionPhoto, SubmissionActivityResult } = require('./models/Submission');
const Notification = require('./models/Notification');
const SpkCorrective = require('./models/SpkCorrective');
const { SpkCorrectiveItem, SpkCorrectivePhoto } = require('./models/SpkCorrectiveItem');

// Ensure all relationship and new models are loaded before syncing
require('./models/associations');

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
// EQUIPMENT  (10 total: Mekanik×4, Listrik×3, Sipil×2, Otomasi×1)
// ────────────────────────────────────────────────────────────────────────────
const equipment = [
  { equipmentId: 'EQ-001', equipmentName: 'Pompa Air Utama A', functionalLocation: 'Basement Lantai B1', category: 'Mekanik', latitude: -6.21682, longitude: 106.81333 },
  { equipmentId: 'EQ-002', equipmentName: 'Pompa Air Utama B', functionalLocation: 'Basement Lantai B1', category: 'Mekanik', latitude: -6.21688, longitude: 106.81345 },
  { equipmentId: 'EQ-003', equipmentName: 'Pompa Booster Lantai 5', functionalLocation: 'Ruang Pompa Lantai 5', category: 'Mekanik', latitude: -6.21658, longitude: 106.81340 },
  { equipmentId: 'EQ-004', equipmentName: 'Kompresor Udara Gedung', functionalLocation: 'Ruang Utilitas B2', category: 'Mekanik', latitude: -6.21698, longitude: 106.81328 },
  { equipmentId: 'EQ-005', equipmentName: 'Panel Listrik Utama', functionalLocation: 'Ruang Panel Lantai 1', category: 'Listrik', latitude: -6.21671, longitude: 106.81318 },
  { equipmentId: 'EQ-006', equipmentName: 'Panel Distribusi Lantai 3', functionalLocation: 'Ruang Panel Lantai 3', category: 'Listrik', latitude: -6.21654, longitude: 106.81325 },
  { equipmentId: 'EQ-007', equipmentName: 'Genset Cadangan 200 kVA', functionalLocation: 'Area Genset Basement', category: 'Listrik', latitude: -6.21702, longitude: 106.81352 },
  { equipmentId: 'EQ-008', equipmentName: 'Bak Penampungan Utama', functionalLocation: 'Area Luar Gedung', category: 'Sipil', latitude: -6.21663, longitude: 106.81298 },
  { equipmentId: 'EQ-009', equipmentName: 'Saluran Drainase Utara', functionalLocation: 'Area Drainase Utara', category: 'Sipil', latitude: -6.21638, longitude: 106.81315 },
  { equipmentId: 'EQ-010', equipmentName: 'Sensor Level Air Tank 1', functionalLocation: 'Rooftop Area', category: 'Otomasi', latitude: -6.21645, longitude: 106.81338 }
];

// ────────────────────────────────────────────────────────────────────────────
// SPK  (12 total across 4 categories)
// ────────────────────────────────────────────────────────────────────────────
const spk = [
  // ── MEKANIK (4): 2 pending, 1 in_progress, 1 completed ──
  {
    spkNumber: 'SPK-2026-001',
    description: 'Perawatan Rutin Pompa Air Utama A — Bulanan',
    interval: '1 Bulan',
    category: 'Mekanik',
    status: 'pending',
    durationActual: null,
    equipmentModels: [
      { equipmentId: 'EQ-001', equipmentName: 'Pompa Air Utama A', functionalLocation: 'Basement Lantai B1' }
    ],
    activitiesModel: [
      { activityNumber: 'ACT-001', operationText: 'Periksa tekanan pompa (bar)', resultComment: null, durationPlan: 0.5, durationActual: null, isVerified: false },
      { activityNumber: 'ACT-002', operationText: 'Cek kebocoran pipa dan fitting', resultComment: null, durationPlan: 0.5, durationActual: null, isVerified: false },
      { activityNumber: 'ACT-003', operationText: 'Pelumasan bearing motor pompa', resultComment: null, durationPlan: 0.25, durationActual: null, isVerified: false }
    ]
  },
  {
    spkNumber: 'SPK-2026-002',
    description: 'Perawatan Rutin Pompa Air Utama B — Bulanan',
    interval: '1 Bulan',
    category: 'Mekanik',
    status: 'pending',
    durationActual: null,
    equipmentModels: [
      { equipmentId: 'EQ-002', equipmentName: 'Pompa Air Utama B', functionalLocation: 'Basement Lantai B1' }
    ],
    activitiesModel: [
      { activityNumber: 'ACT-001', operationText: 'Periksa tekanan dan debit air keluar', resultComment: null, durationPlan: 0.5, durationActual: null, isVerified: false },
      { activityNumber: 'ACT-002', operationText: 'Bersihkan strainer / saringan pompa', resultComment: null, durationPlan: 0.5, durationActual: null, isVerified: false },
      { activityNumber: 'ACT-003', operationText: 'Cek vibrasi dan suara abnormal', resultComment: null, durationPlan: 0.25, durationActual: null, isVerified: false }
    ]
  },
  {
    spkNumber: 'SPK-2026-003',
    description: 'Servis Pompa Booster Lantai 5 — 3 Bulanan',
    interval: '3 Bulan',
    category: 'Mekanik',
    status: 'in_progress',
    durationActual: null,
    equipmentModels: [
      { equipmentId: 'EQ-003', equipmentName: 'Pompa Booster Lantai 5', functionalLocation: 'Ruang Pompa Lantai 5' }
    ],
    activitiesModel: [
      { activityNumber: 'ACT-001', operationText: 'Periksa impeller — cek keausan', resultComment: null, durationPlan: 1.0, durationActual: null, isVerified: false },
      { activityNumber: 'ACT-002', operationText: 'Ganti mechanical seal jika diperlukan', resultComment: null, durationPlan: 1.5, durationActual: null, isVerified: false },
      { activityNumber: 'ACT-003', operationText: 'Kalibrasi pressure switch', resultComment: null, durationPlan: 0.5, durationActual: null, isVerified: false },
      { activityNumber: 'ACT-004', operationText: 'Uji coba operasi pompa selama 30 menit', resultComment: null, durationPlan: 0.5, durationActual: null, isVerified: false }
    ]
  },
  {
    spkNumber: 'SPK-2026-004',
    description: 'Overhaul Kompresor Udara Gedung — 6 Bulanan',
    interval: '6 Bulan',
    category: 'Mekanik',
    status: 'completed',
    durationActual: 4.5,
    equipmentModels: [
      { equipmentId: 'EQ-004', equipmentName: 'Kompresor Udara Gedung', functionalLocation: 'Ruang Utilitas B2' }
    ],
    activitiesModel: [
      { activityNumber: 'ACT-001', operationText: 'Ganti filter udara masuk', resultComment: 'Filter lama sudah cukup kotor, sudah diganti baru', durationPlan: 0.5, durationActual: 0.5, isVerified: true },
      { activityNumber: 'ACT-002', operationText: 'Periksa dan ganti oli kompresor', resultComment: 'Oli warna gelap, sudah diganti dengan SAE 30', durationPlan: 1.0, durationActual: 1.0, isVerified: true },
      { activityNumber: 'ACT-003', operationText: 'Kencangkan semua baut dan koneksi listrik', resultComment: 'Semua baut dalam kondisi baik', durationPlan: 0.5, durationActual: 0.5, isVerified: true },
      { activityNumber: 'ACT-004', operationText: 'Uji tekanan dan kebocoran sistem', resultComment: 'Tekanan 8 bar, tidak ada kebocoran', durationPlan: 1.0, durationActual: 1.5, isVerified: true }
    ]
  },

  // ── LISTRIK (3): 2 pending, 1 completed ──
  {
    spkNumber: 'SPK-2026-005',
    description: 'Inspeksi Panel Listrik Utama — Bulanan',
    interval: '1 Bulan',
    category: 'Listrik',
    status: 'pending',
    durationActual: null,
    equipmentModels: [
      { equipmentId: 'EQ-005', equipmentName: 'Panel Listrik Utama', functionalLocation: 'Ruang Panel Lantai 1' }
    ],
    activitiesModel: [
      { activityNumber: 'ACT-001', operationText: 'Periksa tegangan input dan output (VAC)', resultComment: null, durationPlan: 0.5, durationActual: null, isVerified: false },
      { activityNumber: 'ACT-002', operationText: 'Cek kondisi MCB dan MCCB', resultComment: null, durationPlan: 0.5, durationActual: null, isVerified: false },
      { activityNumber: 'ACT-003', operationText: 'Bersihkan debu pada busbar dan terminal', resultComment: null, durationPlan: 1.0, durationActual: null, isVerified: false }
    ]
  },
  {
    spkNumber: 'SPK-2026-006',
    description: 'Pemeriksaan Panel Distribusi Lantai 3 — 3 Bulanan',
    interval: '3 Bulan',
    category: 'Listrik',
    status: 'pending',
    durationActual: null,
    equipmentModels: [
      { equipmentId: 'EQ-006', equipmentName: 'Panel Distribusi Lantai 3', functionalLocation: 'Ruang Panel Lantai 3' }
    ],
    activitiesModel: [
      { activityNumber: 'ACT-001', operationText: 'Thermografi panel untuk deteksi hot spot', resultComment: null, durationPlan: 1.0, durationActual: null, isVerified: false },
      { activityNumber: 'ACT-002', operationText: 'Uji insulation resistance kabel feeder', resultComment: null, durationPlan: 1.0, durationActual: null, isVerified: false },
      { activityNumber: 'ACT-003', operationText: 'Kencangkan semua terminal kabel', resultComment: null, durationPlan: 0.5, durationActual: null, isVerified: false }
    ]
  },
  {
    spkNumber: 'SPK-2026-007',
    description: 'Servis Rutin Genset Cadangan 200 kVA — 6 Bulanan',
    interval: '6 Bulan',
    category: 'Listrik',
    status: 'completed',
    durationActual: 3.0,
    equipmentModels: [
      { equipmentId: 'EQ-007', equipmentName: 'Genset Cadangan 200 kVA', functionalLocation: 'Area Genset Basement' }
    ],
    activitiesModel: [
      { activityNumber: 'ACT-001', operationText: 'Ganti oli mesin genset', resultComment: 'Oli diganti dengan Pertamina Fastron 15W40', durationPlan: 0.5, durationActual: 0.5, isVerified: true },
      { activityNumber: 'ACT-002', operationText: 'Ganti filter oli dan filter bahan bakar', resultComment: 'Kedua filter sudah diganti baru', durationPlan: 0.5, durationActual: 0.75, isVerified: true },
      { activityNumber: 'ACT-003', operationText: 'Cek battery charger dan kondisi aki', resultComment: 'Tegangan aki 13.2V, kondisi baik', durationPlan: 0.5, durationActual: 0.5, isVerified: true },
      { activityNumber: 'ACT-004', operationText: 'Uji coba operasi beban penuh 30 menit', resultComment: 'Genset beroperasi normal, output 200V/50Hz', durationPlan: 1.0, durationActual: 1.25, isVerified: true }
    ]
  },

  // ── SIPIL (2): both pending ──
  {
    spkNumber: 'SPK-2026-008',
    description: 'Pemeriksaan Bak Penampungan Utama — 3 Bulanan',
    interval: '3 Bulan',
    category: 'Sipil',
    status: 'pending',
    durationActual: null,
    equipmentModels: [
      { equipmentId: 'EQ-008', equipmentName: 'Bak Penampungan Utama', functionalLocation: 'Area Luar Gedung' }
    ],
    activitiesModel: [
      { activityNumber: 'ACT-001', operationText: 'Periksa kebocoran dinding dan lantai bak', resultComment: null, durationPlan: 1.0, durationActual: null, isVerified: false },
      { activityNumber: 'ACT-002', operationText: 'Bersihkan sedimen dan lumpur dasar bak', resultComment: null, durationPlan: 2.0, durationActual: null, isVerified: false },
      { activityNumber: 'ACT-003', operationText: 'Periksa dan uji pengapuran/chlorinasi', resultComment: null, durationPlan: 0.5, durationActual: null, isVerified: false }
    ]
  },
  {
    spkNumber: 'SPK-2026-009',
    description: 'Pembersihan Saluran Drainase Utara — 1 Tahun',
    interval: '1 Tahun',
    category: 'Sipil',
    status: 'pending',
    durationActual: null,
    equipmentModels: [
      { equipmentId: 'EQ-009', equipmentName: 'Saluran Drainase Utara', functionalLocation: 'Area Drainase Utara' }
    ],
    activitiesModel: [
      { activityNumber: 'ACT-001', operationText: 'Pembersihan saluran dari sampah dan lumpur', resultComment: null, durationPlan: 3.0, durationActual: null, isVerified: false },
      { activityNumber: 'ACT-002', operationText: 'Periksa kondisi tutup got / manhole cover', resultComment: null, durationPlan: 0.5, durationActual: null, isVerified: false }
    ]
  },

  // ── OTOMASI (3): 1 pending, 1 in_progress, 1 completed ──
  {
    spkNumber: 'SPK-2026-010',
    description: 'Kalibrasi Sensor Level Air Tank 1 — 3 Bulanan',
    interval: '3 Bulan',
    category: 'Otomasi',
    status: 'pending',
    durationActual: null,
    equipmentModels: [
      { equipmentId: 'EQ-010', equipmentName: 'Sensor Level Air Tank 1', functionalLocation: 'Rooftop Area' }
    ],
    activitiesModel: [
      { activityNumber: 'ACT-001', operationText: 'Cek sinyal output sensor (4–20 mA)', resultComment: null, durationPlan: 0.5, durationActual: null, isVerified: false },
      { activityNumber: 'ACT-002', operationText: 'Kalibrasi titik 0% dan 100% level', resultComment: null, durationPlan: 1.0, durationActual: null, isVerified: false },
      { activityNumber: 'ACT-003', operationText: 'Periksa kabel sinyal dan koneksi terminal', resultComment: null, durationPlan: 0.25, durationActual: null, isVerified: false }
    ]
  },
  {
    spkNumber: 'SPK-2026-011',
    description: 'Upgrade Firmware PLC Water Treatment — 6 Bulanan',
    interval: '6 Bulan',
    category: 'Otomasi',
    status: 'in_progress',
    durationActual: null,
    equipmentModels: [
      { equipmentId: 'EQ-010', equipmentName: 'Sensor Level Air Tank 1', functionalLocation: 'Rooftop Area' }
    ],
    activitiesModel: [
      { activityNumber: 'ACT-001', operationText: 'Backup program PLC existing ke laptop', resultComment: null, durationPlan: 0.5, durationActual: null, isVerified: false },
      { activityNumber: 'ACT-002', operationText: 'Upload firmware versi terbaru ke PLC', resultComment: null, durationPlan: 1.0, durationActual: null, isVerified: false },
      { activityNumber: 'ACT-003', operationText: 'Verifikasi semua I/O setelah upgrade', resultComment: null, durationPlan: 1.0, durationActual: null, isVerified: false },
      { activityNumber: 'ACT-004', operationText: 'Dokumentasi dan simpan backup program baru', resultComment: null, durationPlan: 0.5, durationActual: null, isVerified: false }
    ]
  },
  {
    spkNumber: 'SPK-2026-012',
    description: 'Overhaul Panel SCADA Monitoring — 1 Tahun',
    interval: '1 Tahun',
    category: 'Otomasi',
    status: 'completed',
    durationActual: 5.0,
    equipmentModels: [
      { equipmentId: 'EQ-010', equipmentName: 'Sensor Level Air Tank 1', functionalLocation: 'Rooftop Area' }
    ],
    activitiesModel: [
      { activityNumber: 'ACT-001', operationText: 'Bersihkan dan cek koneksi kabel SCADA', resultComment: 'Semua koneksi kabel dalam kondisi baik', durationPlan: 1.0, durationActual: 1.0, isVerified: true },
      { activityNumber: 'ACT-002', operationText: 'Update software SCADA ke versi terbaru', resultComment: 'Update ke v2.4.1 berhasil', durationPlan: 2.0, durationActual: 2.5, isVerified: true },
      { activityNumber: 'ACT-003', operationText: 'Kalibrasi semua sensor yang terhubung SCADA', resultComment: 'Kalibrasi 8 sensor, semua dalam batas normal', durationPlan: 1.5, durationActual: 1.5, isVerified: true }
    ]
  },

  // ── MULTI-EQUIPMENT: Pompa Air Utama A & B (Mekanik, pending) ──────────
  // Demonstrates the per-equipment activity grouping feature.
  // 3 specific activities for each pump — different QR scans, different locations.
  {
    spkNumber: 'SPK-2026-013',
    description: 'Perawatan Bulanan Pompa Air Utama A & B',
    interval: '1 Bulan',
    category: 'Mekanik',
    status: 'pending',
    durationActual: null,
    equipmentModels: [
      { equipmentId: 'EQ-001', equipmentName: 'Pompa Air Utama A', functionalLocation: 'Basement Lantai B1 — Sisi Kiri' },
      { equipmentId: 'EQ-002', equipmentName: 'Pompa Air Utama B', functionalLocation: 'Basement Lantai B1 — Sisi Kanan' }
    ],
    activitiesModel: [
      // ── EQ-001: Pompa Air Utama A ──
      { activityNumber: 'ACT-001', equipmentId: 'EQ-001', operationText: 'Periksa tekanan output Pompa A (target: 3–5 bar)', resultComment: null, durationPlan: 0.5, durationActual: null, isVerified: false },
      { activityNumber: 'ACT-002', equipmentId: 'EQ-001', operationText: 'Cek kebocoran seal, packing, dan fitting Pompa A', resultComment: null, durationPlan: 0.5, durationActual: null, isVerified: false },
      { activityNumber: 'ACT-003', equipmentId: 'EQ-001', operationText: 'Pelumasan bearing dan cek vibrasi motor Pompa A', resultComment: null, durationPlan: 0.25, durationActual: null, isVerified: false },
      // ── EQ-002: Pompa Air Utama B ──
      { activityNumber: 'ACT-004', equipmentId: 'EQ-002', operationText: 'Periksa tekanan output Pompa B (target: 3–5 bar)', resultComment: null, durationPlan: 0.5, durationActual: null, isVerified: false },
      { activityNumber: 'ACT-005', equipmentId: 'EQ-002', operationText: 'Cek kebocoran seal, packing, dan fitting Pompa B', resultComment: null, durationPlan: 0.5, durationActual: null, isVerified: false },
      { activityNumber: 'ACT-006', equipmentId: 'EQ-002', operationText: 'Pelumasan bearing dan cek vibrasi motor Pompa B', resultComment: null, durationPlan: 0.25, durationActual: null, isVerified: false }
    ]
  }
];

// ────────────────────────────────────────────────────────────────────────────
// LEMBAR KERJA  (4 — one per category, March 2026)
// ────────────────────────────────────────────────────────────────────────────
const lembarKerja = [
  {
    lkNumber: 'LK-2026-001',
    periodeStart: '2026-03-01T00:00:00.000Z',
    periodeEnd: '2026-03-31T23:59:59.000Z',
    category: 'Mekanik',
    status: 'in_progress',
    lembarKe: 1,
    totalLembar: 2,
    evaluasi: null,
    spkModels: ['SPK-2026-001', 'SPK-2026-002', 'SPK-2026-003', 'SPK-2026-013']
  },
  {
    lkNumber: 'LK-2026-002',
    periodeStart: '2026-03-01T00:00:00.000Z',
    periodeEnd: '2026-03-31T23:59:59.000Z',
    category: 'Listrik',
    status: 'in_progress',
    lembarKe: 1,
    totalLembar: 1,
    evaluasi: null,
    spkModels: ['SPK-2026-005', 'SPK-2026-006']
  },
  {
    lkNumber: 'LK-2026-003',
    periodeStart: '2026-03-01T00:00:00.000Z',
    periodeEnd: '2026-03-31T23:59:59.000Z',
    category: 'Sipil',
    status: 'pending',
    lembarKe: 1,
    totalLembar: 1,
    evaluasi: null,
    spkModels: ['SPK-2026-008', 'SPK-2026-009']
  },
  {
    lkNumber: 'LK-2026-004',
    periodeStart: '2026-03-01T00:00:00.000Z',
    periodeEnd: '2026-03-31T23:59:59.000Z',
    category: 'Otomasi',
    status: 'in_progress',
    lembarKe: 1,
    totalLembar: 1,
    evaluasi: null,
    spkModels: ['SPK-2026-010', 'SPK-2026-011']
  }
];

// ────────────────────────────────────────────────────────────────────────────
// SUBMISSIONS  (2 — for SPK-2026-004 Mekanik & SPK-2026-007 Listrik)
// ────────────────────────────────────────────────────────────────────────────
const submissions = [
  {
    id: 'SUB-001',
    spkNumber: 'SPK-2026-004',
    durationActual: 4.5,
    evaluasi: 'Semua aktivitas overhaul kompresor selesai dengan normal. Kondisi kompresor setelah servis sangat baik.',
    latitude: -6.1751,
    longitude: 106.8650,
    submittedAt: '2026-02-15T10:30:00.000Z',
    photoPaths: [],
    activityResultsModel: [
      { activityNumber: 'ACT-001', resultComment: 'Filter lama sudah cukup kotor, sudah diganti baru', isNormal: true, isVerified: true },
      { activityNumber: 'ACT-002', resultComment: 'Oli warna gelap, sudah diganti dengan SAE 30', isNormal: true, isVerified: true },
      { activityNumber: 'ACT-003', resultComment: 'Semua baut dalam kondisi baik', isNormal: true, isVerified: true },
      { activityNumber: 'ACT-004', resultComment: 'Tekanan 8 bar, tidak ada kebocoran', isNormal: true, isVerified: true }
    ]
  },
  {
    id: 'SUB-002',
    spkNumber: 'SPK-2026-007',
    durationActual: 3.0,
    evaluasi: 'Servis genset berjalan lancar. Semua komponen dalam kondisi baik pasca servis.',
    latitude: -6.1755,
    longitude: 106.8645,
    submittedAt: '2026-02-20T14:00:00.000Z',
    photoPaths: [],
    activityResultsModel: [
      { activityNumber: 'ACT-001', resultComment: 'Oli diganti dengan Pertamina Fastron 15W40', isNormal: true, isVerified: true },
      { activityNumber: 'ACT-002', resultComment: 'Kedua filter sudah diganti baru', isNormal: true, isVerified: true },
      { activityNumber: 'ACT-003', resultComment: 'Tegangan aki 13.2V, kondisi baik', isNormal: true, isVerified: true },
      { activityNumber: 'ACT-004', resultComment: 'Genset beroperasi normal, output 200V/50Hz', isNormal: true, isVerified: true }
    ]
  }
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
// PLANTS seed data
// ────────────────────────────────────────────────────────────────────────────
const plants = [
  { plantId: 'KTI-01', plantName: 'PT Krakatau Tirta Industri', shortName: 'KTI WTP-1', city: 'Cilegon', centerLat: -6.0135, centerLon: 106.0219, zoom: 17 }
];

// ────────────────────────────────────────────────────────────────────────────
// MAIN: sync schema → INSERT-IF-NOT-EXISTS (existing data is NEVER modified)
// ────────────────────────────────────────────────────────────────────────────
async function main() {
  await sequelize.authenticate();
  console.log('\n  KTI SmartCare — MySQL Seed (insert-if-not-exists)\n');

  // Auto-create missing tables / add missing columns. Never drops anything.
  await sequelize.sync({ alter: true });
  console.log('  ✓  Tables synced');

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

  // ── Equipment ──────────────────────────────────────────────────────────────
  added = 0; skipped = 0;
  for (const e of equipment) {
    const [, created] = await Equipment.findOrCreate({ where: { equipmentId: e.equipmentId }, defaults: e });
    created ? added++ : skipped++;
  }
  console.log(`  ✓  equipment    (+${added} added, ${skipped} already existed)`);

  // ── SPK ────────────────────────────────────────────────────────────────────
  // SPK header: skip if already exists.
  // Child rows (equipment links & activities): insert only if the natural key is missing.
  added = 0; skipped = 0;
  for (const s of spk) {
    const [, spkCreated] = await Spk.findOrCreate({
      where: { spkNumber: s.spkNumber },
      defaults: {
        spkNumber: s.spkNumber, description: s.description, intervalPeriod: s.interval,
        category: s.category, status: s.status, durationActual: s.durationActual,
      },
    });
    spkCreated ? added++ : skipped++;

    for (const eq of s.equipmentModels) {
      const exists = await SpkEquipment.findOne({ where: { spkNumber: s.spkNumber, equipmentId: eq.equipmentId } });
      if (!exists) await SpkEquipment.create({ spkNumber: s.spkNumber, equipmentId: eq.equipmentId, equipmentName: eq.equipmentName, functionalLocation: eq.functionalLocation });
    }
    for (const act of s.activitiesModel) {
      const exists = await SpkActivity.findOne({ where: { spkNumber: s.spkNumber, activityNumber: act.activityNumber } });
      if (!exists) await SpkActivity.create({ spkNumber: s.spkNumber, activityNumber: act.activityNumber, equipmentId: act.equipmentId || null, operationText: act.operationText, resultComment: act.resultComment || null, durationPlan: act.durationPlan, durationActual: act.durationActual || null, isVerified: act.isVerified || false });
    }
  }
  console.log(`  ✓  spk          (+${added} added, ${skipped} already existed)`);

  // ── Lembar Kerja ───────────────────────────────────────────────────────────
  added = 0; skipped = 0;
  for (const lk of lembarKerja) {
    const [, lkCreated] = await LembarKerja.findOrCreate({
      where: { lkNumber: lk.lkNumber },
      defaults: { lkNumber: lk.lkNumber, periodeStart: lk.periodeStart, periodeEnd: lk.periodeEnd, category: lk.category, status: lk.status, lembarKe: lk.lembarKe, totalLembar: lk.totalLembar, evaluasi: lk.evaluasi || null },
    });
    lkCreated ? added++ : skipped++;

    for (const spkNum of lk.spkModels) {
      const exists = await LembarKerjaSpk.findOne({ where: { lkNumber: lk.lkNumber, spkNumber: spkNum } });
      if (!exists) await LembarKerjaSpk.create({ lkNumber: lk.lkNumber, spkNumber: spkNum });
    }
  }
  console.log(`  ✓  lembar_kerja (+${added} added, ${skipped} already existed)`);

  // ── Submissions ────────────────────────────────────────────────────────────
  // Only the 2 seed-defined submissions (SUB-001, SUB-002) are managed here.
  // App-generated submissions (random IDs) are completely untouched.
  added = 0; skipped = 0;
  for (const sub of submissions) {
    const [, subCreated] = await Submission.findOrCreate({
      where: { id: sub.id },
      defaults: { id: sub.id, spkNumber: sub.spkNumber, durationActual: sub.durationActual, evaluasi: sub.evaluasi || null, latitude: sub.latitude, longitude: sub.longitude, submittedAt: sub.submittedAt },
    });
    subCreated ? added++ : skipped++;

    for (const p of (sub.photoPaths || [])) {
      const exists = await SubmissionPhoto.findOne({ where: { submissionId: sub.id, photoPath: p } });
      if (!exists) await SubmissionPhoto.create({ submissionId: sub.id, photoPath: p });
    }
    for (const r of (sub.activityResultsModel || [])) {
      const exists = await SubmissionActivityResult.findOne({ where: { submissionId: sub.id, activityNumber: r.activityNumber } });
      if (!exists) await SubmissionActivityResult.create({ submissionId: sub.id, activityNumber: r.activityNumber, resultComment: r.resultComment || null, isNormal: r.isNormal ?? true, isVerified: r.isVerified ?? false });
    }
  }
  console.log(`  ✓  submissions  (+${added} added, ${skipped} already existed)`);

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
