'use strict';

const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

// Sipil (civil) PM uses FuncLoc codes as the maintenance subject — no Equipment ID.
// This table maps FuncLoc code → building name + task list + interval (always 1wk).
const SipilFunclocMapping = sequelize.define('SipilFunclocMapping', {
  funcLocId:  { type: DataTypes.STRING(50),  primaryKey: true, field: 'func_loc_id' },
  name:       { type: DataTypes.STRING(200), allowNull: false },
  taskListId: { type: DataTypes.STRING(20),  allowNull: true, field: 'task_list_id' },
  interval:   { type: DataTypes.STRING(30),  allowNull: false, defaultValue: '1wk' },
  location:   { type: DataTypes.STRING(100), allowNull: true },
  plantId:    { type: DataTypes.STRING(20),  allowNull: true, field: 'plant_id' },
}, {
  tableName: 'sipil_funcloc_mappings',
  underscored: true,
  timestamps: false,
});

module.exports = SipilFunclocMapping;
