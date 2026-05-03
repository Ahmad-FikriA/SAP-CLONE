"use strict";

const sequelize = require("./config/database");
const { disableForeignKeyChecks, enableForeignKeyChecks } = require("./config/sqlServerHelpers");
const {
  SuratPelanggaran,
  InspectionFollowUp,
  InspectionReportPhoto,
  InspectionReport,
  InspectionRequest,
  InspectionSchedule,
  SupervisiVisit,
  SupervisiAmend,
  SupervisiJob,
} = require("./models/associations");

async function clearData() {
  try {
    await sequelize.authenticate();
    console.log("[OK] Database connected.");

    await disableForeignKeyChecks();
    console.log("[OK] Disabled foreign key checks.");

    console.log("--- Clearing Inspection Data ---");
    await SuratPelanggaran.destroy({ where: {}, force: true });
    console.log("Cleared SuratPelanggaran");

    await InspectionFollowUp.destroy({ where: {}, force: true });
    console.log("Cleared InspectionFollowUp");

    await InspectionReportPhoto.destroy({ where: {}, force: true });
    console.log("Cleared InspectionReportPhoto");

    await InspectionReport.destroy({ where: {}, force: true });
    console.log("Cleared InspectionReport");

    await InspectionRequest.destroy({ where: {}, force: true });
    console.log("Cleared InspectionRequest");

    await InspectionSchedule.destroy({ where: {}, force: true });
    console.log("Cleared InspectionSchedule");

    console.log("--- Clearing Supervisi Data ---");
    await SupervisiVisit.destroy({ where: {}, force: true });
    console.log("Cleared SupervisiVisit");

    await SupervisiAmend.destroy({ where: {}, force: true });
    console.log("Cleared SupervisiAmend");

    await SupervisiJob.destroy({ where: {}, force: true });
    console.log("Cleared SupervisiJob");

    await enableForeignKeyChecks();
    console.log("[OK] Re-enabled foreign key checks.");

    console.log("===================================================");
    console.log("SUCCESS: All Inspection & Supervisi data has been wiped.");
    console.log("===================================================");
    process.exit(0);
  } catch (error) {
    console.error("ERROR during data deletion:", error);
    process.exit(1);
  }
}

clearData();
