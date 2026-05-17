'use strict';

const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const SpkMaterial = sequelize.define('SpkMaterial', {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true,
  },
  orderNumber: {
    type: DataTypes.STRING,
    allowNull: false,
    field: 'order_number',
  },
  materialId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    field: 'material_id',
  },
  quantityUsed: {
    type: DataTypes.DECIMAL(15, 3),
    allowNull: false,
    defaultValue: 0,
    field: 'quantity_used',
  },
  addedBy: {
    type: DataTypes.STRING(20),
    allowNull: true,
    field: 'added_by',
  },
}, {
  tableName: 'spk_materials',
  underscored: true,
  timestamps: true,
});

module.exports = SpkMaterial;
