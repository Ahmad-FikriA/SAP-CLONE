'use strict';

const sequelize = require('./config/database');
const { DataTypes } = require('sequelize');

async function migrate() {
  try {
    await sequelize.authenticate();
    const qi = sequelize.getQueryInterface();
    const tableDesc = await qi.describeTable('spk_activities');

    // Add confirmation column if it doesn't exist
    if (tableDesc.confirmation) {
      console.log('Kolom confirmation di tabel spk_activities sudah ada, skip');
    } else {
      await qi.addColumn('spk_activities', 'confirmation', {
        type: DataTypes.INTEGER,
        allowNull: true,
      });
      console.log('Kolom confirmation berhasil ditambahkan ke tabel spk_activities');
    }
  } catch (e) {
    console.error('Migrasi spk_activities gagal:', e.message);
    process.exit(1);
  } finally {
    await sequelize.close();
  }
}

migrate();
