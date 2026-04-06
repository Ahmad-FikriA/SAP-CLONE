'use strict';

/**
 * backup_coords.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Dumps every equipment row that has latitude/longitude/polygonFeatureName set
 * into  data/coords_backup.json
 *
 * Run BEFORE npm run seed:preventive to preserve your scanned coordinates.
 *   npm run backup:coords
 *
 * The seed will automatically read this file and restore the coords afterwards.
 */

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const sequelize = require('./config/database');
const Equipment = require('./models/Equipment');

const OUTPUT_PATH = path.join(__dirname, '..', 'data', 'coords_backup.json');

async function main() {
  await sequelize.authenticate();
  console.log('\n  KTI SmartCare — Coordinate Backup\n');

  const rows = await Equipment.findAll({
    where: sequelize.literal(
      'latitude IS NOT NULL OR longitude IS NOT NULL OR polygon_feature_name IS NOT NULL'
    ),
    attributes: ['equipmentId', 'latitude', 'longitude', 'polygonFeatureName'],
  });

  if (rows.length === 0) {
    console.log('  ⚠  No coordinates found in DB — nothing to back up.\n');
    process.exit(0);
  }

  const backup = rows.map(r => ({
    equipmentId: r.equipmentId,
    latitude: r.latitude !== null ? parseFloat(r.latitude) : null,
    longitude: r.longitude !== null ? parseFloat(r.longitude) : null,
    polygonFeatureName: r.polygonFeatureName || null,
  }));

  fs.writeFileSync(OUTPUT_PATH, JSON.stringify(backup, null, 2), 'utf8');

  console.log(`  ✓  Backed up ${backup.length} equipment coordinate(s)`);
  console.log(`  ✓  Saved → ${OUTPUT_PATH}\n`);
  console.log('  You can now safely run:  npm run seed:preventive\n');
}

main()
  .then(() => process.exit(0))
  .catch(err => { console.error(err); process.exit(1); });
