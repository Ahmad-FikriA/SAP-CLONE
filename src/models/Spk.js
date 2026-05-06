'use strict';

const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

// ── SPK (Surat Perintah Kerja) ────────────────────────────────────────────────
const Spk = sequelize.define('Spk', {
  spkNumber:      { type: DataTypes.STRING(30), primaryKey: true, field: 'spk_number' },
  description:    { type: DataTypes.STRING(500), allowNull: false },
  intervalPeriod: { type: DataTypes.STRING(30),  allowNull: true, field: 'interval_period' },
  category:       { type: DataTypes.ENUM('Mekanik','Listrik','Sipil','Otomasi'), allowNull: false },
  status:         { type: DataTypes.ENUM('pending','in_progress','completed','awaiting_kasie','awaiting_kadis_perawatan','awaiting_kadis','approved'), allowNull: false, defaultValue: 'pending' },
  durationActual: { type: DataTypes.DECIMAL(6,2), allowNull: true, field: 'duration_actual' },
  scheduledDate:  { type: DataTypes.DATEONLY,     allowNull: true, field: 'scheduled_date' },
  orderNumber:    { type: DataTypes.STRING(30),   allowNull: true, field: 'order_number' },
  systemStatus:   { type: DataTypes.STRING(100),  allowNull: true, field: 'system_status' },
  costCenter:     { type: DataTypes.STRING(20),   allowNull: true, field: 'cost_center' },
  operWorkCtr:    { type: DataTypes.STRING(20),   allowNull: true, field: 'oper_work_ctr' },
  kadisArea:      { type: DataTypes.STRING(50),   allowNull: true, field: 'kadis_area' },
  evaluasi:         { type: DataTypes.TEXT,          allowNull: true },
  equipmentStatus:  { type: DataTypes.ENUM('Running', 'Standby', 'Breakdown'), allowNull: true, field: 'equipment_status' },
  submittedBy:    { type: DataTypes.STRING(20),   allowNull: true, field: 'submitted_by' },
  submittedAt:    { type: DataTypes.DATE,          allowNull: true, field: 'submitted_at' },
  kasieApprovedBy:           { type: DataTypes.STRING(20), allowNull: true, field: 'kasie_approved_by' },
  kasieApprovedAt:           { type: DataTypes.DATE,       allowNull: true, field: 'kasie_approved_at' },
  kadisPerawatanApprovedBy:  { type: DataTypes.STRING(20), allowNull: true, field: 'kadis_perawatan_approved_by' },
  kadisPerawatanApprovedAt:  { type: DataTypes.DATE,       allowNull: true, field: 'kadis_perawatan_approved_at' },
  kadisApprovedBy:           { type: DataTypes.STRING(20), allowNull: true, field: 'kadis_approved_by' },
  kadisApprovedAt:           { type: DataTypes.DATE,       allowNull: true, field: 'kadis_approved_at' },
}, {
  tableName: 'spk',
  underscored: true,
  indexes: [
    { fields: ['status'] },
    { fields: ['category'] },
    { fields: ['scheduled_date'] },
    { fields: ['submitted_by'] },
    { fields: ['status', 'scheduled_date'] },  // composite: approval tab + date range
  ],
});

// ── SPK ↔ Equipment (junction) ───────────────────────────────────────────────
const SpkEquipment = sequelize.define('SpkEquipment', {
  id:                { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  spkNumber:         { type: DataTypes.STRING(30), allowNull: false,  field: 'spk_number' },
  equipmentId:       { type: DataTypes.STRING(20), allowNull: false,  field: 'equipment_id' },
  equipmentName:     { type: DataTypes.STRING(150), allowNull: true,  field: 'equipment_name' },
  functionalLocation:{ type: DataTypes.STRING(200), allowNull: true,  field: 'functional_location' },
  plantName:         { type: DataTypes.STRING(150), allowNull: true,  field: 'plant_name' },
}, {
  tableName: 'spk_equipment',
  underscored: true,
  timestamps: false,
  indexes: [
    { fields: ['spk_number'] },
    { fields: ['equipment_id'] },
  ],
});

// ── SPK Activities ────────────────────────────────────────────────────────────
const SpkActivity = sequelize.define('SpkActivity', {
  id:             { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  spkNumber:      { type: DataTypes.STRING(30),  allowNull: false, field: 'spk_number' },
  activityNumber: { type: DataTypes.STRING(20),  allowNull: false, field: 'activity_number' },
  equipmentId:    { type: DataTypes.STRING(20),  allowNull: true,  field: 'equipment_id' },
  controlKey:     { type: DataTypes.STRING(10),   allowNull: true,  field: 'control_key' },
  operationText:  { type: DataTypes.TEXT,         allowNull: false, field: 'operation_text' },
  resultComment:  { type: DataTypes.TEXT,         allowNull: true,  field: 'result_comment' },
  durationPlan:   { type: DataTypes.DECIMAL(6,2), allowNull: true,  field: 'duration_plan' },
  durationActual: { type: DataTypes.DECIMAL(6,2), allowNull: true,  field: 'duration_actual' },
  isVerified:     { type: DataTypes.BOOLEAN,      allowNull: false, defaultValue: false, field: 'is_verified' },
  measurementType:  { type: DataTypes.STRING(100),   allowNull: true, field: 'measurement_type' },
  measurementUnit:  { type: DataTypes.STRING(50),    allowNull: true, field: 'measurement_unit' },
  measurementValue: { type: DataTypes.DOUBLE, allowNull: true, field: 'measurement_value' },
}, {
  tableName: 'spk_activities',
  underscored: true,
  timestamps: false,
  indexes: [
    { fields: ['spk_number'] },
    { fields: ['equipment_id'] },
  ],
});

module.exports = { Spk, SpkEquipment, SpkActivity };
