"use strict";

const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");


const InspectionFollowUp = sequelize.define(
  "InspectionFollowUp",
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
    assignedTechnician: {
      type: DataTypes.STRING(100),
      allowNull: false,
      comment: "Nama / ID teknisi yang ditugaskan",
    },
    kategoriTeknisi: {
      type: DataTypes.STRING(50),
      allowNull: true,
      comment: "Mekanik | Listrik | Sipil | Otomasi",
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: false,
      comment: "Deskripsi pekerjaan tindak lanjut",
    },
    deadline: {
      type: DataTypes.DATEONLY,
      allowNull: true,
      comment: "Deadline penyelesaian",
    },
    status: {
      type: DataTypes.STRING(30),
      allowNull: false,
      defaultValue: "pending",
      validate: { isIn: [["pending", "in_progress", "waiting_approval", "approved", "rejected"]] },
    },
    feedback: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: "Feedback dari Teknisi setelah selesai",
    },
    beforePhotos: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: "Array path foto sebelum perbaikan (JSON string)",
      get() {
        const raw = this.getDataValue('beforePhotos');
        if (!raw) return null;
        try { return JSON.parse(raw); } catch { return raw; }
      },
      set(val) {
        this.setDataValue('beforePhotos', val ? JSON.stringify(val) : null);
      },
    },
    afterPhotos: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: "Array path foto sesudah perbaikan (JSON string)",
      get() {
        const raw = this.getDataValue('afterPhotos');
        if (!raw) return null;
        try { return JSON.parse(raw); } catch { return raw; }
      },
      set(val) {
        this.setDataValue('afterPhotos', val ? JSON.stringify(val) : null);
      },
    },
    completedDate: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    approvalNotes: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: "Catatan dari Kepala Dinas saat approve/reject hasil perbaikan",
    },
    assignedBy: {
      type: DataTypes.STRING(100),
      allowNull: true,
      comment: "Siapa yang assign (Kepala Dinas)",
    },
    kategoriK3: {
      type: DataTypes.STRING(20),
      allowNull: true,
      comment:
        "Kategori K3: manusia → ditangani HSE, bangunan → ditangani teknisi",
      validate: { isIn: [["manusia", "bangunan"]] },
    },
    suratPelanggaranId: {
      type: DataTypes.INTEGER,
      allowNull: true,
      comment: "FK → SuratPelanggaran (jika deadline terlewat)",
    },
  },
  {
    tableName: "inspection_follow_ups",
    timestamps: true,
  },
);

module.exports = InspectionFollowUp;
