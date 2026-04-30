'use strict';

const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');


const SipilFunclocMapping = sequelize.define('SipilFunclocMapping', {
  funcLocId:  { type: DataTypes.STRING(50), primaryKey: true, field: 'func_loc_id' },
  name:       { type: DataTypes.STRING(200), allowNull: false },
  taskListId: { type: DataTypes.STRING(20),  allowNull: true, field: 'task_list_id' },
  interval:   { type: DataTypes.STRING(30),  allowNull: false, defaultValue: '1wk' },
  location:   { type: DataTypes.STRING(100), allowNull: true },
}, {
  tableName: 'sipil_funcloc_mappings',
  underscored: true,
  timestamps: false,
});

module.exports = SipilFunclocMapping;
