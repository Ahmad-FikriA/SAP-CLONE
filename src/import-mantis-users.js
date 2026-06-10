'use strict';

/**
 * Import real users from "Mantis User Authorization.xlsx" data.
 * Permissions are computed from the Excel boolean columns + role-based CRUD level.
 * Run: node src/import-mantis-users.js
 *
 * Safe to re-run: uses findOrCreate per NIK, updates non-password fields only.
 */

require('dotenv').config();
const sequelize = require('./config/database');
const User = require('./models/User');
require('./models/associations');

// ── Web page keys, in Excel column order (T=0 … AI=15) ─────────────────────
const PAGE_KEYS = [
  'dashboard',        // T  — Web Dashboard
  'spk',             // U  — Web Preventive
  'spk-approval',    // V  — Web Persetujuan SPK
  'corrective',      // W  — Web Corrective
  'users',           // X  — Web Users
  'track-record',    // Y  — Web Track Record
  'equipment',       // Z  — Web Equipment
  'maps',            // AA — Web Maps
  'task-mapping',    // AB — Web Task List
  'interval-planner',// AC — Web Interval Planner
  'submissions',     // AD — Web Submissions
  'hse',             // AE — Web HSE Command Center
  'inspeksi',        // AF — Web Inspeksi
  'supervisi',       // AG — Web Supervisi
  'kalender',        // AH — Web Kalender Jadwal
  'settings',        // AI — Web Pengaturan Akses
];

// ── CRUD per role per page ───────────────────────────────────────────────────
function getCRUD(role, pageKey) {
  const R    = ['R'];
  const RU   = ['R', 'U'];
  const CR   = ['C', 'R'];
  const CRUD = ['C', 'R', 'U', 'D'];

  if (role === 'admin' || role === 'kadiv') return CRUD;

  if (role === 'kadis') {
    if (pageKey === 'spk' || pageKey === 'spk-approval') return RU;
    if (pageKey === 'corrective' || pageKey === 'hse')    return CRUD;
    return R;
  }

  if (role === 'kasie') {
    if (pageKey === 'spk' || pageKey === 'spk-approval')  return RU;
    if (pageKey === 'corrective' || pageKey === 'interval-planner') return CRUD;
    if (pageKey === 'submissions') return CR;
    return R;
  }

  // teknisi, petugas
  if (pageKey === 'submissions') return CR;
  return R;
}

// Build permissions object from 16-element boolean array + role
function makePerms(role, webFlags) {
  const perms = {};
  webFlags.forEach((flag, i) => {
    if (flag) perms[PAGE_KEYS[i]] = getCRUD(role, PAGE_KEYS[i]);
  });
  return Object.keys(perms).length ? perms : null;
}

// ── Source data from Mantis User Authorization.xlsx ─────────────────────────
// Fields: nik, name, role, dinas, divisi, group, web[16 booleans per PAGE_KEYS]
// role must be one of: admin | kadiv | kadis | kasie | teknisi | petugas
const T = true, F = false;

