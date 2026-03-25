"use strict";

const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

/**
 * InspectionRequest — permintaan kunjungan inspeksi dari role User.
 *
 * Flow:
 *   User buat request → status: 'pending'
 *   Planner review → approve → status: 'approved' + auto-create InspectionSchedule
 *   Planner review → reject  → status: 'rejected'
 */
const InspectionRequest = sequelize.define(
  "InspectionRequest",
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    judul: {
      type: DataTypes.STRING(255),
      allowNull: false,
      comment: "Judul / nama objek yang ingin diinspeksi",
    },
    lokasi: {
      type: DataTypes.STRING(255),
      allowNull: false,
      comment: "Lokasi yang ingin dikunjungi",
    },
    jenisInspeksi: {
      type: DataTypes.ENUM("rutin", "k3"),
      allowNull: false,
      defaultValue: "rutin",
      field: "jenis_inspeksi",
      comment: "Jenis inspeksi yang diminta",
    },
    tanggalDiinginkan: {
      type: DataTypes.DATEONLY,
      allowNull: true,
      field: "tanggal_diinginkan",
      comment: "Tanggal yang diinginkan user, null = secepatnya",
    },
    asapMungkin: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
      field: "asap_mungkin",
      comment: "true = user minta secepatnya, tanggalDiinginkan diabaikan",
    },
    deskripsi: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: "Deskripsi alasan / kondisi yang perlu diinspeksi",
    },
    mediaPaths: {
      type: DataTypes.JSON,
      allowNull: true,
      defaultValue: [],
      field: "media_paths",
      comment: "Array path foto/video opsional dari user",
    },
    requestedBy: {
      type: DataTypes.STRING(100),
      allowNull: false,
      field: "requested_by",
      comment: "Username user yang membuat request",
    },
    status: {
      type: DataTypes.ENUM("pending", "approved", "rejected", "cancelled"),
      allowNull: false,
      defaultValue: "pending",
      comment: "Status tindak lanjut oleh Planner",
    },
    approvedBy: {
      type: DataTypes.STRING(100),
      allowNull: true,
      field: "approved_by",
    },
    approvedAt: {
      type: DataTypes.DATE,
      allowNull: true,
      field: "approved_at",
    },
    notes: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: "Catatan dari Planner saat approve/reject",
    },
    scheduleId: {
      type: DataTypes.INTEGER,
      allowNull: true,
      field: "schedule_id",
      comment: "FK ke InspectionSchedule yang dibuat setelah approve",
    },
  },
  {
    tableName: "inspection_requests",
    underscored: true,
  },
);

module.exports = InspectionRequest;
