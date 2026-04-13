'use strict';

const sequelize = require('./config/database');

async function migrateCorrective() {
  console.log('Starting Corrective Maintenance Schema Migration...');

  try {
    await sequelize.authenticate();
    console.log('Connected to Database via Sequelize.');
    const qi = sequelize.getQueryInterface();

    // 1. ALTER TABLE notifications
    console.log('Migrating table: notifications...');
    
    // Add approval_status if it doesn't exist
    try {
      await qi.addColumn('notifications', 'approval_status', {
        type: sequelize.constructor.DataTypes.ENUM('pending', 'menunggu_review_awal_kadis_pp', 'ditolak_kadis_pp_awal', 'approved', 'rejected', 'spk_masuk', 'spk_issued', 'eksekusi', 'menunggu_review_kadis_pp', 'menunggu_review_kadis_pelapor'),
        defaultValue: 'pending',
      });
      console.log(' -> Added approval_status column to notifications.');
    } catch (err) {
      if (err.message && err.message.includes('Duplicate')) {
        await qi.changeColumn('notifications', 'approval_status', {
          type: sequelize.constructor.DataTypes.ENUM('pending', 'menunggu_review_awal_kadis_pp', 'ditolak_kadis_pp_awal', 'approved', 'rejected', 'spk_masuk', 'spk_issued', 'eksekusi', 'menunggu_review_kadis_pp', 'menunggu_review_kadis_pelapor'),
          defaultValue: 'pending',
        });
        console.log(' -> Modified approval_status column on notifications.');
      } else {
        console.log(' -> Exception during approval_status column change (maybe already fine):', err.message);
      }
    }

    // Modify status enum
    try {
      await qi.changeColumn('notifications', 'status', {
          type: sequelize.constructor.DataTypes.ENUM('draft', 'submitted', 'menunggu_review_awal_kadis_pp', 'approved', 'ditolak_kadis_pp_awal', 'spk_created', 'closed'),
          allowNull: false,
          defaultValue: 'draft',
      });
      console.log(' -> Modified status ENUM on notifications.');
    } catch (e) {
      console.log(' -> Error updating notifications status: ', e.message);
    }

    // 2. ALTER TABLE spk_corrective
    console.log('Migrating table: spk_corrective...');
    
    // Drop kasie columns if they exist
    try {
      await qi.removeColumn('spk_corrective', 'kasie_approved_by');
      console.log(' -> Dropped kasie_approved_by column.');
    } catch (err) {
       // Ignore if not exist
    }

    try {
      await qi.removeColumn('spk_corrective', 'kasie_approved_at');
      console.log(' -> Dropped kasie_approved_at column.');
    } catch (err) {
       // Ignore if not exist
    }

    // Modify status enum
    try {
      await sequelize.query(`UPDATE spk_corrective SET status = 'awaiting_kadis_pusat' WHERE status = 'awaiting_kasie'`);
      console.log(' -> Migrated underlying data for awaiting_kasie -> awaiting_kadis_pusat');

      await qi.changeColumn('spk_corrective', 'status', {
        type: sequelize.constructor.DataTypes.ENUM('draft', 'in_progress', 'awaiting_kadis_pusat', 'awaiting_kadis_pelapor', 'completed', 'rejected'),
        allowNull: false,
        defaultValue: 'draft',
      });
      console.log(' -> Modified status ENUM on spk_corrective.');
    } catch (e) {
       console.log(' -> Error updating spk_corrective status: ', e.message);
    }

    console.log('Corrective Schema Migration completed successfully.');
    process.exit(0);
  } catch (err) {
    console.error('Migration failed:', err);
    process.exit(1);
  }
}

migrateCorrective();
