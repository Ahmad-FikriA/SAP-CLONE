"use strict";

const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

const User = sequelize.define(
  "User",
  {
    id: { type: DataTypes.STRING(20), primaryKey: true },
    nik: { type: DataTypes.STRING(50), allowNull: false, unique: true },
    password: { type: DataTypes.STRING(255), allowNull: false },
    name: { type: DataTypes.STRING(100), allowNull: false },
    role: {
      type: DataTypes.STRING(50),
      allowNull: false,
      defaultValue: "teknisi",
    },
    dinas: { type: DataTypes.STRING(100), allowNull: true },
    divisi: { type: DataTypes.STRING(100), allowNull: false },
    email: { type: DataTypes.STRING(100), allowNull: true },
    group: { type: DataTypes.STRING(100), allowNull: true },
    fcmToken: {
      type: DataTypes.STRING(500),
      allowNull: true,
      field: "fcm_token",
    },
    permissions: {
      type: DataTypes.TEXT,
      allowNull: true,
      field: "allowed_pages",
      get() {
        const raw = this.getDataValue("permissions");
        if (!raw) return null;
        try {
          return JSON.parse(raw);
        } catch {
          return raw;
        }
      },
      set(val) {
        this.setDataValue("permissions", val ? JSON.stringify(val) : null);
      },
    },
  },
  {
    tableName: "users",
    underscored: true,
    indexes: [
      { fields: ["role"] },
      { fields: ["dinas"] },
      { fields: ["group"] },
      { fields: ["role", "dinas"] },
      { fields: ["role", "group"] },
    ],
  },
);

module.exports = User;
