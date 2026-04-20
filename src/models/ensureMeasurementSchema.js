'use strict';

const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

async function ensureGeneralTaskListActivitySchema() {
  const qi = sequelize.getQueryInterface();
  const table = 'general_task_list_activities';
  let desc;
  try { desc = await qi.describeTable(table); } catch (e) { return; }
  if (!desc.measurement_type)
    await qi.addColumn(table, 'measurement_type', { type: DataTypes.STRING(100), allowNull: true });
  if (!desc.measurement_unit)
    await qi.addColumn(table, 'measurement_unit', { type: DataTypes.STRING(50), allowNull: true });
}

async function ensureSpkActivitySchema() {
  const qi = sequelize.getQueryInterface();
  const table = 'spk_activities';
  let desc;
  try { desc = await qi.describeTable(table); } catch (e) { return; }
  if (!desc.measurement_type)
    await qi.addColumn(table, 'measurement_type', { type: DataTypes.STRING(100), allowNull: true });
  if (!desc.measurement_unit)
    await qi.addColumn(table, 'measurement_unit', { type: DataTypes.STRING(50), allowNull: true });
  if (!desc.measurement_value)
    await qi.addColumn(table, 'measurement_value', { type: DataTypes.DOUBLE, allowNull: true });
  else
    await qi.changeColumn(table, 'measurement_value', { type: DataTypes.DOUBLE, allowNull: true });
}

async function ensureSubmissionActivityResultSchema() {
  const qi = sequelize.getQueryInterface();
  const table = 'submission_activity_results';
  let desc;
  try { desc = await qi.describeTable(table); } catch (e) { return; }
  if (!desc.measurement_value)
    await qi.addColumn(table, 'measurement_value', { type: DataTypes.DOUBLE, allowNull: true });
  else
    await qi.changeColumn(table, 'measurement_value', { type: DataTypes.DOUBLE, allowNull: true });
}

module.exports = {
  ensureGeneralTaskListActivitySchema,
  ensureSpkActivitySchema,
  ensureSubmissionActivityResultSchema,
};
