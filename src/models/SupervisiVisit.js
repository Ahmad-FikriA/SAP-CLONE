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
  },
  {
    tableName: "supervisi_visits",
    timestamps: true,
    indexes: [
      {
        // Satu visit per hari per job
        unique: true,
        fields: ["jobId", "visitDate"],
      },
    ],
  },
);

module.exports = SupervisiVisit;
