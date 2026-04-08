#!/bin/sh

# Generate host keys if they don't exist
ssh-keygen -A

# Start SSH daemon in the background
/usr/sbin/sshd

# Install or update dependencies in case package.json changed
npm install

# Seed preventive tables (plants, equipment, SPK, LK) with corrected data
node src/preventive_seed.js
# ── One-time migration: add `group` column to users table ──────────────────
MIGRATION_MARKER="/app/data/.migrated_add_group"
if [ ! -f "$MIGRATION_MARKER" ]; then
  echo "[migration] Adding 'group' column to users table..."
  node -e "
    require('dotenv').config();
    const seq = require('./src/config/database');
    (async () => {
      try {
        await seq.authenticate();
        const [rows] = await seq.query(
          \"SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND COLUMN_NAME = 'group'\"
        );
        if (rows.length === 0) {
          await seq.query('ALTER TABLE users ADD COLUMN \`group\` VARCHAR(100) DEFAULT NULL');
          console.log('[migration] ✓ Column added successfully');
        } else {
          console.log('[migration] ✓ Column already exists, skipping');
        }
        process.exit(0);
      } catch (e) {
        console.error('[migration] ✗ Failed:', e.message);
        process.exit(1);
      }
    })();
  "
  if [ $? -eq 0 ]; then
    touch "$MIGRATION_MARKER"
    echo "[migration] ✓ Migration marker created — will not run again."
  fi
fi

# Start the Node.js application in development mode (nodemon) so it auto-restarts on code changes
exec npm run dev
