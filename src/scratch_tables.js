const sequelize = require('./config/database');

async function showTables() {
  try {
    const [results, metadata] = await sequelize.query("SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_TYPE = 'BASE TABLE'");
    console.log(JSON.stringify(results, null, 2));
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

showTables();
