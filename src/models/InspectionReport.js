"use strict";

const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

/**
 * InspectionReport — laporan hasil inspeksi.
 *
 * Key field: `hasKerusakan` (boolean) — decision point di flow bisnis.
 * Ketika Kepala Dinas approve dan hasKerusakan = true,
 * maka dibuat InspectionFollowUp untuk Teknisi.
 */
const InspectionReport = sequelize.define(
  "InspectionReport",
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    scheduleId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      comment: "FK → InspectionSchedule",
    },
    inspectorName: {
      type: DataTypes.STRING(100),
      allowNull: false,
      comment: "Nama inspektor (Dinas Inspeksi / Dinas SuperVisi)",
    },
    inspectionDate: {
      type: DataTypes.DATEONLY,
      allowNull: false,
    },
    location: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    tools: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: "Alat yang dipakai (JSON array of strings)",
      get() {
        const raw = this.getDataValue("tools");
        return raw ? JSON.parse(raw) : [];
      },
      set(val) {
        this.setDataValue("tools", JSON.stringify(val));
      },
    },
    findings: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: "Narasi temuan / laporan inspeksi",
    },
    hasKerusakan: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
      comment:
        "Decision point: ada kerusakan? → trigger Tindak Lanjut ke Teknisi",
    },
    kerusakanDetail: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: "Detail kerusakan (jika hasKerusakan = true)",
    },
    // K3-specific fields
    kriteria: {
      type: DataTypes.STRING(100),
      allowNull: true,
      comment:
        "Kriteria K3: Kondisi Tidak Aman / Tindakan Tidak Aman / Near Miss / Cedera Ringan / Cedera Serius / Fatality",
    },
    kategoriK3: {
      type: DataTypes.ENUM("manusia", "bangunan"),
      allowNull: true,
      comment:
        "Kategori K3: manusia (perilaku/APD) atau bangunan (struktur/fasilitas)",
    },
    signaturePath: {
      type: DataTypes.STRING(500),
      allowNull: true,
      comment: "Path file tanda tangan digital inspector",
    },
    status: {
      type: DataTypes.ENUM("draft", "submitted", "approved", "rejected"),
      allowNull: false,
      defaultValue: "draft",
    },
    submittedBy: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },
    submittedAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    approvedBy: {
      type: DataTypes.STRING(100),
      allowNull: true,
      comment: "Kepala Dinas yang approve/reject",
    },
    approvalDate: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    approvalNotes: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
  },
  {
    tableName: "inspection_reports",
    timestamps: true,
  },
);

/**
 * InspectionReportPhoto — foto lampiran laporan inspeksi.
 */
const InspectionReportPhoto = sequelize.define(
  "InspectionReportPhoto",
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    reportId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      comment: "FK → InspectionReport",
    },
    photoPath: {
      type: DataTypes.STRING(500),
      allowNull: false,
    },
    caption: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
  },
  {
    tableName: "inspection_report_photos",
    timestamps: true,
  },
);

module.exports = { InspectionReport, InspectionReportPhoto };
