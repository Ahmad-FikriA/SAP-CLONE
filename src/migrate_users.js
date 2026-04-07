const { execSync } = require('child_process');
const sequelize = require('./config/database');
const User = require('./models/User');

async function migrate() {
  try {
    await sequelize.authenticate();
    
    // Check if 'username' column exists using QueryInterface
    const queryInterface = sequelize.getQueryInterface();
    const tableDesc = await queryInterface.describeTable('users').catch(() => null);

    // If 'username' exists, it means it's using the old schema
    if (tableDesc && tableDesc.username) {
      console.log('⚠️ [Auto-Migration] Terdeteksi skema lama (kolom username).');
      console.log('🔄 [Auto-Migration] Merakit ulang tabel users dengan NIK...');
      await User.sync({ force: true });
      
      console.log('🔄 [Auto-Migration] Mengisi ulang data default via seeder...');
      execSync('npm run seed', { stdio: 'inherit' });
      
      console.log('✅ [Auto-Migration] Tabel users berhasil diperbarui ke NIK!');
    } else {
      console.log('ℹ️ [Auto-Migration] Tidak ada deteksi skema lama. Lanjut aman.');
    }
    
    process.exit(0);
  } catch (error) {
    console.error('❌ [Auto-Migration] Gagal:', error.message);
    process.exit(1);
  }
}

migrate();
