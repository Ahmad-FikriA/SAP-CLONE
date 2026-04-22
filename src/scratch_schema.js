const sequelize = require('./config/database');

async function showSchema() {
  try {
    const [results, metadata] = await sequelize.query("DESCRIBE sap_spk_corrective;");
    console.log(JSON.stringify(results, null, 2));
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

showSchema();
