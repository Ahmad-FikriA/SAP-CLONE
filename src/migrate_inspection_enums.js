/**
 * migrate_inspection_enums.js
 *
 * Memastikan kolom `status` di `inspection_requests` dan `inspection_reports`
 * memiliki definisi ENUM yang lengkap termasuk `revisions_required`.
 *
 * Root cause bug: Model Sequelize sudah menambahkan 'revisions_required'
 * namun DDL MySQL belum di-ALTER, sehingga terjadi:
 *   Data truncated for column 'status' at row 1
 *
 * Cara jalankan (sekali saja):
 *   node src/migrate_inspection_enums.js
 */

'use strict';

const sequelize = require('./config/database');

async function run() {
  const queryInterface = sequelize.getQueryInterface();

  console.log('[migrate_inspection_enums] Connecting to database...');
  await sequelize.authenticate();
  console.log('[migrate_inspection_enums] Connected.\n');

  // ── inspection_requests.status ──────────────────────────────────────────────
  try {
    console.log('[1/2] Patching inspection_requests.status ENUM...');
    await sequelize.query(`
      ALTER TABLE inspection_requests
      MODIFY COLUMN status ENUM(
        'pending',
        'approved',
        'rejected',
        'cancelled',
        'revisions_required'
      ) NOT NULL DEFAULT 'pending';
    `);
    console.log('      ✅ inspection_requests.status patched.\n');
  } catch (err) {
    console.error('      ❌ Failed:', err.message, '\n');
  }

  // ── inspection_reports.status ───────────────────────────────────────────────
  try {
    console.log('[2/2] Patching inspection_reports.status ENUM...');
    await sequelize.query(`
      ALTER TABLE inspection_reports
      MODIFY COLUMN status ENUM(
        'draft',
        'submitted',
        'approved',
        'rejected',
        'revisions_required'
      ) NOT NULL DEFAULT 'draft';
    `);
    console.log('      ✅ inspection_reports.status patched.\n');
  } catch (err) {
    console.error('      ❌ Failed:', err.message, '\n');
  }

  console.log('[migrate_inspection_enums] Done. You can now delete this script if desired.');
  await sequelize.close();
  process.exit(0);
}

run().catch((err) => {
  console.error('[migrate_inspection_enums] Fatal error:', err);
  process.exit(1);
});
