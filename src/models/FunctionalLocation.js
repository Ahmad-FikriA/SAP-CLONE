'use strict';

const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const FunctionalLocation = sequelize.define('FunctionalLocation', {
    funcLocId: {
        type: DataTypes.STRING(50),
        primaryKey: true,
        field: 'func_loc_id',
    },
    description: {
        type: DataTypes.STRING(200),
        allowNull: false,
    },
    parentId: {
        type: DataTypes.STRING(50),
        allowNull: true,
        field: 'parent_id',
        references: { model: 'functional_locations', key: 'func_loc_id' },
    },
    level: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
    },
}, {
    tableName: 'functional_locations',
    underscored: true,
    timestamps: false,
});

module.exports = FunctionalLocation;
