'use strict';
const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const PreventiveWeekSchedule = sequelize.define('PreventiveWeekSchedule', {
  id:         { type: DataTypes.INTEGER,   primaryKey: true, autoIncrement: true },
  year:       { type: DataTypes.INTEGER,   allowNull: false },
  weekNumber: { type: DataTypes.INTEGER,   allowNull: false, field: 'week_number' },
  interval:   { type: DataTypes.STRING(10), allowNull: false },
}, {
  tableName: 'preventive_week_schedules',
  underscored: true,
  timestamps: false,
  indexes: [{ unique: true, fields: ['year', 'week_number', 'interval'] }],
});

module.exports = PreventiveWeekSchedule;
