"use strict";

const sequelize = require("./config/database");

async function ensureInspectionEnums({ shouldAuthenticate = true } = {}) {
  if (shouldAuthenticate) {
    console.log("[migrate_inspection_enums] Connecting to database...");
    await sequelize.authenticate();
    console.log("[migrate_inspection_enums] Connected.\n");
  }

  console.log("[migrate_inspection_enums] Skipping ENUM patching — status columns are now VARCHAR (STRING type).");
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
