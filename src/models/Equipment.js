'use strict';

const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Equipment = sequelize.define('Equipment', {
  equipmentId:       { type: DataTypes.STRING(20),  primaryKey: true,  field: 'equipment_id' },
  equipmentName:     { type: DataTypes.STRING(150), allowNull: false,   field: 'equipment_name' },
  functionalLocation:{ type: DataTypes.STRING(200), allowNull: true,    field: 'functional_location' },
  category:          { type: DataTypes.ENUM('Mekanik','Listrik','Sipil','Otomasi'), allowNull: false },
  plantId:           { type: DataTypes.STRING(20),  allowNull: true,    field: 'plant_id' },
  plantName:         { type: DataTypes.STRING(150), allowNull: true,    field: 'plant_name' },
  latitude:          { 
    type: DataTypes.DECIMAL(10,7), 
    allowNull: true,
    validate: { min: -90, max: 90 } 
  },
  longitude:         { 
    type: DataTypes.DECIMAL(10,7), 
    allowNull: true,
    validate: { min: -180, max: 180 } 
  },
}, {
  tableName: 'equipment',
  underscored: true,
});

module.exports = Equipment;
