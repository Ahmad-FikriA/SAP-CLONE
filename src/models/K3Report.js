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
    type: DataTypes.JSON, // or DataTypes.TEXT if JSON is problematic on older MySQL, but mostly supported
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
      'ditolak_kadiv_pphse',
      'menunggu_tindakan_hse',
      'disetujui',
      'ditolak',
      'selesai'
    ),
    defaultValue: 'menunggu_validasi_kadiv_pphse',
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
}, {
  tableName: 'k3_reports',
  underscored: true,
  timestamps: true,
});

module.exports = K3Report;
