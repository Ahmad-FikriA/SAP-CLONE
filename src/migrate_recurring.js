const sequelize = require("./config/database");

async function migrate() {
  try {
    console.log("Menambahkan kolom recurring ke inspection_schedules...");

    const queries = [
      `IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'inspection_schedules' AND COLUMN_NAME = 'isRecurring')
       ALTER TABLE inspection_schedules ADD isRecurring BIT NOT NULL DEFAULT 0;`,
      `IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'inspection_schedules' AND COLUMN_NAME = 'recurringGroupId')
       ALTER TABLE inspection_schedules ADD recurringGroupId VARCHAR(100) NULL;`,
      `IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'inspection_schedules' AND COLUMN_NAME = 'recurringType')
       ALTER TABLE inspection_schedules ADD recurringType VARCHAR(50) NULL;`,
      `IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'inspection_schedules' AND COLUMN_NAME = 'recurringEndDate')
       ALTER TABLE inspection_schedules ADD recurringEndDate DATE NULL;`,
      `IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'inspection_schedules' AND COLUMN_NAME = 'recurringInstance')
       ALTER TABLE inspection_schedules ADD recurringInstance INTEGER NULL;`,
    ];

    for (const query of queries) {
      try {
        await sequelize.query(query);
        console.log(`Sukses menjalankan query.`);
      } catch (e) {
        console.log(`${e.message} (Abaikan jika column sudah ada)`);
      }
    }

    console.log("Migrasi recurring selesai.");
    process.exit(0);
  } catch (error) {
    console.error("Gagal sinkronisasi:", error);
    process.exit(1);
  }
}

migrate();
