const { execSync } = require('child_process');
const sequelize = require('./config/database');

async function migrate() {
  try {
    await sequelize.authenticate();
    
    const queryInterface = sequelize.getQueryInterface();
    const tableDesc = await queryInterface.describeTable('users').catch(() => null);

    if (!tableDesc) {
      console.log('ℹ️ [Auto-Migration] Tabel users belum ada, akan dibuat saat sync.');
      process.exit(0);
      return;
    }

    // Case 1: Old schema detected (has 'username' column)
    if (tableDesc.username) {
      console.log('⚠️ [Auto-Migration] Terdeteksi skema lama (kolom username).');
      console.log('🔄 [Auto-Migration] Merakit ulang tabel users dengan NIK...');
      
      await queryInterface.dropTable('users');
      
      const User = require('./models/User');
      await User.sync({ force: true });
      
      console.log('🔄 [Auto-Migration] Mengisi ulang data default via seeder...');
      execSync('npm run seed', { stdio: 'inherit' });
      
      console.log('✅ [Auto-Migration] Tabel users berhasil diperbarui ke NIK!');
      process.exit(0);
      return;
    }

    // Case 2: role column is ENUM (needs to become VARCHAR for flexibility)
    if (tableDesc.role && tableDesc.role.type && tableDesc.role.type.startsWith('ENUM')) {
      console.log('⚠️ [Auto-Migration] Terdeteksi kolom role bertipe ENUM, mengubah ke VARCHAR...');
      
      await queryInterface.changeColumn('users', 'role', {
        type: sequelize.constructor.DataTypes.STRING(50),
        allowNull: false,
        defaultValue: 'teknisi',
      });
      
      console.log('✅ [Auto-Migration] Kolom role berhasil diubah ke VARCHAR(50)!');
      process.exit(0);
      return;
    }

    console.log('ℹ️ [Auto-Migration] Tidak ada deteksi skema lama. Lanjut aman.');
    process.exit(0);
  } catch (error) {
    console.error('❌ [Auto-Migration] Gagal:', error.message);
    process.exit(1);
  }
}

migrate();
