'use strict';

const { DataTypes } = require('sequelize');
const sequelize = require('./config/database');

async function migrateMaterials() {
  console.log('--- Material Table Migration ---');
  const qi = sequelize.getQueryInterface();
  const table = 'materials';

  try {
    // 1. Ensure table exists (if not, sync will create it later, but we can do it now)
    // However, if we want to be safe, we check if it exists first.
    const tables = await qi.showAllTables();
    if (!tables.includes(table)) {
      console.log(`Table "${table}" not found. Creating table...`);
      // We can use the model's sync if we import it, but let's just use raw define/sync here for independence
      // or just wait for server.js to handle the initial creation.
      // Better: let's just check columns if it exists.
    }

    let desc;
    try {
      desc = await qi.describeTable(table);
      console.log(`Table "${table}" exists. Checking columns...`);
    } catch (e) {
      console.log(`Table "${table}" does not exist yet. It will be created by sequelize.sync() on startup.`);
      return;
    }

    // List of SAP columns to ensure
    const columnsToAdd = [
      { name: 'uom', type: DataTypes.STRING(20), defaultValue: 'PCS' },
      { name: 'value_unrestricted', type: DataTypes.DECIMAL(15, 2), defaultValue: 0 },
      { name: 'plant', type: DataTypes.STRING(50) },
      { name: 'storage_location', type: DataTypes.STRING(50) },
      { name: 'blocked_quantity', type: DataTypes.DECIMAL(15, 3), defaultValue: 0 },
      { name: 'value_blocked_stock', type: DataTypes.DECIMAL(15, 2), defaultValue: 0 },
    ];

    for (const col of columnsToAdd) {
      if (!desc[col.name]) {
        console.log(`Adding column "${col.name}" to "${table}"...`);
        await qi.addColumn(table, col.name, {
          type: col.type,
          allowNull: true,
          defaultValue: col.defaultValue
        });
      }
    }

    console.log('Material migration completed successfully.');
  } catch (error) {
    console.error('Material migration failed:', error.message);
  } finally {
    // We don't close the connection here if this script is called standalone in prestart,
    // but usually, individual migration scripts in this project exit the process.
    if (require.main === module) {
      process.exit(0);
    }
  }
}

if (require.main === module) {
  migrateMaterials();
}

module.exports = migrateMaterials;
