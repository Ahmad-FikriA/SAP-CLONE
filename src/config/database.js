'use strict';

const { Sequelize } = require('sequelize');
require('dotenv').config();

// Mencegah error format datetime di SQL Server dengan menghapus timezone offset (+07:00 dll)
Sequelize.DATE.prototype._stringify = function _stringify(date, options) {
  date = this._applyTimezone(date, options);
  return date.format('YYYY-MM-DD HH:mm:ss.SSS');
};

if (!process.env.URI) {
  console.error('ERROR: Database URI is not defined in .env');
  process.exit(1);
}

const sequelize = new Sequelize(process.env.URI, {
  dialect: 'mssql',
  logging: false,
  dialectOptions: {
    options: {
      encrypt: false,
      trustServerCertificate: true
    }
  }
});

module.exports = sequelize;
