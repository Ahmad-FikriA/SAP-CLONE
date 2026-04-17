'use strict';

const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const K3Report = sequelize.define('K3Report', {
  id: {
    type: DataTypes.STRING(36),
    primaryKey: true,
    defaultValue: DataTypes.UUIDV4,
    field: 'id',
  },
  reportNumber: {
    type: DataTypes.STRING(30),
    unique: true,
    allowNull: false,
    field: 'report_number',
  },
  kategori: {
    type: DataTypes.ENUM(
      'Kondisi Tidak Aman', 
      'Tindakan Tidak Aman', 
      'Near Miss', 
      'First Aid Case', 
      'Medical Treatment', 
      'Lost Time Injury', 
      'Permanent Disability', 
      'Fatality', 
      'Lainnya'
    ),
    allowNull: false,
    field: 'kategori',
  },
  deskripsi: {
    type: DataTypes.TEXT,
    allowNull: false,
    field: 'deskripsi',
  },
  foto: {
    type: DataTypes.JSON,
    allowNull: true,
    field: 'foto',
    comment: 'Array of photo URLs',
  },
  dilaporkanOleh: {
    type: DataTypes.STRING(30),
    allowNull: false,
    field: 'dilaporkan_oleh',
    references: {
      model: 'users',
      key: 'id'
    }
  },
  status: {
    type: DataTypes.ENUM(
      'menunggu_review_kadiv_pelapor',
      'menunggu_review_kadiv_pphse',
      'menunggu_validasi_kadiv_pphse',
      'menunggu_validasi_kadis_hse',
      'ditolak_kadiv_pphse',
      'ditolak_kadis_hse',
      'menunggu_tindakan_hse',
      'menunggu_validasi_akhir_pphse',
      'menunggu_validasi_hasil_kadis_hse',
      'menunggu_validasi_akhir_kadiv_pphse',
      'perbaikan_ditolak_pphse',
      'perbaikan_ditolak_kadis_hse',
      'perbaikan_ditolak_kadiv_pphse',
      'disetujui',
      'ditolak',
      'selesai',
      // ── Investigasi Statuses ──
      'menunggu_verifikasi_investigasi',
      'investigasi_ditolak_kadis_hse',
      'menunggu_validasi_kadiv',
      'investigasi_ditolak_kadiv'
    ),
    defaultValue: 'menunggu_validasi_kadis_hse',
    field: 'status',
  },
  catatanKadivPelapor: {
    type: DataTypes.TEXT,
    allowNull: true,
    field: 'catatan_kadiv_pelapor',
  },
  catatanKadivPphse: {
    type: DataTypes.TEXT,
    allowNull: true,
    field: 'catatan_kadiv_pphse',
  },
  tindakanPerbaikan: {
    type: DataTypes.TEXT,
    allowNull: true,
    field: 'tindakan_perbaikan',
  },
  fotoPerbaikan: {
    type: DataTypes.JSON,
    allowNull: true,
    field: 'foto_perbaikan',
  },
  catatanRevisiPerbaikan: {
    type: DataTypes.TEXT,
    allowNull: true,
    field: 'catatan_revisi_perbaikan',
  },
  jenisTindakan: {
    type: DataTypes.ENUM('investigasi', 'perbaikan_langsung'),
    allowNull: true,
    field: 'jenis_tindakan',
  },
  ditugaskanKepada: {
    type: DataTypes.STRING(36),
    allowNull: true,
    field: 'ditugaskan_kepada',
    references: {
      model: 'users',
      key: 'id'
    }
  },
  // ── Investigasi Fields ──────────────────────────────────────────────────────
  investigasiCategory: {
    type: DataTypes.STRING(50),
    allowNull: true,
    field: 'investigasi_category',
    comment: 'Kecelakaan, Penyakit Akibat Kerja, Kebakaran',
  },
  investigasiData: {
    type: DataTypes.JSON,
    allowNull: true,
    field: 'investigasi_data',
    comment: 'Dynamic form data as key-value JSON',
  },
  isDraftInvestigasi: {
    type: DataTypes.BOOLEAN,
    allowNull: true,
    defaultValue: false,
    field: 'is_draft_investigasi',
  },
  fotoInvestigasi: {
    type: DataTypes.JSON,
    allowNull: true,
    field: 'foto_investigasi',
    comment: 'Array of investigation photo URLs',
  },
  dokumenInvestigasi: {
    type: DataTypes.STRING(255),
    allowNull: true,
    field: 'dokumen_investigasi',
    comment: 'Path to investigation document (PDF/DOC)',
  },
  catatanRevisiInvestigasi: {
    type: DataTypes.TEXT,
    allowNull: true,
    field: 'catatan_revisi_investigasi',
  },
  isApprovedKadivPelapor: {
    type: DataTypes.BOOLEAN,
    allowNull: true,
    defaultValue: false,
    field: 'is_approved_kadiv_pelapor',
  },
  isApprovedKadivPphse: {
    type: DataTypes.BOOLEAN,
    allowNull: true,
    defaultValue: false,
    field: 'is_approved_kadiv_pphse',
  },
}, {
  tableName: 'k3_reports',
  underscored: true,
  timestamps: true,
});

module.exports = K3Report;
