'use strict';

const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

// ── SPK (Surat Perintah Kerja) ────────────────────────────────────────────────
const Spk = sequelize.define('Spk', {
  spkNumber:      { type: DataTypes.STRING(30), primaryKey: true, field: 'spk_number' },
  description:    { type: DataTypes.STRING(500), allowNull: false },
  intervalPeriod: { type: DataTypes.STRING(30),  allowNull: true, field: 'interval_period' },
  category:       { type: DataTypes.ENUM('Mekanik','Listrik','Sipil','Otomasi'), allowNull: false },
  status:         { type: DataTypes.ENUM('pending','in_progress','completed'), allowNull: false, defaultValue: 'pending' },
  durationActual: { type: DataTypes.DECIMAL(6,2), allowNull: true, field: 'duration_actual' },
  scheduledDate:  { type: DataTypes.DATEONLY,     allowNull: true, field: 'scheduled_date' },
}, {
  tableName: 'spk',
  underscored: true,
});

// ── SPK ↔ Equipment (junction) ───────────────────────────────────────────────
const SpkEquipment = sequelize.define('SpkEquipment', {
  id:                { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  spkNumber:         { type: DataTypes.STRING(30), allowNull: false,  field: 'spk_number' },
  equipmentId:       { type: DataTypes.STRING(20), allowNull: false,  field: 'equipment_id' },
  equipmentName:     { type: DataTypes.STRING(150), allowNull: true,  field: 'equipment_name' },
  functionalLocation:{ type: DataTypes.STRING(200), allowNull: true,  field: 'functional_location' },
}, {
  tableName: 'spk_equipment',
  underscored: true,
  timestamps: false,
});

// ── SPK Activities ────────────────────────────────────────────────────────────
const SpkActivity = sequelize.define('SpkActivity', {
  id:             { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  spkNumber:      { type: DataTypes.STRING(30),  allowNull: false, field: 'spk_number' },
  activityNumber: { type: DataTypes.STRING(20),  allowNull: false, field: 'activity_number' },
  equipmentId:    { type: DataTypes.STRING(20),  allowNull: true,  field: 'equipment_id' },
  operationText:  { type: DataTypes.TEXT,         allowNull: false, field: 'operation_text' },
  resultComment:  { type: DataTypes.TEXT,         allowNull: true,  field: 'result_comment' },
  durationPlan:   { type: DataTypes.DECIMAL(6,2), allowNull: true,  field: 'duration_plan' },
  durationActual: { type: DataTypes.DECIMAL(6,2), allowNull: true,  field: 'duration_actual' },
  isVerified:     { type: DataTypes.BOOLEAN,      allowNull: false, defaultValue: false, field: 'is_verified' },
}, {
  tableName: 'spk_activities',
  underscored: true,
  timestamps: false,
});

module.exports = { Spk, SpkEquipment, SpkActivity };
