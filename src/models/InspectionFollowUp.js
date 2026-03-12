"use strict";

const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

/**
 * InspectionFollowUp — tindak lanjut kerusakan oleh Teknisi.
 *
 * Dibuat otomatis ketika Kepala Dinas approve laporan
 * yang memiliki hasKerusakan = true.
 * Teknisi menerima perintah, mengerjakan, dan memberikan feedback.
 */
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
      type: DataTypes.ENUM(
        "pending",
        "in_progress",
        "waiting_approval",
        "approved",
        "rejected",
      ),
      allowNull: false,
      defaultValue: "pending",
    },
    feedback: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: "Feedback dari Teknisi setelah selesai",
    },
    beforePhotos: {
      type: DataTypes.JSON,
      allowNull: true,
      comment: "Array path foto sebelum perbaikan",
    },
    afterPhotos: {
      type: DataTypes.JSON,
      allowNull: true,
      comment: "Array path foto sesudah perbaikan",
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
      type: DataTypes.ENUM("manusia", "bangunan"),
      allowNull: true,
      comment:
        "Kategori K3: manusia → ditangani HSE, bangunan → ditangani teknisi",
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
