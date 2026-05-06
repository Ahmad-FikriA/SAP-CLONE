'use strict';

const sequelize = require('./config/database');

async function migrate() {
  try {
    try {
      await sequelize.query('ALTER TABLE equipment ADD COLUMN extra_categories JSON NULL');
      console.log('✅ Kolom extra_categories ditambahkan ke tabel equipment');
    } catch (e) {
      if (e.message.includes('Duplicate column')) {
        console.log('ℹ️  Kolom extra_categories sudah ada, skip ALTER TABLE');
      } else {
        throw e;
      }
    }
    console.log('✅ Migrasi selesai. Tidak ada backfill — kolom default NULL untuk baris lama.');
  } catch (e) {
    console.error('❌ Migrasi gagal:', e.message);
    process.exit(1);
  } finally {
    await sequelize.close();
  }
}

migrate();
