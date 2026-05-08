'use strict';

const { Sequelize } = require('sequelize');
require('dotenv').config();

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
