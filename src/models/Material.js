'use strict';

const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Material = sequelize.define('Material', {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true,
  },
  materialCode: {
    type: DataTypes.STRING(100),
    allowNull: false,
    unique: true,
    field: 'material_code',
  },
  name: {
    type: DataTypes.STRING(255),
    allowNull: false,
  },
  quantity: {
    type: DataTypes.DECIMAL(15, 3),
    allowNull: false,
    defaultValue: 0,
    field: 'quantity', // mapping to 'Unrestricted'
  },
  uom: {
    type: DataTypes.STRING(20),
    allowNull: true,
    defaultValue: 'PCS',
    field: 'uom', // mapping to 'Base Unit of Measure'
  },
  price: {
    type: DataTypes.DECIMAL(15, 2),
    allowNull: false,
    defaultValue: 0,
  },
  valueUnrestricted: {
    type: DataTypes.DECIMAL(15, 2),
    allowNull: true,
    defaultValue: 0,
    field: 'value_unrestricted',
  },
  plant: {
    type: DataTypes.STRING(50),
    allowNull: true,
  },
  storageLocation: {
    type: DataTypes.STRING(50),
    allowNull: true,
    field: 'storage_location',
  },
  cabinetCode: {
    type: DataTypes.STRING(100),
    allowNull: true,
    field: 'cabinet_code',
  },
  blockedQuantity: {
    type: DataTypes.DECIMAL(15, 3),
    allowNull: true,
    defaultValue: 0,
    field: 'blocked_quantity',
  },
  valueBlockedStock: {
    type: DataTypes.DECIMAL(15, 2),
    allowNull: true,
    defaultValue: 0,
    field: 'value_blocked_stock',
  },
}, {
  tableName: 'materials',
  underscored: true,
  timestamps: true,
});

module.exports = Material;
