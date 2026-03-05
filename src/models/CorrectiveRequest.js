'use strict';

const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

// ── Corrective Request ────────────────────────────────────────────────────────
const CorrectiveRequest = sequelize.define('CorrectiveRequest', {
  id:                 { type: DataTypes.STRING(30),  primaryKey: true },
  notificationDate:   { type: DataTypes.DATEONLY,    allowNull: true,  field: 'notification_date' },
  notificationType:   { type: DataTypes.STRING(50),  allowNull: true,  field: 'notification_type' },
  description:        { type: DataTypes.STRING(500), allowNull: true },
  functionalLocation: { type: DataTypes.STRING(200), allowNull: true,  field: 'functional_location' },
  equipment:          { type: DataTypes.STRING(200), allowNull: true },
  requiredStart:      { type: DataTypes.DATEONLY,    allowNull: true,  field: 'required_start' },
  requiredEnd:        { type: DataTypes.DATEONLY,    allowNull: true,  field: 'required_end' },
  reportedBy:         { type: DataTypes.STRING(100), allowNull: true,  field: 'reported_by' },
  longText:           { type: DataTypes.TEXT,        allowNull: true,  field: 'long_text' },
  // Who submitted this request from the app
  submittedBy:        { type: DataTypes.STRING(20),  allowNull: true,  field: 'submitted_by' },
  submittedAt:        { type: DataTypes.DATE,        allowNull: true,  field: 'submitted_at' },
  // Request status
  status:             {
    type: DataTypes.ENUM('draft','submitted','approved','rejected'),
    allowNull: false,
    defaultValue: 'draft',
  },
  // Approval fields (same pattern as LembarKerja)
  approvalStatus:     {
    type: DataTypes.ENUM('pending','awaiting_supervisor','awaiting_manager','approved','rejected'),
    allowNull: true,
    defaultValue: 'pending',
    field: 'approval_status',
  },
  approvedBy:         { type: DataTypes.STRING(20),  allowNull: true, field: 'approved_by' },
  approvedAt:         { type: DataTypes.DATE,        allowNull: true, field: 'approved_at' },
  rejectedBy:         { type: DataTypes.STRING(20),  allowNull: true, field: 'rejected_by' },
  rejectedAt:         { type: DataTypes.DATE,        allowNull: true, field: 'rejected_at' },
  rejectionNotes:     { type: DataTypes.TEXT,        allowNull: true, field: 'rejection_notes' },
}, {
  tableName: 'corrective_requests',
  underscored: true,
});

// ── Corrective Request Images ─────────────────────────────────────────────────
const CorrectiveRequestImage = sequelize.define('CorrectiveRequestImage', {
  id:         { type: DataTypes.INTEGER,     primaryKey: true, autoIncrement: true },
  requestId:  { type: DataTypes.STRING(30),  allowNull: false, field: 'request_id' },
  imagePath:  { type: DataTypes.STRING(500), allowNull: false, field: 'image_path' },
}, {
  tableName: 'corrective_request_images',
  underscored: true,
  timestamps: false,
});

module.exports = { CorrectiveRequest, CorrectiveRequestImage };
