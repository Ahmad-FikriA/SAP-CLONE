'use strict';

const sequelize = require('./config/database');
// Require associations to ensure all models are loaded
const models = require('./models/associations');
const User = require('./models/User');

const migrate = async () => {
  try {
    console.log('Connecting to the database...');
    await sequelize.authenticate();
    console.log('Connection established successfully.');

    console.log('Synchronizing database models...');
    // Sync all models (alter: true will update the schema to match models without dropping tables)
    await sequelize.sync({ alter: true });
    console.log('Database models synchronized.');

    // Check and create default admin user
    let admin = await User.findOne({ where: { nik: 'admin' } });
    if (!admin) {
      console.log('Creating default admin user...');
      admin = await User.create({
        id: require('crypto').randomUUID ? require('crypto').randomUUID() : Math.random().toString(36).substring(7),
        nik: 'admin',
        password: 'admin',
        name: 'Super Admin',
        role: 'admin',
        email: 'admin@example.com',
        dinas: 'Admin',
        divisi: 'Admin',
        group: 'Admin',
      });
      console.log('Admin user created successfully. (NIK: admin, Password: admin)');
    } else {
      console.log('Admin user already exists.');
    }

    console.log('Bulk migration completed successfully.');
    process.exit(0);
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  }
};

migrate();
