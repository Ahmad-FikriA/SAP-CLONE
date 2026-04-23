"use strict";

const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

/**
 * SupervisiVisit — rekaman kunjungan harian Dinas Inspeksi.
 *
 * Satu record per hari per pekerjaan.
 * - status='hadir'        → kunjungan berhasil, ada foto + keterangan
 * - status='tidak_hadir'  → tidak bisa hadir, wajib isi alasan
 *   isPelanggaran otomatis = true jika tidak_hadir
 */
const SupervisiVisit = sequelize.define(
  "SupervisiVisit",
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    jobId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      comment: "FK → SupervisiJob",
    },
    visitDate: {
      type: DataTypes.DATEONLY,
      allowNull: false,
      comment: "Tanggal kunjungan",
    },
    status: {
      type: DataTypes.ENUM("hadir", "tidak_hadir"),
      allowNull: false,
      comment: "Hadir atau tidak hadir",
    },
    keterangan: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: "Catatan / laporan kunjungan (wajib jika hadir)",
    },
    alasanTidakHadir: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: "Alasan tidak hadir (wajib jika tidak_hadir)",
    },
    photos: {
      type: DataTypes.JSON,
      allowNull: true,
      defaultValue: [],
      comment: "Array path foto / video hasil kunjungan",
    },
    documents: {
      type: DataTypes.JSON,
      allowNull: true,
      defaultValue: [],
      comment: "Array path dokumen pendukung (PDF/Word/Excel)",
    },
    submittedBy: {
      type: DataTypes.STRING(100),
      allowNull: true,
      comment: "Username Dinas Inspeksi yang submit",
    },
    submittedAt: {
      type: DataTypes.DATE,
      allowNull: true,
      comment: "Waktu submit kunjungan",
    },
    isPelanggaran: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
      comment: "true jika tidak hadir tanpa izin",
    },
    visitLatitude: {
      type: DataTypes.DECIMAL(10, 7),
      allowNull: true,
      comment: "Latitude GPS saat Dinas Inspeksi submit kunjungan",
    },
    visitLongitude: {
      type: DataTypes.DECIMAL(10, 7),
      allowNull: true,
      comment: "Longitude GPS saat Dinas Inspeksi submit kunjungan",
    },
    locationId: {
      type: DataTypes.STRING(100),
      allowNull: true,
      comment: "ID lokasi dari JSON array locations di job",
    },
    jarakDariPusat: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: true,
      comment: "Selisih jarak dalam meter ke titik pusat Geofence (0 jika di dalam radius)",
    },
  },
  {
    tableName: "supervisi_visits",
    timestamps: true,
    indexes: [
      {
        // Satu visit per hari per job per lokasi
        unique: true,
        fields: ["jobId", "visitDate", "locationId"],
      },
    ],
  },
);

async function ensureSupervisiVisitSchema() {
  const queryInterface = sequelize.getQueryInterface();
  const tableName = "supervisi_visits";
  let table = null;

  try {
    table = await queryInterface.describeTable(tableName);
  } catch (err) {
    const code = err?.original?.code || err?.parent?.code || err?.code;
    const message = String(err?.message || "");

    if (
      code === "ER_NO_SUCH_TABLE" ||
      code === "ER_BAD_TABLE_ERROR" ||
      message.includes("doesn't exist")
    ) {
      return;
    }

    throw err;
  }

  if (!table.documents) {
    await queryInterface.addColumn(tableName, "documents", {
      type: DataTypes.JSON,
      allowNull: true,
      defaultValue: [],
      comment: "Array path dokumen pendukung (PDF/Word/Excel)",
    });
  }

  if (!table.visitLatitude) {
    await queryInterface.addColumn(tableName, "visitLatitude", {
      type: DataTypes.DECIMAL(10, 7),
      allowNull: true,
      comment: "Latitude GPS saat Dinas Inspeksi submit kunjungan",
    });
  }

  if (!table.visitLongitude) {
    await queryInterface.addColumn(tableName, "visitLongitude", {
      type: DataTypes.DECIMAL(10, 7),
      allowNull: true,
      comment: "Longitude GPS saat Dinas Inspeksi submit kunjungan",
    });
  }

  if (!table.locationId) {
    await queryInterface.addColumn(tableName, "locationId", {
      type: DataTypes.STRING(100),
      allowNull: true,
      comment: "ID lokasi dari JSON array locations di job",
    });
  }

  if (!table.jarakDariPusat) {
    await queryInterface.addColumn(tableName, "jarakDariPusat", {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: true,
      comment: "Selisih jarak dalam meter ke titik pusat Geofence (0 jika di dalam radius)",
    });
  }

  await queryInterface.changeColumn(tableName, "status", {
    type: DataTypes.ENUM("hadir", "tidak_hadir"),
    allowNull: false,
    comment: "Hadir atau tidak hadir",
  });

  // ── Migrasi Unique Index untuk multi-lokasi ───────────────────────────────
  // Index lama: UNIQUE(jobId, visitDate) — hanya allow 1 visit per hari.
  // Index baru:  UNIQUE(jobId, visitDate, locationId) — allow 1 visit per hari PER LOKASI.
  // Jika index lama masih ada, hapus dulu, lalu buat yang baru.
  try {
    const [indexes] = await sequelize.query(
      `SHOW INDEX FROM \`${tableName}\` WHERE Key_name != 'PRIMARY'`
    );

    // Cari index dengan kolom (jobId, visitDate) tapi TIDAK punya locationId
    const oldIndexNames = new Set();
    const indexCols = {};
    for (const row of indexes) {
      const name = row.Key_name;
      if (!indexCols[name]) indexCols[name] = [];
      indexCols[name].push(row.Column_name);
    }
    for (const [name, cols] of Object.entries(indexCols)) {
      const hasJobId = cols.includes("jobId");
      const hasVisitDate = cols.includes("visitDate");
      const hasLocationId = cols.includes("locationId");
      // Old-style: (jobId, visitDate) saja OR (jobId, visitDate, locationId) belum ada
      if (hasJobId && hasVisitDate && !hasLocationId) {
        oldIndexNames.add(name);
      }
    }

    for (const name of oldIndexNames) {
      console.log(`[SupervisiVisit] Dropping old index: ${name}`);
      await sequelize.query(`ALTER TABLE \`${tableName}\` DROP INDEX \`${name}\``);
    }

    // Cek apakah index baru sudah ada
    const newIndexExists = Object.values(indexCols).some((cols) => {
      return (
        cols.includes("jobId") &&
        cols.includes("visitDate") &&
        cols.includes("locationId")
      );
    });

    if (!newIndexExists) {
      console.log(`[SupervisiVisit] Creating new multi-location unique index.`);
      await sequelize.query(
        `ALTER TABLE \`${tableName}\` ADD UNIQUE INDEX \`supervisi_visits_job_date_location_unique\` (\`jobId\`, \`visitDate\`, \`locationId\`)`
      );
    }
  } catch (idxErr) {
    console.warn("[SupervisiVisit] Index migration warning:", idxErr.message);
  }
}

module.exports = SupervisiVisit;
module.exports.ensureSupervisiVisitSchema = ensureSupervisiVisitSchema;
