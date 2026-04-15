"use strict";

const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

/**
 * SupervisiJob — pekerjaan supervisi yang dibuat oleh Planner.
 *
 * Dinas Inspeksi wajib melakukan kunjungan SETIAP HARI selama range
 * waktuMulai–waktuBerakhir. Setiap hari dicatat di SupervisiVisit.
 */
const SupervisiJob = sequelize.define(
  "SupervisiJob",
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    namaKerja: {
      type: DataTypes.STRING(255),
      allowNull: false,
      comment: "Nama / deskripsi pekerjaan",
    },
    nomorJo: {
      type: DataTypes.STRING(50),
      allowNull: false,
      comment: "Nomor Job Order",
    },
    nilaiPekerjaan: {
      type: DataTypes.DECIMAL(20, 2),
      allowNull: true,
      comment: "Nilai kontrak pekerjaan (Rupiah)",
    },
    pelaksana: {
      type: DataTypes.STRING(255),
      allowNull: true,
      comment: "Nama vendor / kontraktor pelaksana pekerjaan",
    },
    waktuMulai: {
      type: DataTypes.DATEONLY,
      allowNull: true,
      comment: "Tanggal mulai pekerjaan",
    },
    waktuBerakhir: {
      type: DataTypes.DATEONLY,
      allowNull: true,
      comment: "Tanggal berakhir pekerjaan",
    },
    namaPengawas: {
      type: DataTypes.STRING(100),
      allowNull: true,
      comment: "Nama pengawas lapangan (field 'Supervisi' di form)",
    },
    picSupervisi: {
      type: DataTypes.STRING(100),
      allowNull: true,
      comment: "PIC supervisi dari Dinas Inspeksi",
    },
    nomorAmend: {
      type: DataTypes.STRING(100),
      allowNull: true,
      comment: "Nomor amend untuk revisi pekerjaan supervisi",
    },
    amendMulai: {
      type: DataTypes.DATEONLY,
      allowNull: true,
      comment: "Tanggal mulai amend",
    },
    amendBerakhir: {
      type: DataTypes.DATEONLY,
      allowNull: true,
      comment: "Tanggal akhir amend",
    },
    amendDocuments: {
      type: DataTypes.JSON,
      allowNull: true,
      defaultValue: [],
      comment: "Array path dokumen amend",
    },
    status: {
      type: DataTypes.ENUM("draft", "active", "completed", "cancelled"),
      allowNull: false,
      defaultValue: "draft",
    },
    latitude: {
      type: DataTypes.DECIMAL(10, 7),
      allowNull: true,
      comment: "Latitude lokasi proyek (set oleh Planner via GPS)",
    },
    longitude: {
      type: DataTypes.DECIMAL(10, 7),
      allowNull: true,
      comment: "Longitude lokasi proyek (set oleh Planner via GPS)",
    },
    radius: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: true,
      defaultValue: 100.0,
      comment: "Radius geofence kustom dari proyek",
    },
    namaArea: {
      type: DataTypes.STRING(255),
      allowNull: true,
      comment: "Nama area atau lokasi proyek",
    },
    locations: {
      type: DataTypes.JSON,
      allowNull: true,
      defaultValue: [],
      comment: "Array of locations: [{ id, namaArea, latitude, longitude, radius }]",
    },
    createdBy: {
      type: DataTypes.STRING(100),
      allowNull: false,
      comment: "Username planner pembuat",
    },
  },
  {
    tableName: "supervisi_jobs",
    timestamps: true,
  },
);

async function ensureSupervisiJobSchema() {
  const queryInterface = sequelize.getQueryInterface();
  const tableName = "supervisi_jobs";
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

  if (!table.locations) {
    await queryInterface.addColumn(tableName, "locations", {
      type: DataTypes.JSON,
      allowNull: true,
      comment: "Array of locations",
    });
  }

  if (!table.nomorAmend) {
    await queryInterface.addColumn(tableName, "nomorAmend", {
      type: DataTypes.STRING(100),
      allowNull: true,
      comment: "Nomor amend untuk revisi pekerjaan supervisi",
    });
  }

  if (!table.amendMulai) {
    await queryInterface.addColumn(tableName, "amendMulai", {
      type: DataTypes.DATEONLY,
      allowNull: true,
      comment: "Tanggal mulai amend",
    });
  }

  if (!table.amendBerakhir) {
    await queryInterface.addColumn(tableName, "amendBerakhir", {
      type: DataTypes.DATEONLY,
      allowNull: true,
      comment: "Tanggal akhir amend",
    });
  }

  if (!table.amendDocuments) {
    await queryInterface.addColumn(tableName, "amendDocuments", {
      type: DataTypes.JSON,
      allowNull: true,
      defaultValue: [],
      comment: "Array path dokumen amend",
    });
  }

  if (!table.namaArea) {
    await queryInterface.addColumn(tableName, "namaArea", {
      type: DataTypes.STRING(255),
      allowNull: true,
      comment: "Nama area atau lokasi proyek",
    });
  }

  if (!table.radius) {
    await queryInterface.addColumn(tableName, "radius", {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: true,
      defaultValue: 100.0,
      comment: "Radius geofence kustom dari proyek",
    });
  }

  await queryInterface.changeColumn(tableName, "nilaiPekerjaan", {
    type: DataTypes.DECIMAL(20, 2),
    allowNull: true,
    comment: "Nilai kontrak pekerjaan (Rupiah)",
  });
  await queryInterface.changeColumn(tableName, "pelaksana", {
    type: DataTypes.STRING(255),
    allowNull: true,
    comment: "Nama vendor / kontraktor pelaksana pekerjaan",
  });
  await queryInterface.changeColumn(tableName, "waktuMulai", {
    type: DataTypes.DATEONLY,
    allowNull: true,
    comment: "Tanggal mulai pekerjaan",
  });
  await queryInterface.changeColumn(tableName, "waktuBerakhir", {
    type: DataTypes.DATEONLY,
    allowNull: true,
    comment: "Tanggal berakhir pekerjaan",
  });
}

module.exports = SupervisiJob;
module.exports.ensureSupervisiJobSchema = ensureSupervisiJobSchema;
