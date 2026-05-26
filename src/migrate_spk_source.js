'use strict';

const sequelize = require('./config/database');

async function migrate() {
  try {
    // 1. Add source column
    try {
      await sequelize.query(
        "ALTER TABLE spk ADD COLUMN source ENUM('mantis', 'manual_import') NOT NULL DEFAULT 'mantis'"
      );
      console.log('✅ Kolom source ditambahkan');
    } catch (e) {
      if (e.message.includes('Duplicate column')) {
        console.log('ℹ️  Kolom source sudah ada, skip');
      } else throw e;
    }

    // 2. Make category nullable
    await sequelize.query(
      "ALTER TABLE spk MODIFY COLUMN category ENUM('Mekanik','Listrik','Sipil','Otomasi') NULL"
    );
    console.log('✅ Kolom category dibuat nullable');
  } catch (e) {
    console.error('❌ Migrasi gagal:', e.message);
    process.exit(1);
  } finally {
    await sequelize.close();
  }
}

migrate();
