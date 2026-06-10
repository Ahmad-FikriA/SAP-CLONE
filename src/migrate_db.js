"use strict";

const sequelize = require("./config/database");
const models = require("./models/associations");
const User = require("./models/User");
const { execSync } = require("child_process");

const migrate = async () => {
  try {
    console.log("Connecting to the database...");
    await sequelize.authenticate();
    console.log("Connection established successfully.");

    console.log("Synchronizing database models...");
    await sequelize.sync();
    console.log("Database models synchronized.");

    let admin = await User.findOne({ where: { nik: "999999" } });
    if (!admin) {
      console.log("Creating default admin user...");
      admin = await User.create({
        id: "ADMIN-" + Date.now().toString().slice(-10),
        nik: "999999",
        password: "password123",
        name: "Super Admin",
        role: "admin",
        email: "admin@example.com",
        dinas: "Admin",
        divisi: "Admin",
        group: "Admin",
      });
      console.log(
        "Admin user created successfully. (NIK: admin, Password: admin)",
      );
    } else {
      console.log("Admin user already exists.");
    }

    console.log("\nRunning manual schema updates...\n");

    const migrations = [
      "src/migrate_users.js",
      "src/migrate_corrective_spk.js",
      "src/migrate_k3_safety.js",
      "src/migrate_inspection_enums.js",
      "src/migrate_extra_categories.js",
      "src/migrate_inspection_attachments.js",
      "src/migrate_k3_investigasi.js",
      "src/migrate_kadis_area.js",
      "src/migrate_recurring.js",
      "src/migrate_rejection.js",
      "src/migrate_spk_source.js",
      "src/migrate_indexes.js",
    ];

    for (const script of migrations) {
      try {
        console.log(`Running: ${script}`);
        execSync(`node ${script}`, { stdio: "inherit" });
        console.log(`Done: ${script}\n`);
      } catch (err) {
        console.error(`Warning: ${script} exited with error (continuing...)\n`);
      }
    }

    console.log("Bulk migration completed successfully.");
    process.exit(0);
  } catch (error) {
    console.error("Migration failed:", error);
    process.exit(1);
  }
};

migrate();