const MANTIS_USERS = [
  // ── Kepala Divisi & Kadis Pusat Perawatan ──────────────────────────────────
  {
    nik: '10000191', name: 'Isa Rifai',
    role: 'kadis', dinas: 'Pusat Perawatan & HSE', divisi: 'Pusat Perawatan & HSE', group: null,
    web: [T,T,T,T,F,T,T,F,F,F,T,T,F,F,F,F],
  },
  {
    nik: '10000263', name: 'Danang Satrio',
    role: 'kadis', dinas: 'Pusat Perawatan', divisi: 'Pusat Perawatan & HSE', group: null,
    web: [T,T,T,T,F,T,T,F,F,F,T,T,F,F,F,F],
  },

  // ── Group Elektrik ─────────────────────────────────────────────────────────
  {
    nik: '10000214', name: 'Andi Nurdiandi',
    role: 'kasie', dinas: 'Pusat Perawatan', divisi: 'Pusat Perawatan & HSE', group: 'Elektrik',
    web: [T,T,T,T,F,T,T,F,F,F,T,T,F,F,F,F],
  },
  {
    nik: '10000343', name: 'Fahrizal Maulana',
    role: 'petugas', dinas: 'Pusat Perawatan', divisi: 'Pusat Perawatan & HSE', group: 'Elektrik',
    web: [T,T,T,F,T,F,F,F,F,F,F,T,F,F,F,F],
  },
  {
    nik: '10000345', name: 'Firman Oktavan',
    role: 'petugas', dinas: 'Pusat Perawatan', divisi: 'Pusat Perawatan & HSE', group: 'Elektrik',
    web: [T,T,T,F,T,F,F,F,F,F,F,T,F,F,F,F],
  },
  {
    nik: '10000353', name: 'Tio Rizky Ilyas',
    role: 'petugas', dinas: 'Pusat Perawatan', divisi: 'Pusat Perawatan & HSE', group: 'Elektrik',
    web: [T,T,T,F,T,F,F,F,F,F,F,T,F,F,F,F],
  },

  // ── Group Mekanik ──────────────────────────────────────────────────────────
  {
    nik: '10000312', name: 'Abdurrafi Najmudin',
    role: 'kasie', dinas: 'Pusat Perawatan', divisi: 'Pusat Perawatan & HSE', group: 'Mekanik',
    web: [T,T,T,T,F,T,T,F,F,F,T,T,F,F,F,F],
  },
  {
    nik: '10000284', name: 'Suratno',
    role: 'teknisi', dinas: 'Pusat Perawatan', divisi: 'Pusat Perawatan & HSE', group: 'Mekanik',
    web: [T,T,T,F,T,F,F,F,F,F,F,T,F,F,F,F],
  },
  {
    nik: '10000267', name: 'Isroni',
    role: 'teknisi', dinas: 'Pusat Perawatan', divisi: 'Pusat Perawatan & HSE', group: 'Mekanik',
    web: [T,T,T,F,T,F,F,F,F,F,F,T,F,F,F,F],
  },
  {
    nik: '10000366', name: 'Ahmad Hasan Huda',
    role: 'petugas', dinas: 'Pusat Perawatan', divisi: 'Pusat Perawatan & HSE', group: 'Mekanik',
    web: [T,T,T,F,T,F,F,F,F,F,F,T,F,F,F,F],
  },
  {
    nik: '231102', name: 'Adi Wiranata',
    role: 'petugas', dinas: 'Pusat Perawatan', divisi: 'Pusat Perawatan & HSE', group: 'Mekanik',
    web: [T,T,T,F,T,F,F,F,F,F,F,T,F,F,F,F],
  },

  // ── Group Sipil & Lingkungan ───────────────────────────────────────────────
  {
    nik: '10000270', name: 'Hafid Purnomo',
    role: 'kasie', dinas: 'Pusat Perawatan', divisi: 'Pusat Perawatan & HSE', group: 'Sipil',
    web: [T,T,T,T,F,T,T,F,F,F,T,T,F,F,F,F],
  },
  {
    nik: '10000266', name: 'Jahrudin',
    role: 'petugas', dinas: 'Pusat Perawatan', divisi: 'Pusat Perawatan & HSE', group: 'Sipil',
    web: [T,T,T,F,T,F,F,F,F,F,F,T,F,F,F,F],
  },
  {
    nik: '10000373', name: 'Hasuri',
    role: 'petugas', dinas: 'Pusat Perawatan', divisi: 'Pusat Perawatan & HSE', group: 'Sipil',
    web: [T,T,T,F,T,F,F,F,F,F,F,T,F,F,F,F],
  },
  {
    nik: '231142', name: 'Teguh Maulana',
    role: 'petugas', dinas: 'Pusat Perawatan', divisi: 'Pusat Perawatan & HSE', group: 'Sipil',
    web: [T,T,T,F,T,F,F,F,F,F,F,T,F,F,F,F],
  },

  // ── Group Otomasi ──────────────────────────────────────────────────────────
  {
    nik: '10000303', name: 'Hafidz Reza Assagaf',
    role: 'kasie', dinas: 'Pusat Perawatan', divisi: 'Pusat Perawatan & HSE', group: 'Otomasi',
    web: [T,T,T,T,F,T,T,F,F,F,T,T,F,F,F,F],
  },
  {
    nik: '10000331', name: 'Ridwan Idharul Huda',
    role: 'petugas', dinas: 'Pusat Perawatan', divisi: 'Pusat Perawatan & HSE', group: 'Otomasi',
    web: [T,T,T,F,T,F,F,F,F,F,F,T,F,F,F,F],
  },
  {
    nik: '10000292', name: 'Erwin Fernandes',
    role: 'petugas', dinas: 'Pusat Perawatan', divisi: 'Pusat Perawatan & HSE', group: 'Otomasi',
    web: [T,T,T,F,T,F,F,F,F,F,F,T,F,F,F,F],
  },

  // ── Inspeksi & Supervisi ───────────────────────────────────────────────────
  {
    nik: '10000262', name: 'Imam Muttaqin',
    role: 'kadis', dinas: 'Inspeksi & Supervisi', divisi: 'Pusat Perawatan & HSE', group: null,
    web: [T,F,F,T,F,F,F,F,F,F,F,T,T,T,T,F],
  },
  {
    nik: '10000225', name: 'Deni Yuniardi',
    role: 'kasie', dinas: 'Inspeksi & Supervisi', divisi: 'Pusat Perawatan & HSE', group: 'Supervisi',
    web: [T,F,F,F,F,F,F,F,F,F,F,T,F,T,T,F],
  },
  {
    nik: '10000372', name: 'Yoyon Sutrisno',
    role: 'petugas', dinas: 'Inspeksi & Supervisi', divisi: 'Pusat Perawatan & HSE', group: 'Supervisi',
    web: [T,F,F,F,F,F,F,F,F,F,F,T,F,T,T,F],
  },
  {
    nik: '10000215', name: 'Ibrohim',
    role: 'kasie', dinas: 'Inspeksi & Supervisi', divisi: 'Pusat Perawatan & HSE', group: 'Supervisi',
    web: [T,F,F,F,F,F,F,F,F,F,F,T,F,T,T,F],
  },
  {
    nik: '10000279', name: 'Agus Miftakh',
    role: 'teknisi', dinas: 'Inspeksi & Supervisi', divisi: 'Pusat Perawatan & HSE', group: 'Supervisi',
    web: [T,F,F,F,F,F,F,F,F,F,F,T,F,T,T,F],
  },
  {
    nik: '10000275', name: 'Usep Supriatna',
    role: 'kasie', dinas: 'Inspeksi & Supervisi', divisi: 'Pusat Perawatan & HSE', group: 'Inspeksi',
    web: [T,F,F,F,F,F,F,F,F,F,F,T,T,F,T,F],
  },
  {
    nik: '10000375', name: 'Rangga Pramana Putra',
    role: 'petugas', dinas: 'Inspeksi & Supervisi', divisi: 'Pusat Perawatan & HSE', group: 'Inspeksi',
    web: [T,F,F,F,F,F,F,F,F,F,F,T,T,F,T,F],
  },

  // ── HSE ───────────────────────────────────────────────────────────────────
  {
    nik: '10000236', name: 'Nunung Cahyanto Setyawan',
    role: 'kadis', dinas: 'HSE', divisi: 'Pusat Perawatan & HSE', group: 'HSE',
    web: [T,F,F,F,F,F,F,F,F,F,F,T,F,F,F,F],
  },
  {
    nik: '10000317', name: 'Alvin Imam Rushady',
    role: 'kasie', dinas: 'HSE', divisi: 'Pusat Perawatan & HSE', group: 'HSE',
    web: [T,F,F,F,F,F,F,F,F,F,F,T,F,F,F,F],
  },
  {
    nik: '10000358', name: 'Annisa Fitri Nugraheni',
    role: 'teknisi', dinas: 'HSE', divisi: 'Pusat Perawatan & HSE', group: 'HSE',
    web: [T,F,F,F,F,F,F,F,F,F,F,T,F,F,F,F],
  },

  // ── Perencanaan & Pengendalian Perawatan (Planner / kadiv) ────────────────
  {
    nik: '10000227', name: 'Bambang Nugraha',
    role: 'kadiv', dinas: 'Perencanaan & Pengendalian Perawatan', divisi: 'Pusat Perawatan & HSE', group: 'Perencanaan',
    web: [T,T,T,F,T,T,T,T,T,T,T,F,F,F,F,T],
  },
  {
    nik: '10000359', name: 'Bayu Dwi Sogara',
    role: 'kadiv', dinas: 'Perencanaan & Pengendalian Perawatan', divisi: 'Pusat Perawatan & HSE', group: 'Perencanaan',
    web: [T,T,T,F,T,T,T,T,T,T,T,F,F,F,F,T],
  },

  // ── External Kepala Dinas (SPK approval only) ──────────────────────────────
  {
    nik: '10000264', name: 'Moch Ridza Pahlevi',
    role: 'kadis', dinas: 'Pengolahan Air Krenceng', divisi: 'Pengolahan Air', group: null,
    web: [T,F,T,T,F,F,F,F,F,F,F,T,F,F,F,F],
  },
  {
    nik: '10000314', name: 'Rihadi Achsani Takwim',
    role: 'kadis', dinas: 'Air Baku', divisi: 'Air Baku', group: null,
    web: [T,F,T,T,F,F,F,F,F,F,F,T,F,F,F,F],
  },
  {
    nik: '10000240', name: 'Adimas Abimanyu',
    role: 'kadis', dinas: 'Pengolahan Air Cipasauran & Cidanau', divisi: 'Pengolahan Air', group: null,
    web: [T,F,T,T,F,F,F,F,F,F,F,T,F,F,F,F],
  },
  {
    nik: '10000190', name: 'Ana Rokhayati',
    role: 'kadis', dinas: 'Proses & Quality Control', divisi: 'Proses & QC', group: null,
    web: [T,F,T,T,F,F,F,F,F,F,F,T,F,F,F,F],
  },
  {
    nik: '10000218', name: 'Muhamad Ali Lutfi',
    role: 'kadis', dinas: 'Umum', divisi: 'Umum', group: null,
    web: [T,F,T,T,F,F,F,F,F,F,F,T,F,F,F,F],
  },
  {
    nik: '10000248', name: 'Agung Hita Nugraha',
    role: 'kadis', dinas: 'Teknologi Informasi', divisi: 'Teknologi Informasi', group: null,
    web: [T,F,T,T,F,F,F,F,F,F,F,T,F,F,F,F],
  },
  {
    nik: '10000154', name: 'Aat Djamiatu Rohman',
    role: 'kadis', dinas: 'Operasi Keamanan', divisi: 'Keamanan', group: null,
    web: [T,F,T,T,F,F,F,F,F,F,F,T,F,F,F,F],
  },
  {
    nik: '10000207', name: 'Ade Mustiharja',
    role: 'kadis', dinas: 'Distribusi & Pelayanan Pelanggan', divisi: 'Distribusi', group: null,
    web: [T,F,T,T,F,F,F,F,F,F,F,T,F,F,F,F],
  },

  // ── Admin ──────────────────────────────────────────────────────────────────
  {
    nik: '999999', name: 'Admin KTI',
    role: 'admin', dinas: null, divisi: 'Sistem', group: null,
    web: [T,T,T,T,T,T,T,T,T,T,T,T,T,T,T,T], // null permissions = unrestricted
  },
];

// ── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  await sequelize.authenticate();

  let added = 0, updated = 0;

  for (const u of MANTIS_USERS) {
    const permissions = u.role === 'admin' ? null : makePerms(u.role, u.web);

    const [user, created] = await User.findOrCreate({
      where: { nik: u.nik },
      defaults: {
        id:       `USR-${u.nik}`,
        nik:      u.nik,
        name:     u.name,
        role:     u.role,
        dinas:    u.dinas,
        divisi:   u.divisi,
        group:    u.group,
        password: 'password123',
        permissions,
      },
    });

    if (created) {
      added++;
    } else {
      await user.update({
        name: u.name,
        role: u.role,
        dinas: u.dinas ?? null,
        divisi: u.divisi,
        group: u.group ?? null,
        password: 'password123',
        permissions,
      });
      updated++;
    }
  }

  console.log(`\n  ✓  Mantis users imported: +${added} new, ~${updated} updated\n`);
  await sequelize.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
