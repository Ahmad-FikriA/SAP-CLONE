"use strict";

const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");


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
      type: DataTypes.STRING(20),
      allowNull: false,
      defaultValue: "rutin",
      field: "jenis_inspeksi",
      comment: "Jenis inspeksi yang diminta",
      validate: { isIn: [["rutin", "k3"]] },
    },
    kategoriInspeksi: {
      type: DataTypes.STRING(50),
      allowNull: false,
      defaultValue: "sipil",
      field: "kategori_inspeksi",
      comment: "Kategori inspeksi berdasarkan jenis",
      validate: { isIn: [["sipil", "mekanik", "elektrik", "otomasi", "safety", "environment"]] },
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
      type: DataTypes.TEXT,
      allowNull: true,
      field: "media_paths",
      comment: "Array path foto/video opsional dari user (JSON string)",
      get() {
        const raw = this.getDataValue('mediaPaths');
        if (!raw) return [];
        try { return JSON.parse(raw); } catch { return []; }
      },
      set(val) {
        this.setDataValue('mediaPaths', val ? JSON.stringify(val) : '[]');
      },
    },
    requestedBy: {
      type: DataTypes.STRING(100),
      allowNull: false,
      field: "requested_by",
      comment: "Username user yang membuat request",
    },
    status: {
      type: DataTypes.STRING(30),
      allowNull: false,
      defaultValue: "pending",
      comment: "Status tindak lanjut oleh Planner. revisions_required = dikembalikan ke User untuk diperbaiki",
      validate: { isIn: [["pending", "approved", "rejected", "cancelled", "revisions_required"]] },
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
