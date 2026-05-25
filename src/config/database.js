'use strict';

const { Sequelize } = require('sequelize');
require('dotenv').config();

if (!process.env.URI) {
  console.error('ERROR: Database URI is not defined in .env');
  process.exit(1);
}

const sequelize = new Sequelize(process.env.URI, {
  dialect: 'mysql',
  logging: false,
  pool: {
    max: 10,
    min: 0,
    acquire: 30000, // ms to wait before throwing on failed acquire
    idle: 10000,    // ms a connection can sit idle before release
  },
  dialectOptions: {
    connectTimeout: 10000,
  },
});

module.exports = sequelize;
