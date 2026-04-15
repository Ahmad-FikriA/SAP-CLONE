const sequelize = require('./config/database');

async function migrate() {
  try {
    await sequelize.authenticate();
    const queryInterface = sequelize.getQueryInterface();

    // Pastikan schema sinkron dan field baru ada
    const SupervisiJob = require('./models/SupervisiJob');
    const SupervisiVisit = require('./models/SupervisiVisit');
    
    // Sinkronisasi tabel (alter: true sebisa mungkin)
    await SupervisiJob.sync({ alter: true });
    await SupervisiVisit.sync({ alter: true });

    // Drop the old unique index on supervisi_visits if it exists
    const indexes = await queryInterface.showIndex('supervisi_visits');
    // Cari index yang fields-nya cuma jobId dan visitDate
    const oldIndex = indexes.find(i => 
      i.unique && 
      i.fields.length === 2 && 
      i.fields.some(f => f.attribute === 'jobId') && 
      i.fields.some(f => f.attribute === 'visitDate')
    );

    if (oldIndex) {
      console.log('Dropping old unique index:', oldIndex.name);
      await queryInterface.removeIndex('supervisi_visits', oldIndex.name);
      console.log('Index dropped successfully.');
    } else {
      console.log('Old unique index not found, might have been dropped already or not exact match.');
    }

    console.log('Migration completed.');
    process.exit(0);
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  }
}

migrate();
