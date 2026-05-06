'use strict';

const sequelize = require('./config/database');
const { detectKadisFromFuncLoc } = require('./services/spkImportService');

async function migrate() {
  try {
    // 1. Add the column (safe to run if already exists — catches the error)
    try {
      await sequelize.query('ALTER TABLE spk ADD COLUMN kadis_area VARCHAR(50) NULL');
      console.log('✅ Kolom kadis_area ditambahkan ke tabel spk');
    } catch (e) {
      if (e.message.includes('Duplicate column')) {
        console.log('ℹ️  Kolom kadis_area sudah ada, skip ALTER TABLE');
      } else {
        throw e;
      }
    }

    // 2. Backfill: join spk → spk_equipment, take the first functional_location per spk
    const [rows] = await sequelize.query(`
      SELECT s.spk_number, se.functional_location
      FROM spk s
      LEFT JOIN (
        SELECT spk_number, MIN(functional_location) AS functional_location
        FROM spk_equipment
        WHERE functional_location IS NOT NULL AND functional_location != ''
        GROUP BY spk_number
      ) se ON se.spk_number = s.spk_number
      WHERE s.kadis_area IS NULL
    `);

    console.log(`🔄 Memproses ${rows.length} SPK untuk backfill kadis_area...`);

    const counts = {};
    let nullCount = 0;

    for (const row of rows) {
      const kadisArea = detectKadisFromFuncLoc(row.functional_location);
      if (kadisArea) {
        await sequelize.query(
          'UPDATE spk SET kadis_area = ? WHERE spk_number = ?',
          { replacements: [kadisArea, row.spk_number] }
        );
        counts[kadisArea] = (counts[kadisArea] || 0) + 1;
      } else {
        nullCount++;
      }
    }

    console.log('✅ Backfill selesai:');
    for (const [area, count] of Object.entries(counts)) {
      console.log(`   ${area}: ${count} SPK`);
    }
    if (nullCount > 0) console.log(`   (tidak teridentifikasi / tanpa equipment): ${nullCount} SPK`);

  } catch (e) {
    console.error('❌ Migrasi gagal:', e.message);
    process.exit(1);
  } finally {
    await sequelize.close();
  }
}

migrate();
