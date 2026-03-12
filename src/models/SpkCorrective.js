'use strict';

const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

// ── SPK Corrective ────────────────────────────────────────────────────────────
const SpkCorrective = sequelize.define('SpkCorrective', {
  spkId: {
    type: DataTypes.STRING(30),
    primaryKey: true,
    field: 'spk_id',
  },
  notificationId: {
    type: DataTypes.STRING(30),
    allowNull: false,
    field: 'notification_id',
  },
  spkNumber: {
    type: DataTypes.STRING(30),
    allowNull: false,
    field: 'spk_number',
  },
  orderNumber: {
    type: DataTypes.STRING(30),
    allowNull: true,
    field: 'order_number',
  },
  createdDate: {
    type: DataTypes.DATEONLY,
    allowNull: false,
    defaultValue: DataTypes.NOW,
    field: 'created_date',
  },
  priority: {
    type: DataTypes.ENUM('low', 'medium', 'high', 'urgent'),
    allowNull: true,
    defaultValue: 'medium',
  },
  equipmentId: {
    type: DataTypes.STRING(20),
    allowNull: true,
    field: 'equipment_id',
  },
  location: {
    type: DataTypes.STRING(200),
    allowNull: true,
  },
  requestedFinishDate: {
    type: DataTypes.DATEONLY,
    allowNull: true,
    field: 'requested_finish_date',
  },
  actualStartDate: {
    type: DataTypes.DATEONLY,
    allowNull: true,
    field: 'actual_start_date',
  },
  damageClassification: {
    type: DataTypes.STRING(100),
    allowNull: true,
    field: 'damage_classification',
  },
  jobDescription: {
    type: DataTypes.TEXT,
    allowNull: true,
    field: 'job_description',
  },
  jobResultDescription: {
    type: DataTypes.TEXT,
    allowNull: true,
    field: 'job_result_description',
  },
  workCenter: {
    type: DataTypes.ENUM('electrical', 'civil', 'automation', 'mechanical'),
    allowNull: true,
    field: 'work_center',
  },
  ctrlKey: {
    type: DataTypes.STRING(20),
    allowNull: true,
    field: 'ctrl_key',
  },
  unit: {
    type: DataTypes.STRING(20),
    allowNull: true,
  },
  plannedWorker: {
    type: DataTypes.INTEGER,
    allowNull: true,
    defaultValue: 1,
    field: 'planned_worker',
  },
  plannedHourPerWorker: {
    type: DataTypes.DECIMAL(6, 2),
    allowNull: true,
    field: 'planned_hour_per_worker',
  },
  totalPlannedHour: {
    type: DataTypes.DECIMAL(8, 2),
    allowNull: true,
    field: 'total_planned_hour',
  },
  actualWorker: {
    type: DataTypes.INTEGER,
    allowNull: true,
    field: 'actual_worker',
  },
  actualHourPerWorker: {
    type: DataTypes.DECIMAL(6, 2),
    allowNull: true,
    field: 'actual_hour_per_worker',
  },
  totalActualHour: {
    type: DataTypes.DECIMAL(8, 2),
    allowNull: true,
    field: 'total_actual_hour',
  },
  // Approval fields
  kasieApprovedBy: {
    type: DataTypes.STRING(20),
    allowNull: true,
    field: 'kasie_approved_by',
  },
  kasieApprovedAt: {
    type: DataTypes.DATE,
    allowNull: true,
    field: 'kasie_approved_at',
  },
  kadisPusatApprovedBy: {
    type: DataTypes.STRING(20),
    allowNull: true,
    field: 'kadis_pusat_approved_by',
  },
  kadisPusatApprovedAt: {
    type: DataTypes.DATE,
    allowNull: true,
    field: 'kadis_pusat_approved_at',
  },
  kadisPelaporApprovedBy: {
    type: DataTypes.STRING(20),
    allowNull: true,
    field: 'kadis_pelapor_approved_by',
  },
  kadisPelaporApprovedAt: {
    type: DataTypes.DATE,
    allowNull: true,
    field: 'kadis_pelapor_approved_at',
  },
  status: {
    type: DataTypes.ENUM('draft', 'in_progress', 'awaiting_kasie', 'awaiting_kadis_pusat', 'awaiting_kadis_pelapor', 'completed', 'rejected'),
    allowNull: false,
    defaultValue: 'draft',
  },
  rejectedBy: {
    type: DataTypes.STRING(20),
    allowNull: true,
    field: 'rejected_by',
  },
  rejectedAt: {
    type: DataTypes.DATE,
    allowNull: true,
    field: 'rejected_at',
  },
  rejectionNotes: {
    type: DataTypes.TEXT,
    allowNull: true,
    field: 'rejection_notes',
  },
}, {
  tableName: 'spk_corrective',
  underscored: true,
});

module.exports = SpkCorrective;
