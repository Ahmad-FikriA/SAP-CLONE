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
      type: DataTypes.DECIMAL(15, 2),
      allowNull: true,
      comment: "Nilai kontrak pekerjaan (Rupiah)",
    },
    pelaksana: {
      type: DataTypes.STRING(255),
      allowNull: false,
      comment: "Nama vendor / kontraktor pelaksana pekerjaan",
    },
    waktuMulai: {
      type: DataTypes.DATEONLY,
      allowNull: false,
      comment: "Tanggal mulai pekerjaan",
    },
    waktuBerakhir: {
      type: DataTypes.DATEONLY,
      allowNull: false,
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
    status: {
      type: DataTypes.ENUM("active", "completed", "cancelled"),
      allowNull: false,
      defaultValue: "active",
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

module.exports = SupervisiJob;
