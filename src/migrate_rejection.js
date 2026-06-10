'use strict';

const sequelize = require('./config/database');
const { DataTypes } = require('sequelize');

async function migrate() {
  try {
    await sequelize.authenticate();
    const qi = sequelize.getQueryInterface();
    const dialect = sequelize.getDialect();

    // 1. Extend the status column to include 'rejected'
    //    On MSSQL the status column is already VARCHAR (STRING), so no ENUM change needed.
    //    On MySQL we attempt to MODIFY the ENUM.
    if (dialect === 'mysql') {
      try {
        await sequelize.query(`
          ALTER TABLE spk
          MODIFY COLUMN status ENUM(
            'pending','in_progress','completed',
            'awaiting_kasie','awaiting_kadis_perawatan','awaiting_kadis',
            'approved','rejected'
          ) NOT NULL DEFAULT 'pending'
        `);
        console.log('✅ SPK status ENUM extended with rejected');
      } catch (e) {
        if (e.message.includes('already exists') || e.message.includes('Duplicate')) {
          console.log('ℹ️  ENUM already includes rejected, skip');
        } else {
          throw e;
        }
      }
    } else {
      console.log('ℹ️  Skipping ENUM modification — status column is VARCHAR (STRING) on MSSQL.');
    }

    // 2. Create spk_rejection_logs table via Sequelize model sync (dialect-agnostic)
    const SpkRejectionLog = require('./models/SpkRejectionLog');
    await SpkRejectionLog.sync();
    console.log('✅ spk_rejection_logs table ensured');

  } catch (e) {
    console.error('❌ Migration failed:', e.message);
    process.exit(1);
  } finally {
    await sequelize.close();
  }
}

migrate();
