'use strict';

const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

// ── Notification (Corrective Request) ─────────────────────────────────────────
const Notification = sequelize.define('Notification', {
  notificationId: {
    type: DataTypes.STRING(30),
    primaryKey: true,
    field: 'notification_id',
  },
  notificationDate: {
    type: DataTypes.DATEONLY,
    allowNull: true,
    field: 'notification_date',
  },
  notificationType: {
    type: DataTypes.STRING(50),
    allowNull: true,
    field: 'notification_type',
  },
  description: {
    type: DataTypes.STRING(500),
    allowNull: true,
  },
  functionalLocation: {
    type: DataTypes.STRING(200),
    allowNull: true,
    field: 'functional_location',
  },
  equipmentId: {
    type: DataTypes.STRING(20),
    allowNull: true,
    field: 'equipment_id',
  },
  equipmentName: {
    type: DataTypes.STRING(150),
    allowNull: true,
    field: 'equipment_name',
  },
  requiredStart: {
    type: DataTypes.DATEONLY,
    allowNull: true,
    field: 'required_start',
  },
  requiredEnd: {
    type: DataTypes.DATEONLY,
    allowNull: true,
    field: 'required_end',
  },
  reportedBy: {
    type: DataTypes.STRING(100),
    allowNull: true,
    field: 'reported_by',
  },
  longText: {
    type: DataTypes.TEXT,
    allowNull: true,
    field: 'long_text',
  },
  photo1: {
    type: DataTypes.STRING(500),
    allowNull: true,
    field: 'photo_1',
  },
  photo2: {
    type: DataTypes.STRING(500),
    allowNull: true,
    field: 'photo_2',
  },
  status: {
    type: DataTypes.ENUM('draft', 'submitted', 'menunggu_review_awal_kadis_pp', 'approved', 'ditolak_kadis_pp_awal', 'spk_created', 'closed'),
    allowNull: false,
    defaultValue: 'draft',
  },
  approvalStatus: {
    type: DataTypes.ENUM('pending', 'menunggu_review_awal_kadis_pp', 'ditolak_kadis_pp_awal', 'approved', 'rejected', 'spk_masuk', 'spk_issued', 'eksekusi', 'menunggu_review_kadis_pp', 'menunggu_review_kadis_pelapor', 'selesai'),
    allowNull: true,
    defaultValue: 'pending',
    field: 'approval_status',
  },
  // Work Center untuk routing ke teknisi yang tepat
  workCenter: {
    type: DataTypes.ENUM('electrical', 'civil', 'automation', 'mechanical'),
    allowNull: true,
    field: 'work_center',
  },
  // Kadis Pelapor - yang membuat laporan/notification ini
  kadisPelaporId: {
    type: DataTypes.STRING(20),
    allowNull: true,
    field: 'kadis_pelapor_id',
  },
  submittedBy: {
    type: DataTypes.STRING(20),
    allowNull: true,
    field: 'submitted_by',
  },
  submittedAt: {
    type: DataTypes.DATE,
    allowNull: true,
    field: 'submitted_at',
  },
}, {
  tableName: 'notifications',
  underscored: true,
});

module.exports = Notification;
