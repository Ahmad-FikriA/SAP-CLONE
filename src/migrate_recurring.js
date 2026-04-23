const sequelize = require('./config/database');

async function migrate() {
  try {
    console.log('🔄 Menambahkan kolom recurring ke inspection_schedules...');
    
    // Add columns one by one. Use try/catch so if they exist it doesn't crash the script completely
    const queries = [
      "ALTER TABLE inspection_schedules ADD COLUMN isRecurring BOOLEAN NOT NULL DEFAULT 0;",
      "ALTER TABLE inspection_schedules ADD COLUMN recurringGroupId VARCHAR(100) NULL;",
      "ALTER TABLE inspection_schedules ADD COLUMN recurringType VARCHAR(50) NULL;",
      "ALTER TABLE inspection_schedules ADD COLUMN recurringEndDate DATE NULL;",
      "ALTER TABLE inspection_schedules ADD COLUMN recurringInstance INTEGER NULL;"
    ];

    for (const query of queries) {
      try {
        await sequelize.query(query);
        console.log(`✅ Sukses menjalankan: ${query}`);
      } catch (e) {
        console.log(`⚠️ ${e.message} (Abaikan jika column sudah ada)`);
      }
    }

    console.log('✅ Migrasi recurring selesai.');
    process.exit(0);
  } catch (error) {
    console.error('❌ Gagal sinkronisasi:', error);
    process.exit(1);
  }
}

migrate();
