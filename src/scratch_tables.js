const sequelize = require('./config/database');

async function showTables() {
  try {
    const [results, metadata] = await sequelize.query("SHOW TABLES;");
    console.log(JSON.stringify(results, null, 2));
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

showTables();
