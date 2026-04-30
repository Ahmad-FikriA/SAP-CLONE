'use strict';



require('dotenv').config();
const sequelize = require('./config/database');


const indexes = [
  
  ['idx_spk_status',         'spk',                        '(status)'],
  ['idx_spk_category',       'spk',                        '(category)'],
  ['idx_spk_scheduled_date', 'spk',                        '(scheduled_date)'],
  ['idx_spk_submitted_by',   'spk',                        '(submitted_by)'],
  ['idx_spk_status_date',    'spk',                        '(status, scheduled_date)'],

  
  ['idx_spkeq_spk_number',   'spk_equipment',              '(spk_number)'],
  ['idx_spkeq_equipment_id', 'spk_equipment',              '(equipment_id)'],

  
  ['idx_spkact_spk_number',  'spk_activities',             '(spk_number)'],
  ['idx_spkact_equip_id',    'spk_activities',             '(equipment_id)'],

  
  ['idx_sub_spk_number',     'submissions',                '(spk_number)'],
  ['idx_sub_submitted_at',   'submissions',                '(submitted_at)'],

  
  ['idx_sar_submission_id',  'submission_activity_results','(submission_id)'],

  
  ['idx_users_role',         'users',                      '(role)'],
  ['idx_users_dinas',        'users',                      '(dinas)'],
  ['idx_users_group',        'users',                      '(`group`)'],
  ['idx_users_role_dinas',   'users',                      '(role, dinas)'],
  ['idx_users_role_group',   'users',                      '(role, `group`)'],
];

async function indexExists(table, indexName) {
  const [rows] = await sequelize.query(
    `SELECT COUNT(*) AS cnt
     FROM information_schema.statistics
     WHERE table_schema = DATABASE()
       AND table_name   = :table
       AND index_name   = :indexName`,
    { replacements: { table, indexName }, type: sequelize.QueryTypes.SELECT },
  );
  return rows.cnt > 0;
}

async function run() {
  try {
    await sequelize.authenticate();
    console.log('[migrate_indexes] Connected to database.\n');

    let created = 0;
    let skipped = 0;

    for (const [name, table, cols] of indexes) {
      if (await indexExists(table, name)) {
        console.log(`  – ${name} (already exists, skipped)`);
        skipped++;
        continue;
      }
      try {
        await sequelize.query(`CREATE INDEX ${name} ON ${table} ${cols}`);
        console.log(`  ✓ ${name}`);
        created++;
      } catch (err) {
        console.error(`  ✗ ${name}: ${err.message}`);
      }
    }

    console.log(`\n[migrate_indexes] Done. Created: ${created}, Skipped: ${skipped}.`);
  } catch (err) {
    console.error('[migrate_indexes] Connection failed:', err.message);
    process.exit(1);
  } finally {
    await sequelize.close();
  }
}

run();
