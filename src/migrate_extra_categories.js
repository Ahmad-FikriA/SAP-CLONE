'use strict';

const sequelize = require('./config/database');
const { DataTypes } = require('sequelize');

async function migrate() {
  try {
    await sequelize.authenticate();
    const qi = sequelize.getQueryInterface();

    const tableDesc = await qi.describeTable('equipment');

    if (tableDesc.extra_categories) {
      console.log('Kolom extra_categories sudah ada, skip ALTER TABLE');
    } else {
      await qi.addColumn('equipment', 'extra_categories', {
        type: DataTypes.TEXT,
        allowNull: true,
        defaultValue: null,
      });
      console.log('Kolom extra_categories ditambahkan ke tabel equipment');
    }

    console.log('Migrasi selesai. Tidak ada backfill — kolom default NULL untuk baris lama.');
  } catch (e) {
    console.error('Migrasi gagal:', e.message);
    process.exit(1);
  } finally {
    await sequelize.close();
  }
}

migrate();
