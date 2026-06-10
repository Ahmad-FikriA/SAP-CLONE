'use strict';

const sequelize = require('./config/database');
const { DataTypes } = require('sequelize');

async function migrate() {
  try {
    await sequelize.authenticate();
    const qi = sequelize.getQueryInterface();
    const dialect = sequelize.getDialect();
    const tableDesc = await qi.describeTable('spk');

    // 1. Add source column if it doesn't exist
    if (tableDesc.source) {
      console.log('ℹ️  Kolom source sudah ada, skip');
    } else {
      await qi.addColumn('spk', 'source', {
        type: DataTypes.STRING(50),
        allowNull: false,
        defaultValue: 'mantis',
      });
      console.log('✅ Kolom source ditambahkan');
    }

    // 2. Make category nullable
    if (tableDesc.category) {
      await qi.changeColumn('spk', 'category', {
        type: DataTypes.STRING(50),
        allowNull: true,
      });
      console.log('✅ Kolom category dibuat nullable');
    }
  } catch (e) {
    console.error('❌ Migrasi gagal:', e.message);
    process.exit(1);
  } finally {
    await sequelize.close();
  }
}

migrate();
