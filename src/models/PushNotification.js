'use strict';

const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const PushNotification = sequelize.define(
  'PushNotification',
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    module: {
      type: DataTypes.STRING(50),
      allowNull: false,
      comment: 'preventive | corrective | inspection | supervisi',
    },
    type: {
      type: DataTypes.STRING(100),
      allowNull: false,
    },
    title: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    body: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    data: {
      type: DataTypes.TEXT,
      allowNull: true,
      get() {
        const raw = this.getDataValue('data');
        if (!raw) return null;
        try { return JSON.parse(raw); } catch { return raw; }
      },
      set(val) {
        this.setDataValue('data', val ? JSON.stringify(val) : null);
      },
    },
    recipientId: {
      type: DataTypes.STRING(20),
      allowNull: false,
      field: 'recipient_id',
    },
    isRead: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
      field: 'is_read',
    },
  },
  {
    tableName: 'push_notifications',
    updatedAt: false,
  }
);

module.exports = PushNotification;
