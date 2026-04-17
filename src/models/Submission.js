'use strict';

const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

// ── Submission ────────────────────────────────────────────────────────────────
const Submission = sequelize.define('Submission', {
  id:             { type: DataTypes.STRING(30),   primaryKey: true },
  spkNumber:      { type: DataTypes.STRING(30),   allowNull: false, field: 'spk_number' },
  durationActual: { type: DataTypes.DECIMAL(6,2), allowNull: true,  field: 'duration_actual' },
  evaluasi:       { type: DataTypes.TEXT,          allowNull: true },
  latitude:       { 
    type: DataTypes.DECIMAL(10,7), 
    allowNull: true,
    validate: { min: -90, max: 90 } 
  },
  longitude:      { 
    type: DataTypes.DECIMAL(10,7), 
    allowNull: true,
    validate: { min: -180, max: 180 } 
  },
  submittedAt:    { type: DataTypes.DATE,           allowNull: false, field: 'submitted_at' },
}, {
  tableName: 'submissions',
  underscored: true,
  updatedAt: false,
  indexes: [
    { fields: ['spk_number'] },
    { fields: ['submitted_at'] },
  ],
});

// ── Submission Photos ─────────────────────────────────────────────────────────
const SubmissionPhoto = sequelize.define('SubmissionPhoto', {
  id:           { type: DataTypes.INTEGER,     primaryKey: true, autoIncrement: true },
  submissionId: { type: DataTypes.STRING(30),  allowNull: false, field: 'submission_id' },
  photoPath:    { type: DataTypes.STRING(500), allowNull: false, field: 'photo_path' },
}, {
  tableName: 'submission_photos',
  underscored: true,
  timestamps: false,
});

// ── Submission Activity Results ───────────────────────────────────────────────
const SubmissionActivityResult = sequelize.define('SubmissionActivityResult', {
  id:             { type: DataTypes.INTEGER,    primaryKey: true, autoIncrement: true },
  submissionId:   { type: DataTypes.STRING(30), allowNull: false, field: 'submission_id' },
  activityNumber: { type: DataTypes.STRING(20), allowNull: false, field: 'activity_number' },
  resultComment:  { type: DataTypes.TEXT,        allowNull: true,  field: 'result_comment' },
  isNormal:       { type: DataTypes.BOOLEAN,     allowNull: false, defaultValue: true,  field: 'is_normal' },
  isVerified:     { type: DataTypes.BOOLEAN,     allowNull: false, defaultValue: false, field: 'is_verified' },
}, {
  tableName: 'submission_activity_results',
  underscored: true,
  timestamps: false,
  indexes: [
    { fields: ['submission_id'] },
  ],
});

module.exports = { Submission, SubmissionPhoto, SubmissionActivityResult };
