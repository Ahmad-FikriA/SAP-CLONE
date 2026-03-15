'use strict';

const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const User = sequelize.define('User', {
  id:       { type: DataTypes.STRING(20),  primaryKey: true },
  username: { type: DataTypes.STRING(50),  allowNull: false, unique: true },
  password: { type: DataTypes.STRING(255), allowNull: false },
  name:     { type: DataTypes.STRING(100), allowNull: false },
  role:     { type: DataTypes.ENUM('teknisi','planner','supervisor','manager','admin','user','kadis','kasie','kadis_pusat'), allowNull: false, defaultValue: 'teknisi' },
  workCenter: { type: DataTypes.ENUM('electrical','civil','automation','mechanical'), allowNull: true, field: 'work_center' },
  department: { type: DataTypes.STRING(50), allowNull: true },
  email:    { type: DataTypes.STRING(100), allowNull: true },
}, {
  tableName: 'users',
  underscored: true,
});

module.exports = User;
