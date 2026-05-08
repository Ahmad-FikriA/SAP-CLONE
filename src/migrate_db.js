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
        id: require("crypto").randomUUID
          ? require("crypto").randomUUID()
          : Math.random().toString(36).substring(7),
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

    console.log("Running manual schema updates...");
    execSync("node src/migrate_users.js", { stdio: "inherit" });
    execSync("node src/migrate_corrective_spk.js", { stdio: "inherit" });
    execSync("node src/migrate_k3_safety.js", { stdio: "inherit" });
    execSync("node src/migrate_inspection_enums.js", { stdio: "inherit" });

    console.log("Bulk migration completed successfully.");
    process.exit(0);
  } catch (error) {
    console.error("Migration failed:", error);
    process.exit(1);
  }
};

migrate();
