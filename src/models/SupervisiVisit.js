"use strict";

const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");
const { isTableNotFoundError } = require("../config/sqlServerHelpers");


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
      type: DataTypes.STRING(20),
      allowNull: false,
      comment: "Hadir atau tidak hadir",
      validate: { isIn: [["hadir", "tidak_hadir"]] },
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
      type: DataTypes.TEXT,
      allowNull: true,
      comment: "Array path foto / video hasil kunjungan (JSON string)",
      get() {
        const raw = this.getDataValue('photos');
        if (!raw) return [];
        try { return JSON.parse(raw); } catch { return []; }
      },
      set(val) {
        this.setDataValue('photos', val ? JSON.stringify(val) : '[]');
      },
    },
    documents: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: "Array path dokumen pendukung (PDF/Word/Excel) (JSON string)",
      get() {
        const raw = this.getDataValue('documents');
        if (!raw) return [];
        try { return JSON.parse(raw); } catch { return []; }
      },
      set(val) {
        this.setDataValue('documents', val ? JSON.stringify(val) : '[]');
      },
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
    isDraft: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
      comment: "true = disimpan sebagai draft (belum final). Draft yang melewati hari akan dikonversi ke tidak_hadir.",
    },
  },
  {
    tableName: "supervisi_visits",
    timestamps: true,
    indexes: [
      {
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
    if (isTableNotFoundError(err)) {
      return;
    }
    throw err;
  }

  if (!table.documents) {
    await queryInterface.addColumn(tableName, "documents", {
      type: DataTypes.TEXT,
      allowNull: true,
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

  if (!table.isDraft) {
    await queryInterface.addColumn(tableName, "isDraft", {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
      comment: "true = disimpan sebagai draft (belum final). Draft yang melewati hari akan dikonversi ke tidak_hadir.",
    });
  }

  try {
    const [indexes] = await sequelize.query(
      `SELECT i.name AS index_name, c.name AS column_name
       FROM sys.indexes i
       INNER JOIN sys.index_columns ic ON i.object_id = ic.object_id AND i.index_id = ic.index_id
       INNER JOIN sys.columns c ON ic.object_id = c.object_id AND ic.column_id = c.column_id
       WHERE i.object_id = OBJECT_ID('${tableName}') AND i.name != 'PK__supervisi_visits'`
    );

    const indexCols = {};
    for (const row of indexes) {
      const name = row.index_name;
      if (!indexCols[name]) indexCols[name] = [];
      indexCols[name].push(row.column_name);
    }

    const oldIndexNames = new Set();
    for (const [name, cols] of Object.entries(indexCols)) {
      const hasJobId = cols.includes("jobId");
      const hasVisitDate = cols.includes("visitDate");
      const hasLocationId = cols.includes("locationId");

      if (hasJobId && hasVisitDate && !hasLocationId) {
        oldIndexNames.add(name);
      }
    }

    for (const name of oldIndexNames) {
      console.log(`[SupervisiVisit] Dropping old index: ${name}`);
      await sequelize.query(`DROP INDEX [${name}] ON [${tableName}]`);
    }

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
        `CREATE UNIQUE INDEX [supervisi_visits_job_date_location_unique] ON [${tableName}] ([jobId], [visitDate], [locationId])`
      );
    }
  } catch (idxErr) {
    console.warn("[SupervisiVisit] Index migration warning:", idxErr.message);
  }
}

module.exports = SupervisiVisit;
module.exports.ensureSupervisiVisitSchema = ensureSupervisiVisitSchema;
