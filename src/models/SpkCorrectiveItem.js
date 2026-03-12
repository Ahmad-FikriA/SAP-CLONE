'use strict';

const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

// ── SPK Corrective Item ───────────────────────────────────────────────────────
const SpkCorrectiveItem = sequelize.define('SpkCorrectiveItem', {
  itemId: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
    field: 'item_id',
  },
  spkId: {
    type: DataTypes.STRING(30),
    allowNull: false,
    field: 'spk_id',
  },
  itemType: {
    type: DataTypes.ENUM('material', 'service', 'tool'),
    allowNull: false,
    field: 'item_type',
  },
  itemName: {
    type: DataTypes.STRING(200),
    allowNull: false,
    field: 'item_name',
  },
  quantity: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
    defaultValue: 1,
  },
  uom: {
    type: DataTypes.STRING(20),
    allowNull: true,
    defaultValue: 'pcs',
  },
}, {
  tableName: 'spk_corrective_items',
  underscored: true,
  timestamps: false,
});

// ── SPK Corrective Photo ──────────────────────────────────────────────────────
const SpkCorrectivePhoto = sequelize.define('SpkCorrectivePhoto', {
  photoId: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
    field: 'photo_id',
  },
  spkId: {
    type: DataTypes.STRING(30),
    allowNull: false,
    field: 'spk_id',
  },
  photoType: {
    type: DataTypes.ENUM('before', 'after', 'during', 'documentation'),
    allowNull: false,
    defaultValue: 'documentation',
    field: 'photo_type',
  },
  photoPath: {
    type: DataTypes.STRING(500),
    allowNull: false,
    field: 'photo_path',
  },
}, {
  tableName: 'spk_corrective_photos',
  underscored: true,
  timestamps: false,
});

module.exports = { SpkCorrectiveItem, SpkCorrectivePhoto };
