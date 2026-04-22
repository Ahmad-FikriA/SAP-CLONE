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

async function ensureInspectionScheduleRecurringSchema() {
  const qi = sequelize.getQueryInterface();
  const table = 'inspection_schedules';
  let desc;
  try { desc = await qi.describeTable(table); } catch (e) { return; }
  if (!desc.isRecurring)
    await qi.addColumn(table, 'isRecurring', { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false });
  if (!desc.recurringGroupId)
    await qi.addColumn(table, 'recurringGroupId', { type: DataTypes.STRING(100), allowNull: true });
  if (!desc.recurringType)
    await qi.addColumn(table, 'recurringType', { type: DataTypes.STRING(50), allowNull: true });
  if (!desc.recurringEndDate)
    await qi.addColumn(table, 'recurringEndDate', { type: DataTypes.DATEONLY, allowNull: true });
  if (!desc.recurringInstance)
    await qi.addColumn(table, 'recurringInstance', { type: DataTypes.INTEGER, allowNull: true });
}

module.exports = {
  ensureGeneralTaskListActivitySchema,
  ensureSpkActivitySchema,
  ensureSubmissionActivityResultSchema,
  ensureInspectionScheduleRecurringSchema,
};
