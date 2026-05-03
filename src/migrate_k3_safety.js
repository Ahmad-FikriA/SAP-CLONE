'use strict';

const sequelize = require('./config/database');

async function migrateK3() {
  console.log('Starting K3 Safety Schema Migration...');

  try {
    await sequelize.authenticate();
    console.log('Connected to Database via Sequelize.');
    const qi = sequelize.getQueryInterface();

    console.log('Migrating table: k3_reports...');
    
    try {
      await qi.addColumn('k3_reports', 'tindakan_perbaikan', {
         type: sequelize.constructor.DataTypes.TEXT,
         allowNull: true,
      });
      console.log(' -> Added tindakan_perbaikan column.');
    } catch(e) {}

    try {
      await qi.addColumn('k3_reports', 'foto_perbaikan', {
         type: sequelize.constructor.DataTypes.TEXT,
         allowNull: true,
      });
      console.log(' -> Added foto_perbaikan column.');
    } catch(e) {}

    try {
      await qi.addColumn('k3_reports', 'catatan_revisi_perbaikan', {
         type: sequelize.constructor.DataTypes.TEXT,
         allowNull: true,
      });
      console.log(' -> Added catatan_revisi_perbaikan column.');
    } catch(e) {}

    console.log(' -> Skipping ENUM status modification (now using STRING type).');

    console.log('K3 Safety Schema Migration completed successfully.');
    process.exit(0);
  } catch (err) {
    console.error('Migration failed:', err);
    process.exit(1);
  }
}

migrateK3();
