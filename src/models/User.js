'use strict';

const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const User = sequelize.define('User', {
  id:       { type: DataTypes.STRING(20),  primaryKey: true },
  nik:      { type: DataTypes.STRING(50),  allowNull: false, unique: true },
  password: { type: DataTypes.STRING(255), allowNull: false },
  name:     { type: DataTypes.STRING(100), allowNull: false },
  role:     {
    type: DataTypes.STRING(50),
    allowNull: false,
    defaultValue: 'teknisi'
  },
  dinas:    { type: DataTypes.STRING(100), allowNull: true },
  divisi:   { type: DataTypes.STRING(100), allowNull: false },
  email:    { type: DataTypes.STRING(100), allowNull: true },
  group:    { type: DataTypes.STRING(100), allowNull: true },
  fcmToken: {
    type: DataTypes.STRING(500),
    allowNull: true,
    field: 'fcm_token',
  },
  // permissions: {
  //   type: DataTypes.JSON,
  //   allowNull: true,
  //   field: 'allowed_pages',
  // },
}, {
  tableName: 'users',
  underscored: true,
  indexes: [
    { fields: ['role'] },
    { fields: ['dinas'] },
    { fields: ['group'] },
    { fields: ['role', 'dinas'] },   // approval: WHERE role='kadis' AND dinas=?
    { fields: ['role', 'group'] },   // notifications: WHERE role='teknisi' AND group LIKE ?
  ],
});

module.exports = User;
