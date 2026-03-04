'use strict';

require('dotenv').config();
const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', 'data');

function write(filename, data) {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(path.join(DATA_DIR, filename), JSON.stringify(data, null, 2), 'utf8');
  console.log(`  ✓  data/${filename}  (${data.length} records)`);
}

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
  { id: 'USR-010', username: 'user_01', password: 'password123', name: 'Rina Marlina', role: 'user', email: 'rina@kti-water.co.id' }
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
// ASSIGN equipmentId TO EACH ACTIVITY
// Activities are distributed across equipmentModels round-robin so that
// each equipment gets its own activity group in the mobile UI.
// ────────────────────────────────────────────────────────────────────────────
spk.forEach(s => {
  const equips = s.equipmentModels;
  s.activitiesModel.forEach((act, i) => {
    // Only assign if not already explicitly set in the activity definition
    if (!act.equipmentId) {
      act.equipmentId = equips.length > 0
        ? equips[i % equips.length].equipmentId
        : null;
    }
  });
});

// ────────────────────────────────────────────────────────────────────────────
// WRITE ALL FILES
// ────────────────────────────────────────────────────────────────────────────
console.log('\n  KTI SmartCare — Seeding data/\n');
write('users.json', users);
write('equipment.json', equipment);
write('spk.json', spk);
write('lembar_kerja.json', lembarKerja);
write('submissions.json', submissions);
console.log('\n  Seed complete!\n');
