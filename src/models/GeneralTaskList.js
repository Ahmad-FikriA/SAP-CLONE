'use strict';

const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

// ── General Task List (header) ───────────────────────────────────────────────
const GeneralTaskList = sequelize.define('GeneralTaskList', {
    taskListId: {
        type: DataTypes.STRING(20),
        primaryKey: true,
        field: 'task_list_id',
    },
    taskListName: {
        type: DataTypes.STRING(200),
        allowNull: false,
        field: 'task_list_name',
    },
    category: {
        type: DataTypes.ENUM('Mekanik', 'Listrik', 'Sipil', 'Otomasi'),
        allowNull: false,
    },
    workCenter: {
        type: DataTypes.STRING(50),
        allowNull: true,
        field: 'work_center',
    },
}, {
    tableName: 'general_task_lists',
    underscored: true,
    timestamps: false,
});

// ── General Task List Activity (child) ──────────────────────────────────────
const GeneralTaskListActivity = sequelize.define('GeneralTaskListActivity', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
    },
    taskListId: {
        type: DataTypes.STRING(20),
        allowNull: false,
        field: 'task_list_id',
    },
    stepNumber: {
        type: DataTypes.INTEGER,
        allowNull: false,
        field: 'step_number',
    },
    operationText: {
        type: DataTypes.STRING(500),
        allowNull: false,
        field: 'operation_text',
    },
}, {
    tableName: 'general_task_list_activities',
    underscored: true,
    timestamps: false,
});

module.exports = { GeneralTaskList, GeneralTaskListActivity };
