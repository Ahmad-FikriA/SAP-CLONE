'use strict';

const sequelize = require('./config/database');
const { DataTypes } = require('sequelize');
const { detectKadisFromFuncLoc } = require('./services/spkImportService');

async function migrate() {
  try {
    await sequelize.authenticate();
    const qi = sequelize.getQueryInterface();

    // 1. Add the column (safe — checks existence first)
    const tableDesc = await qi.describeTable('spk');

    if (tableDesc.kadis_area) {
      console.log('Kolom kadis_area sudah ada, skip ALTER TABLE');
    } else {
      await qi.addColumn('spk', 'kadis_area', {
        type: DataTypes.STRING(50),
        allowNull: true,
      });
      console.log('Kolom kadis_area ditambahkan ke tabel spk');
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

    console.log(`Memproses ${rows.length} SPK untuk backfill kadis_area...`);

    const counts = {};
    let nullCount = 0;

    for (const row of rows) {
      const kadisArea = detectKadisFromFuncLoc(row.functional_location);
      if (kadisArea) {
        await sequelize.query(
          'UPDATE spk SET kadis_area = :kadisArea WHERE spk_number = :spkNumber',
          { replacements: { kadisArea, spkNumber: row.spk_number } }
        );
        counts[kadisArea] = (counts[kadisArea] || 0) + 1;
      } else {
        nullCount++;
      }
    }

    console.log('Backfill selesai:');
    for (const [area, count] of Object.entries(counts)) {
      console.log(`   ${area}: ${count} SPK`);
    }
    if (nullCount > 0) console.log(`   (tidak teridentifikasi / tanpa equipment): ${nullCount} SPK`);

  } catch (e) {
    console.error('Migrasi gagal:', e.message);
    process.exit(1);
  } finally {
    await sequelize.close();
  }
}

migrate();
