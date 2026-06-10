"use strict";

require("dotenv").config();
const sequelize = require("./config/database");

async function migrate() {
  const qi = sequelize.getQueryInterface();

  console.log("Starting K3 Investigasi migration...\n");

  console.log("Skipping ENUM modification — status column is now VARCHAR (STRING type).");

  const columnsToAdd = [
    {
      name: "investigasi_category",
      sql: `IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'k3_reports' AND COLUMN_NAME = 'investigasi_category')
            ALTER TABLE k3_reports ADD investigasi_category VARCHAR(50) DEFAULT NULL`,
    },
    {
      name: "investigasi_data",
      sql: `IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'k3_reports' AND COLUMN_NAME = 'investigasi_data')
            ALTER TABLE k3_reports ADD investigasi_data NVARCHAR(MAX) DEFAULT NULL`,
    },
    {
      name: "is_draft_investigasi",
      sql: `IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'k3_reports' AND COLUMN_NAME = 'is_draft_investigasi')
            ALTER TABLE k3_reports ADD is_draft_investigasi BIT DEFAULT 0`,
    },
    {
      name: "foto_investigasi",
      sql: `IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'k3_reports' AND COLUMN_NAME = 'foto_investigasi')
            ALTER TABLE k3_reports ADD foto_investigasi NVARCHAR(MAX) DEFAULT NULL`,
    },
    {
      name: "dokumen_investigasi",
      sql: `IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'k3_reports' AND COLUMN_NAME = 'dokumen_investigasi')
            ALTER TABLE k3_reports ADD dokumen_investigasi VARCHAR(255) DEFAULT NULL`,
    },
    {
      name: "catatan_revisi_investigasi",
      sql: `IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'k3_reports' AND COLUMN_NAME = 'catatan_revisi_investigasi')
            ALTER TABLE k3_reports ADD catatan_revisi_investigasi NVARCHAR(MAX) DEFAULT NULL`,
    },
    {
      name: "is_approved_kadiv_pelapor",
      sql: `IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'k3_reports' AND COLUMN_NAME = 'is_approved_kadiv_pelapor')
            ALTER TABLE k3_reports ADD is_approved_kadiv_pelapor BIT DEFAULT 0`,
    },
    {
      name: "is_approved_kadiv_pphse",
      sql: `IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'k3_reports' AND COLUMN_NAME = 'is_approved_kadiv_pphse')
            ALTER TABLE k3_reports ADD is_approved_kadiv_pphse BIT DEFAULT 0`,
    },
  ];

  console.log("\nAdding new columns...");
  for (const col of columnsToAdd) {
    try {
      await sequelize.query(col.sql);
      console.log(`Added column: ${col.name}`);
    } catch (err) {
      if (
        err.message &&
        (err.message.includes("Duplicate column") ||
          err.message.includes("already exists") ||
          err.message.includes("Column names in each table must be unique"))
      ) {
        console.log(`Column '${col.name}' already exists, skipping.`);
      } else {
        console.error(`Error adding column '${col.name}':`, err.message);
      }
    }
  }

  console.log("\nK3 Investigasi migration complete!\n");
}

sequelize
  .authenticate()
  .then(() => {
    console.log("Database connected.");
    return migrate();
  })
  .then(() => {
    process.exit(0);
  })
  .catch((err) => {
    console.error("Migration failed:", err);
    process.exit(1);
  });
