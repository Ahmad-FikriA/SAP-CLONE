'use strict';
const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const EquipmentIntervalMapping = sequelize.define('EquipmentIntervalMapping', {
  id:          { type: DataTypes.INTEGER,    primaryKey: true, autoIncrement: true },
  equipmentId: { type: DataTypes.STRING(20), allowNull: false, field: 'equipment_id' },
  interval:    { type: DataTypes.STRING(30), allowNull: true },   // null = task list known, interval not yet set
  taskListId:  { type: DataTypes.STRING(20), allowNull: true,  field: 'task_list_id' },
}, {
  tableName: 'equipment_interval_mappings',
  underscored: true,
  timestamps: false,
  indexes: [{ unique: true, fields: ['equipment_id', 'task_list_id'] }],
});

module.exports = EquipmentIntervalMapping;
