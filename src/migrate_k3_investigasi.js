"use strict";

require("dotenv").config();
const sequelize = require("./config/database");

async function migrate() {
  const qi = sequelize.getQueryInterface();

  console.log("Starting K3 Investigasi migration...\n");

  const newStatuses = [
    "menunggu_verifikasi_investigasi",
    "investigasi_ditolak_kadis_hse",
    "menunggu_validasi_kadiv",
    "investigasi_ditolak_kadiv",
  ];

  console.log("📝 Adding new ENUM values to status column...");
  for (const status of newStatuses) {
    try {
      await sequelize.query(
        `ALTER TABLE k3_reports MODIFY COLUMN status ENUM(
          'menunggu_review_kadiv_pelapor',
          'menunggu_review_kadiv_pphse',
          'menunggu_validasi_kadiv_pphse',
          'menunggu_validasi_kadis_hse',
          'ditolak_kadiv_pphse',
          'ditolak_kadis_hse',
          'menunggu_tindakan_hse',
          'menunggu_validasi_akhir_pphse',
          'menunggu_validasi_hasil_kadis_hse',
          'menunggu_validasi_akhir_kadiv_pphse',
          'perbaikan_ditolak_pphse',
          'perbaikan_ditolak_kadis_hse',
          'perbaikan_ditolak_kadiv_pphse',
          'disetujui',
          'ditolak',
          'selesai',
          'menunggu_verifikasi_investigasi',
          'investigasi_ditolak_kadis_hse',
          'menunggu_validasi_kadiv',
          'investigasi_ditolak_kadiv'
        ) DEFAULT 'menunggu_validasi_kadis_hse'`,
      );
      console.log(`ENUM updated with all investigasi statuses`);
      break;
    } catch (err) {
      if (err.message && err.message.includes("Duplicate")) {
        console.log(`Status '${status}' already exists, skipping.`);
      } else {
        console.error(`Error adding status '${status}':`, err.message);
      }
    }
  }

  const columnsToAdd = [
    {
      name: "investigasi_category",
      spec: { type: "VARCHAR(50)", allowNull: true, defaultValue: null },
      sql: `ALTER TABLE k3_reports ADD COLUMN investigasi_category VARCHAR(50) DEFAULT NULL`,
    },
    {
      name: "investigasi_data",
      spec: {},
      sql: `ALTER TABLE k3_reports ADD COLUMN investigasi_data JSON DEFAULT NULL`,
    },
    {
      name: "is_draft_investigasi",
      spec: {},
      sql: `ALTER TABLE k3_reports ADD COLUMN is_draft_investigasi TINYINT(1) DEFAULT 0`,
    },
    {
      name: "foto_investigasi",
      spec: {},
      sql: `ALTER TABLE k3_reports ADD COLUMN foto_investigasi JSON DEFAULT NULL`,
    },
    {
      name: "dokumen_investigasi",
      spec: {},
      sql: `ALTER TABLE k3_reports ADD COLUMN dokumen_investigasi VARCHAR(255) DEFAULT NULL`,
    },
    {
      name: "catatan_revisi_investigasi",
      spec: {},
      sql: `ALTER TABLE k3_reports ADD COLUMN catatan_revisi_investigasi TEXT DEFAULT NULL`,
    },
    {
      name: "is_approved_kadiv_pelapor",
      spec: {},
      sql: `ALTER TABLE k3_reports ADD COLUMN is_approved_kadiv_pelapor TINYINT(1) DEFAULT 0`,
    },
    {
      name: "is_approved_kadiv_pphse",
      spec: {},
      sql: `ALTER TABLE k3_reports ADD COLUMN is_approved_kadiv_pphse TINYINT(1) DEFAULT 0`,
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
          err.message.includes("already exists"))
      ) {
        console.log(`Column '${col.name}' already exists, skipping.`);
      } else {
        console.error(`Error adding column '${col.name}':`, err.message);
      }
    }
  }

  console.log("\n✅ K3 Investigasi migration complete!\n");
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
