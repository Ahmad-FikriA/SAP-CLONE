'use strict';

const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const SpkRejectionLog = sequelize.define('SpkRejectionLog', {
  id:              { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  spkNumber:       { type: DataTypes.STRING(30), allowNull: false, field: 'spk_number' },
  rejectedBy:      { type: DataTypes.STRING(20), allowNull: false, field: 'rejected_by' },
  rejectedAt:      { type: DataTypes.DATE,       allowNull: false, field: 'rejected_at' },
  rejectionReason: { type: DataTypes.TEXT,       allowNull: false, field: 'rejection_reason' },
  rejectedLevel:   { type: DataTypes.ENUM('kasie','kadis_perawatan','kadis'), allowNull: false, field: 'rejected_level' },
  resubmittedAt:   { type: DataTypes.DATE,       allowNull: true,  field: 'resubmitted_at' },
}, {
  tableName: 'spk_rejection_logs',
  underscored: true,
  indexes: [
    { fields: ['spk_number'] },
    { fields: ['rejected_at'] },
  ],
});

module.exports = SpkRejectionLog;
