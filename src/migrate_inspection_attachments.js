'use strict';

const sequelize = require('./config/database');

async function migrateInspectionAttachments() {
  console.log('Starting Inspection Attachments Schema Migration...');

  try {
    await sequelize.authenticate();
    console.log('Connected to Database via Sequelize.');
    const qi = sequelize.getQueryInterface();

    console.log('Migrating table: inspection_reports...');

    // Tambah kolom 'attachments' — JSON array path file dokumen lampiran (PDF/DOCX/XLSX)
    try {
      await qi.addColumn('inspection_reports', 'attachments', {
        type: sequelize.constructor.DataTypes.TEXT,
        allowNull: true,
        comment: 'Dokumen lampiran (JSON array of file path strings, e.g. PDF/DOCX/XLSX)',
        defaultValue: null,
      });
      console.log(' -> Added "attachments" column to inspection_reports. OK');
    } catch (e) {
      if (e.original && e.original.code === 'ER_DUP_FIELDNAME') {
        console.log(' -> Column "attachments" already exists, skipping.');
      } else {
        throw e;
      }
    }

    console.log('Migration completed successfully.');
    process.exit(0);
  } catch (err) {
    console.error('Migration failed:', err);
    process.exit(1);
  }
}

migrateInspectionAttachments();
