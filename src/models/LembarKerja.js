'use strict';

const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

// ── Lembar Kerja ─────────────────────────────────────────────────────────────
const LembarKerja = sequelize.define('LembarKerja', {
  lkNumber:    { type: DataTypes.STRING(30),  primaryKey: true, field: 'lk_number' },
  periodeStart:{ type: DataTypes.DATE,         allowNull: true,  field: 'periode_start' },
  periodeEnd:  { type: DataTypes.DATE,         allowNull: true,  field: 'periode_end' },
  category:    { type: DataTypes.ENUM('Mekanik','Listrik','Sipil','Otomasi'), allowNull: false },
  status:      { type: DataTypes.ENUM('pending','in_progress','completed'), allowNull: false, defaultValue: 'pending' },
  lembarKe:    { type: DataTypes.INTEGER,      defaultValue: 1, field: 'lembar_ke' },
  totalLembar: { type: DataTypes.INTEGER,      defaultValue: 1, field: 'total_lembar' },
  evaluasi:    { type: DataTypes.TEXT,         allowNull: true },
  approvalStatus: {
    type: DataTypes.ENUM('pending','awaiting_kasie','awaiting_ap','awaiting_kadis_pusat','awaiting_kadis_keamanan','approved','rejected'),
    allowNull: true,
    defaultValue: 'pending',
    field: 'approval_status',
  },
  kasieApprovedBy:          { type: DataTypes.STRING(20), allowNull: true, field: 'kasie_approved_by' },
  kasieApprovedAt:          { type: DataTypes.DATE,       allowNull: true, field: 'kasie_approved_at' },
  apApprovedBy:             { type: DataTypes.STRING(20), allowNull: true, field: 'ap_approved_by' },
  apApprovedAt:             { type: DataTypes.DATE,       allowNull: true, field: 'ap_approved_at' },
  kadisPusatApprovedBy:     { type: DataTypes.STRING(20), allowNull: true, field: 'kadis_pusat_approved_by' },
  kadisPusatApprovedAt:     { type: DataTypes.DATE,       allowNull: true, field: 'kadis_pusat_approved_at' },
  kadisKeamananApprovedBy:  { type: DataTypes.STRING(20), allowNull: true, field: 'kadis_keamanan_approved_by' },
  kadisKeamananApprovedAt:  { type: DataTypes.DATE,       allowNull: true, field: 'kadis_keamanan_approved_at' },
  rejectedBy:    { type: DataTypes.STRING(20), allowNull: true, field: 'rejected_by' },
  rejectedAt:    { type: DataTypes.DATE,       allowNull: true, field: 'rejected_at' },
  rejectionNotes:{ type: DataTypes.TEXT,       allowNull: true, field: 'rejection_notes' },
}, {
  tableName: 'lembar_kerja',
  underscored: true,
});

// ── Lembar Kerja ↔ SPK (junction) ────────────────────────────────────────────
const LembarKerjaSpk = sequelize.define('LembarKerjaSpk', {
  id:        { type: DataTypes.INTEGER,     primaryKey: true, autoIncrement: true },
  lkNumber:  { type: DataTypes.STRING(30),  allowNull: false, field: 'lk_number' },
  spkNumber: { type: DataTypes.STRING(30),  allowNull: false, field: 'spk_number' },
}, {
  tableName: 'lembar_kerja_spk',
  underscored: true,
  timestamps: false,
});

module.exports = { LembarKerja, LembarKerjaSpk };
