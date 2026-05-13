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

async function ensureMaterialSchema() {
  const qi = sequelize.getQueryInterface();
  const table = 'materials';
  let desc;
  try { desc = await qi.describeTable(table); } catch (e) { return; }
  
  if (!desc.uom)
    await qi.addColumn(table, 'uom', { type: DataTypes.STRING(20), allowNull: true, defaultValue: 'PCS' });
  if (!desc.value_unrestricted)
    await qi.addColumn(table, 'value_unrestricted', { type: DataTypes.DECIMAL(15, 2), allowNull: true, defaultValue: 0 });
  if (!desc.plant)
    await qi.addColumn(table, 'plant', { type: DataTypes.STRING(50), allowNull: true });
  if (!desc.storage_location)
    await qi.addColumn(table, 'storage_location', { type: DataTypes.STRING(50), allowNull: true });
  if (!desc.blocked_quantity)
    await qi.addColumn(table, 'blocked_quantity', { type: DataTypes.DECIMAL(15, 3), allowNull: true, defaultValue: 0 });
  if (!desc.value_blocked_stock)
    await qi.addColumn(table, 'value_blocked_stock', { type: DataTypes.DECIMAL(15, 2), allowNull: true, defaultValue: 0 });
}

module.exports = {
  ensureGeneralTaskListActivitySchema,
  ensureSpkActivitySchema,
  ensureSubmissionActivityResultSchema,
  ensureInspectionScheduleRecurringSchema,
  ensureMaterialSchema,
};
