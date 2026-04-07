const sequelize = require('./config/database');
const User = require('./models/User');
const { execSync } = require('child_process');

async function migrateUser() {
  try {
    const qi = sequelize.getQueryInterface();
    const tableDesc = await qi.describeTable('users').catch(() => null);
    
    if (tableDesc && tableDesc.username) {
      console.log('🔄 [Auto-Migration] Deteksi skema lama pada tabel users (kolom username).');
      console.log('🔄 [Auto-Migration] Menghapus tabel users untuk transisi ke skema NIK...');
      
      // Matikan foreign key sementara
      await sequelize.query('SET FOREIGN_KEY_CHECKS = 0');
      await User.drop();
      await sequelize.query('SET FOREIGN_KEY_CHECKS = 1');
      
      console.log('🔄 [Auto-Migration] Merakit ulang tabel users dengan NIK...');
      await User.sync({ force: true });
      
      console.log('🔄 [Auto-Migration] Mengisi ulang data default via seeder...');
      execSync('npm run seed', { stdio: 'inherit' });
      
      console.log('✅ [Auto-Migration] Proses reset User Schema selesai!');
    } else {
      console.log('ℹ️ [Auto-Migration] Tidak ada deteksi skema lama. Lanjut aman.');
    }
  } catch (error) {
    console.error('❌ [Auto-Migration] Gagal melakukan migrasi:', error.message);
  } finally {
    await sequelize.close();
  }
}

migrateUser();
