"use strict";

const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");


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

    kriteria: {
      type: DataTypes.STRING(100),
      allowNull: true,
      comment:
        "Kriteria K3: Kondisi Tidak Aman / Tindakan Tidak Aman / Near Miss / Cedera Ringan / Cedera Serius / Fatality",
    },
    kategoriK3: {
      type: DataTypes.STRING(20),
      allowNull: true,
      comment:
        "Kategori K3: manusia (perilaku/APD) atau bangunan (struktur/fasilitas)",
      validate: { isIn: [["manusia", "bangunan"]] },
    },
    signaturePath: {
      type: DataTypes.STRING(500),
      allowNull: true,
      comment: "Path file tanda tangan digital inspector",
    },
    status: {
      type: DataTypes.STRING(30),
      allowNull: false,
      defaultValue: "draft",
      comment: "draft | submitted | approved | rejected | revisions_required (returned for rework)",
      validate: { isIn: [["draft", "submitted", "approved", "rejected", "revisions_required"]] },
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
      comment: "Planner/Approver yang approve, reject, atau kembalikan untuk revisi",
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
