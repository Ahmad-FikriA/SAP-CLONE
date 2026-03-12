"use strict";

const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

/**
 * SuratPelanggaran — surat pelanggaran K3.
 *
 * Diterbitkan otomatis ketika InspectionFollowUp melewati deadline
 * tanpa penyelesaian, atau dibuat manual oleh Dinas HSE.
 */
const SuratPelanggaran = sequelize.define(
  "SuratPelanggaran",
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    followUpId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      comment: "FK → InspectionFollowUp",
    },
    nomorSurat: {
      type: DataTypes.STRING(100),
      allowNull: false,
      comment: "Nomor surat pelanggaran (e.g. SP/K3/2026/001)",
    },
    jenisTemuan: {
      type: DataTypes.STRING(100),
      allowNull: true,
      comment: "Jenis temuan K3 (kriteria dari report)",
    },
    lokasi: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    deskripsi: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: "Deskripsi pelanggaran",
    },
    pelanggar: {
      type: DataTypes.STRING(255),
      allowNull: true,
      comment: "Nama / tim yang melanggar",
    },
    deadline: {
      type: DataTypes.DATEONLY,
      allowNull: true,
      comment: "Deadline baru setelah surat pelanggaran",
    },
    status: {
      type: DataTypes.ENUM("issued", "acknowledged", "resolved"),
      allowNull: false,
      defaultValue: "issued",
    },
    issuedBy: {
      type: DataTypes.STRING(100),
      allowNull: true,
      comment: "Siapa yang menerbitkan surat",
    },
    issuedAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    resolvedAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    notes: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
  },
  {
    tableName: "surat_pelanggaran",
    timestamps: true,
  },
);

module.exports = SuratPelanggaran;
