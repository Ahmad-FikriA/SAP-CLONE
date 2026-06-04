'use strict';

const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const K3Settings = sequelize.define('K3Settings', {
  id: {
    type: DataTypes.STRING(36),
    primaryKey: true,
    defaultValue: 'main',
    field: 'id',
  },
  totalKaryawan: {
    type: DataTypes.INTEGER,
    defaultValue: 280,
    allowNull: false,
    field: 'total_karyawan',
  },
  jamKerjaPerHari: {
    type: DataTypes.INTEGER,
    defaultValue: 8,
    allowNull: false,
    field: 'jam_kerja_per_hari',
  },
  hariKerjaPerBulan: {
    type: DataTypes.INTEGER,
    defaultValue: 20,
    allowNull: false,
    field: 'hari_kerja_per_bulan',
  },
  jamKerjaTanpaKecelakaan: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    allowNull: false,
    field: 'jam_kerja_tanpa_kecelakaan',
  },
  jumlahFatality: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    allowNull: false,
    field: 'jumlah_fatality',
  },
  bannerTitle1: {
    type: DataTypes.STRING(50),
    allowNull: true,
    field: 'banner_title_1',
  },
  bannerTitle2: {
    type: DataTypes.STRING(50),
    allowNull: true,
    field: 'banner_title_2',
  },
  bannerDescription: {
    type: DataTypes.STRING(140),
    allowNull: true,
    field: 'banner_description',
  },
  bannerSlides: {
    type: DataTypes.JSON,
    allowNull: true,
    field: 'banner_slides',
  },
}, {
  tableName: 'k3_settings',
  underscored: true,
  timestamps: true,
});

module.exports = K3Settings;
