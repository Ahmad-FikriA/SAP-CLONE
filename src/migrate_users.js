const { execSync } = require("child_process");
const sequelize = require("./config/database");

async function migrate() {
  try {
    await sequelize.authenticate();

    const queryInterface = sequelize.getQueryInterface();
    const tableDesc = await queryInterface
      .describeTable("users")
      .catch(() => null);

    if (!tableDesc) {
      console.log(
        "[Auto-Migration] Tabel users belum ada, akan dibuat saat sync.",
      );
      process.exit(0);
      return;
    }

    if (tableDesc.username) {
      console.log(
        "[Auto-Migration] Terdeteksi skema lama (kolom username).",
      );
      console.log(
        "[Auto-Migration] Merakit ulang tabel users dengan NIK...",
      );

      const { disableForeignKeyChecks, enableForeignKeyChecks } = require("./config/sqlServerHelpers");
      await disableForeignKeyChecks();
      await queryInterface.dropTable("users");
      await enableForeignKeyChecks();

      const User = require("./models/User");
      await User.sync({ force: true });

      console.log(
        "[Auto-Migration] Mengisi ulang data default via seeder...",
      );
      execSync("npm run seed", { stdio: "inherit" });

      console.log(
        "[Auto-Migration] Tabel users berhasil diperbarui ke NIK!",
      );
      process.exit(0);
      return;
    }

    console.log("[Auto-Migration] Tidak ada deteksi skema lama. Lanjut aman.");
    process.exit(0);
  } catch (error) {
    console.error("[Auto-Migration] Gagal:", error.message);
    process.exit(1);
  }
}

migrate();
