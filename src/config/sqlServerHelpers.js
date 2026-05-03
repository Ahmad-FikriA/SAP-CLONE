'use strict';

const sequelize = require('./database');

async function getAllTableNames() {
  const [tables] = await sequelize.query(
    "SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_TYPE = 'BASE TABLE' AND TABLE_CATALOG = DB_NAME()"
  );
  return tables.map(t => t.TABLE_NAME);
}

async function disableForeignKeyChecks(transaction) {
  const tables = await getAllTableNames();
  for (const table of tables) {
    await sequelize.query(`ALTER TABLE [${table}] NOCHECK CONSTRAINT ALL`, { transaction });
  }
}

async function enableForeignKeyChecks(transaction) {
  const tables = await getAllTableNames();
  for (const table of tables) {
    await sequelize.query(`ALTER TABLE [${table}] CHECK CONSTRAINT ALL`, { transaction });
  }
}

async function disableForeignKeyChecksForTables(tableNames, transaction) {
  for (const table of tableNames) {
    try {
      await sequelize.query(`ALTER TABLE [${table}] NOCHECK CONSTRAINT ALL`, { transaction });
    } catch (e) {}
  }
}

async function enableForeignKeyChecksForTables(tableNames, transaction) {
  for (const table of tableNames) {
    try {
      await sequelize.query(`ALTER TABLE [${table}] CHECK CONSTRAINT ALL`, { transaction });
    } catch (e) {}
  }
}

function isTableNotFoundError(err) {
  const code = err?.original?.code || err?.parent?.code || err?.code || '';
  const message = String(err?.message || '');
  return (
    code === 'ER_NO_SUCH_TABLE' ||
    code === 'ER_BAD_TABLE_ERROR' ||
    code === 'EOBJNOTFOUND' ||
    message.includes("doesn't exist") ||
    message.includes('Invalid object name') ||
    message.includes('Could not find')
  );
}

module.exports = {
  disableForeignKeyChecks,
  enableForeignKeyChecks,
  disableForeignKeyChecksForTables,
  enableForeignKeyChecksForTables,
  isTableNotFoundError,
};
