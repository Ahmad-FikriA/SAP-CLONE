"use strict";

const sequelize = require("./config/database");

async function ensureInspectionEnums({ shouldAuthenticate = true } = {}) {
  if (shouldAuthenticate) {
    console.log("[migrate_inspection_enums] Connecting to database...");
    await sequelize.authenticate();
    console.log("[migrate_inspection_enums] Connected.\n");
  }

  try {
    console.log("[1/2] Patching inspection_requests.status ENUM...");
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
    console.log("inspection_requests.status patched.\n");
  } catch (err) {
    console.error("Failed:", err.message, "\n");
  }

  try {
    console.log("[2/2] Patching inspection_reports.status ENUM...");
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
    console.log("inspection_reports.status patched.\n");
  } catch (err) {
    console.error("Failed:", err.message, "\n");
  }

  console.log(
    "[migrate_inspection_enums] Done. You can now delete this script if desired.",
  );
}

async function run() {
  await ensureInspectionEnums();
  await sequelize.close();
  process.exit(0);
}

if (require.main === module) {
  run().catch((err) => {
    console.error("[migrate_inspection_enums] Fatal error:", err);
    process.exit(1);
  });
}

module.exports = { ensureInspectionEnums };
