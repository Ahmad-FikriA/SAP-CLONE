'use strict';

const sequelize = require('./config/database');

async function migrate() {
  try {
    // 1. Extend the status ENUM to include 'rejected'
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
      if (e.message.includes("already exists") || e.message.includes("Duplicate")) {
        console.log('ℹ️  ENUM already includes rejected, skip');
      } else {
        throw e;
      }
    }

    // 2. Create spk_rejection_logs table if not exists
    await sequelize.query(`
      CREATE TABLE IF NOT EXISTS spk_rejection_logs (
        id              INT AUTO_INCREMENT PRIMARY KEY,
        spk_number      VARCHAR(30) NOT NULL,
        rejected_by     VARCHAR(20) NOT NULL,
        rejected_at     DATETIME    NOT NULL,
        rejection_reason TEXT       NOT NULL,
        rejected_level  ENUM('kasie','kadis_perawatan','kadis') NOT NULL,
        resubmitted_at  DATETIME    NULL,
        created_at      DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at      DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_spk_number (spk_number),
        INDEX idx_rejected_at (rejected_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);
    console.log('✅ spk_rejection_logs table ensured');

  } catch (e) {
    console.error('❌ Migration failed:', e.message);
    process.exit(1);
  } finally {
    await sequelize.close();
  }
}

migrate();
