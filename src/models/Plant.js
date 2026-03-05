'use strict';

const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Plant = sequelize.define('Plant', {
  plantId:   { type: DataTypes.STRING(20),   primaryKey: true, field: 'plant_id' },
  plantName: { type: DataTypes.STRING(150),  allowNull: false,  field: 'plant_name' },
  shortName: { type: DataTypes.STRING(50),   allowNull: true,   field: 'short_name' },
  city:      { type: DataTypes.STRING(100),  allowNull: true },
  centerLat: { 
    type: DataTypes.DECIMAL(10,7),
    allowNull: true,   
    field: 'center_lat',
    validate: { min: -90, max: 90 } 
  },
  centerLon: { 
    type: DataTypes.DECIMAL(10,7),
    allowNull: true,   
    field: 'center_lon',
    validate: { min: -180, max: 180 } 
  },
  zoom:      { type: DataTypes.INTEGER,      defaultValue: 17 },
}, {
  tableName: 'plants',
  underscored: true,
  timestamps: false,
});

module.exports = Plant;
