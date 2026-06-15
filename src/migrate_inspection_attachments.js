'use strict';

const sequelize = require('./config/database');
const { DataTypes } = require('sequelize');

async function migrateInspectionAttachments() {
  console.log('Starting Inspection Attachments Schema Migration...');

  try {
    await sequelize.authenticate();
    console.log('Connected to Database via Sequelize.');
    const qi = sequelize.getQueryInterface();

    console.log('Migrating table: inspection_reports...');

    const tableDesc = await qi.describeTable('inspection_reports');

    if (tableDesc.attachments) {
      console.log(' -> Column "attachments" already exists, skipping.');
    } else {
      await qi.addColumn('inspection_reports', 'attachments', {
        type: DataTypes.TEXT,
        allowNull: true,
        defaultValue: null,
      });
      console.log(' -> Added "attachments" column to inspection_reports. OK');
    }

    console.log('Migration completed successfully.');
    process.exit(0);
  } catch (err) {
    console.error('Migration failed:', err);
    process.exit(1);
  }
}

migrateInspectionAttachments();
