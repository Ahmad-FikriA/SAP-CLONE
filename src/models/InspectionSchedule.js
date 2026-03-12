"use strict";

const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

/**
 * InspectionSchedule — jadwal inspeksi (rutin, K3, supervisi).
 *
 * Covers all three inspection flows:
 *   - 'rutin'     → Dinas Inspeksi buat jadwal sendiri
 *   - 'k3'        → Vendor request → Dinas SuperVisi jadwalkan
 *   - 'supervisi'  → User darurat / Planner request → Dinas Inspeksi jadwalkan
 */
const InspectionSchedule = sequelize.define(
  "InspectionSchedule",
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    type: {
      type: DataTypes.ENUM("rutin", "k3", "supervisi"),
      allowNull: false,
      comment: "Jenis flow inspeksi",
    },
    title: {
      type: DataTypes.STRING(255),
      allowNull: false,
      comment: "Judul / objek inspeksi",
    },
    unitKerja: {
      type: DataTypes.STRING(100),
      allowNull: true,
      comment: "Divisi / unit kerja terkait",
    },
    location: {
      type: DataTypes.STRING(255),
      allowNull: true,
      comment: "Lokasi kunjungan inspeksi",
    },
    scheduledDate: {
      type: DataTypes.DATEONLY,
      allowNull: false,
      comment: "Tanggal mulai inspeksi",
    },
    scheduledEndDate: {
      type: DataTypes.DATEONLY,
      allowNull: true,
      comment: "Tanggal akhir inspeksi (nullable)",
    },
    createdBy: {
      type: DataTypes.STRING(100),
      allowNull: false,
      comment:
        "User ID / nama pembuat jadwal (Dinas Inspeksi / Dinas SuperVisi)",
    },
    assignedTo: {
      type: DataTypes.STRING(100),
      allowNull: true,
      comment: "PIC pelaksana inspeksi",
    },
    kategoriTeknisi: {
      type: DataTypes.STRING(50),
      allowNull: true,
      comment: "Mekanik | Listrik | Sipil | Otomasi",
    },
    status: {
      type: DataTypes.ENUM(
        "scheduled",
        "in_progress",
        "completed",
        "cancelled",
      ),
      allowNull: false,
      defaultValue: "scheduled",
    },
    triggerSource: {
      type: DataTypes.ENUM("self", "vendor", "user_darurat", "planner"),
      allowNull: false,
      defaultValue: "self",
      comment: "Siapa yang memicu pembuatan jadwal",
    },
    vendorInfo: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: "Info vendor (dari WA/lisan) — khusus flow K3",
    },
    nomorPoJo: {
      type: DataTypes.STRING(50),
      allowNull: true,
      comment: "Nomor PO/JO terkait",
    },
    intervalPeriod: {
      type: DataTypes.STRING(50),
      allowNull: true,
      comment:
        "Periode berulang inspeksi rutin, e.g. '2 Minggu', '1 Bulan', '3 Bulan'",
    },
    kategoriK3: {
      type: DataTypes.ENUM("manusia", "bangunan"),
      allowNull: true,
      comment:
        "Kategori inspeksi K3: manusia (perilaku/APD) atau bangunan (struktur/fasilitas)",
    },
    darurat: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
      comment: "Flag laporan darurat (flow Supervisi)",
    },
    notes: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
  },
  {
    tableName: "inspection_schedules",
    timestamps: true,
  },
);

module.exports = InspectionSchedule;
