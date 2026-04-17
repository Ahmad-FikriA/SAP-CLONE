"use strict";

const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

/**
 * SupervisiAmend — satu record amend (perpanjangan waktu) untuk SupervisiJob.
 *
 * Satu job bisa punya banyak amend (multi-amend).
 * Flutter client menggunakan endpoint:
 *   POST   /inspection/supervisi/jobs/:jobId/amends
 *   PUT    /inspection/supervisi/jobs/:jobId/amends/:amendId
 *   DELETE /inspection/supervisi/jobs/:jobId/amends/:amendId
 */
const SupervisiAmend = sequelize.define(
  "SupervisiAmend",
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
    nomorAmend: {
      type: DataTypes.STRING(100),
      allowNull: false,
      comment: "Nomor amend, contoh: AMD-001/SPV/2026",
    },
    amendMulai: {
      type: DataTypes.DATEONLY,
      allowNull: false,
      comment: "Tanggal mulai amend (awal perpanjangan)",
    },
    amendBerakhir: {
      type: DataTypes.DATEONLY,
      allowNull: false,
      comment: "Tanggal akhir amend (batas baru pekerjaan)",
    },
    documents: {
      type: DataTypes.JSON,
      allowNull: true,
      defaultValue: [],
      comment: "Array path file dokumen amend yang diupload",
    },
  },
  {
    tableName: "supervisi_amends",
    timestamps: true,
  },
);

module.exports = SupervisiAmend;
