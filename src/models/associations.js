"use strict";

/**
 * Sequelize associations — import this ONCE at app startup (in server.js).
 * All models must be imported here so Sequelize knows about their relationships.
 */

const User = require("./User");
const Plant = require("./Plant");
const Equipment = require("./Equipment");
const { Spk, SpkEquipment, SpkActivity } = require("./Spk");
const { LembarKerja, LembarKerjaSpk } = require("./LembarKerja");
const {
  Submission,
  SubmissionPhoto,
  SubmissionActivityResult,
} = require("./Submission");
const {
  CorrectiveRequest,
  CorrectiveRequestImage,
} = require("./CorrectiveRequest");

// ── Equipment ↔ Plant ─────────────────────────────────────────────────────────
Plant.hasMany(Equipment, { foreignKey: "plantId", as: "equipment" });
Equipment.belongsTo(Plant, { foreignKey: "plantId", as: "plant" });

// ── SPK ↔ SpkEquipment ────────────────────────────────────────────────────────
Spk.hasMany(SpkEquipment, {
  foreignKey: "spkNumber",
  as: "equipmentModels",
  onDelete: "CASCADE",
});
SpkEquipment.belongsTo(Spk, { foreignKey: "spkNumber", as: "spk" });

// ── SPK ↔ SpkActivity ─────────────────────────────────────────────────────────
Spk.hasMany(SpkActivity, {
  foreignKey: "spkNumber",
  as: "activitiesModel",
  onDelete: "CASCADE",
});
SpkActivity.belongsTo(Spk, { foreignKey: "spkNumber", as: "spk" });

// ── LembarKerja ↔ LembarKerjaSpk ─────────────────────────────────────────────
LembarKerja.hasMany(LembarKerjaSpk, {
  foreignKey: "lkNumber",
  as: "spkLinks",
  onDelete: "CASCADE",
});
LembarKerjaSpk.belongsTo(LembarKerja, {
  foreignKey: "lkNumber",
  as: "lembarKerja",
});

// ── LembarKerjaSpk ↔ Spk (resolve SPK details from junction) ──────────────────
LembarKerjaSpk.belongsTo(Spk, { foreignKey: "spkNumber", as: "spk" });
Spk.hasMany(LembarKerjaSpk, { foreignKey: "spkNumber", as: "lkLinks" });

// ── Submission ↔ SubmissionPhoto ──────────────────────────────────────────────
Submission.hasMany(SubmissionPhoto, {
  foreignKey: "submissionId",
  as: "photos",
  onDelete: "CASCADE",
});
SubmissionPhoto.belongsTo(Submission, {
  foreignKey: "submissionId",
  as: "submission",
});

// ── Submission ↔ SubmissionActivityResult ─────────────────────────────────────
Submission.hasMany(SubmissionActivityResult, {
  foreignKey: "submissionId",
  as: "activityResults",
  onDelete: "CASCADE",
});
SubmissionActivityResult.belongsTo(Submission, {
  foreignKey: "submissionId",
  as: "submission",
});

// ── CorrectiveRequest ↔ CorrectiveRequestImage ───────────────────────────────
CorrectiveRequest.hasMany(CorrectiveRequestImage, {
  foreignKey: "requestId",
  as: "images",
  onDelete: "CASCADE",
});
CorrectiveRequestImage.belongsTo(CorrectiveRequest, {
  foreignKey: "requestId",
  as: "request",
});

// ── Inspection Module ─────────────────────────────────────────────────────────
const InspectionSchedule = require("./InspectionSchedule");
const {
  InspectionReport,
  InspectionReportPhoto,
} = require("./InspectionReport");
const InspectionFollowUp = require("./InspectionFollowUp");

// InspectionSchedule ↔ InspectionReport
InspectionSchedule.hasMany(InspectionReport, {
  foreignKey: "scheduleId",
  as: "reports",
  onDelete: "CASCADE",
});
InspectionReport.belongsTo(InspectionSchedule, {
  foreignKey: "scheduleId",
  as: "schedule",
});

// InspectionReport ↔ InspectionReportPhoto
InspectionReport.hasMany(InspectionReportPhoto, {
  foreignKey: "reportId",
  as: "photos",
  onDelete: "CASCADE",
});
InspectionReportPhoto.belongsTo(InspectionReport, {
  foreignKey: "reportId",
  as: "report",
});

// InspectionReport ↔ InspectionFollowUp
InspectionReport.hasMany(InspectionFollowUp, {
  foreignKey: "reportId",
  as: "followUps",
  onDelete: "CASCADE",
});
InspectionFollowUp.belongsTo(InspectionReport, {
  foreignKey: "reportId",
  as: "report",
});

module.exports = {
  User,
  Plant,
  Equipment,
  Spk,
  SpkEquipment,
  SpkActivity,
  LembarKerja,
  LembarKerjaSpk,
  Submission,
  SubmissionPhoto,
  SubmissionActivityResult,
  CorrectiveRequest,
  CorrectiveRequestImage,
  InspectionSchedule,
  InspectionReport,
  InspectionReportPhoto,
  InspectionFollowUp,
};
