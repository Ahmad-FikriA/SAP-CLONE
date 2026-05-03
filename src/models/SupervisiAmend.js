"use strict";

const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");


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
      type: DataTypes.TEXT,
      allowNull: true,
      comment: "Array path file dokumen amend yang diupload (JSON string)",
      get() {
        const raw = this.getDataValue('documents');
        if (!raw) return [];
        try { return JSON.parse(raw); } catch { return []; }
      },
      set(val) {
        this.setDataValue('documents', val ? JSON.stringify(val) : '[]');
      },
    },
  },
  {
    tableName: "supervisi_amends",
    timestamps: true,
  },
);

module.exports = SupervisiAmend;
