'use strict';

/**
 * Script untuk verifikasi kolom 'attachments' di tabel inspection_reports.
 * Jika tidak ada, akan ditambahkan secara otomatis.
 */

const sequelize = require('./config/database');

async function checkAndFix() {
  console.log('=== Checking inspection_reports schema ===');
  try {
    await sequelize.authenticate();
    console.log('✓ Database connected.');

    // Ambil deskripsi kolom tabel
    const [columns] = await sequelize.query(
      `SHOW COLUMNS FROM inspection_reports LIKE 'attachments';`
    );

    if (columns.length === 0) {
      console.log('✗ Column "attachments" NOT FOUND. Adding now...');
      await sequelize.query(
        `ALTER TABLE inspection_reports ADD COLUMN attachments TEXT NULL COMMENT 'Dokumen lampiran (JSON array of file path strings)' AFTER approvalNotes;`
      );
      console.log('✓ Column "attachments" added successfully!');
    } else {
      console.log('✓ Column "attachments" EXISTS:', columns[0]);
    }

    process.exit(0);
  } catch (err) {
    console.error('✗ Error:', err.message);
    process.exit(1);
  }
}

checkAndFix();
