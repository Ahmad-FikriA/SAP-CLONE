"use strict";

/**
 * Sequelize associations — import this ONCE at app startup (in server.js).
 * All models must be imported here so Sequelize knows about their relationships.
 */

const User = require("./User");
const Plant = require("./Plant");
// Import FunctionalLocation BEFORE Equipment because Equipment has FK to it
const FunctionalLocation = require("./FunctionalLocation");
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
const {
  GeneralTaskList,
  GeneralTaskListActivity,
} = require("./GeneralTaskList");
const EquipmentIntervalMapping = require("./EquipmentIntervalMapping");
const PreventiveWeekSchedule = require("./PreventiveWeekSchedule");
const Notification = require("./Notification");
const SpkCorrective = require("./SpkCorrective");
const { SpkCorrectiveItem, SpkCorrectivePhoto } = require("./SpkCorrectiveItem");
const PushNotification = require("./PushNotification");
const K3Report = require("./K3Report");


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

// ── SpkEquipment ↔ Equipment (for lat/lng eager-load in spkController) ────────
SpkEquipment.belongsTo(Equipment, {
  foreignKey: "equipmentId",
  as: "equipmentDetails",
  constraints: false,
});

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
  as: "lk",
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

// ── Notification (Corrective) Relations ─────────────────────────────────────
// User ||--o{ Notification (submitted by)
User.hasMany(Notification, { foreignKey: 'submittedBy', as: 'notificationsSubmitted' });
Notification.belongsTo(User, { foreignKey: 'submittedBy', as: 'submitter' });

// Kadis Pelapor ||--o{ Notification (Kadis yang melapor)
User.hasMany(Notification, { foreignKey: 'kadisPelaporId', as: 'notificationsAsReporter' });
Notification.belongsTo(User, { foreignKey: 'kadisPelaporId', as: 'kadisPelapor' });

// Equipment ||--o{ Notification
Equipment.hasMany(Notification, { foreignKey: 'equipmentId', as: 'notifications' });
Notification.belongsTo(Equipment, { foreignKey: 'equipmentId', as: 'equipment' });

// ── SPK Corrective Relations ─────────────────────────────────────────────────
// Notification ||--|| SpkCorrective (one-to-one)
Notification.hasOne(SpkCorrective, { foreignKey: 'notificationId', as: 'spkCorrective', onDelete: 'CASCADE' });
SpkCorrective.belongsTo(Notification, { foreignKey: 'notificationId', as: 'notification' });

// SpkCorrective ||--o{ SpkCorrectiveItem
SpkCorrective.hasMany(SpkCorrectiveItem, { foreignKey: 'spkId', as: 'items', onDelete: 'CASCADE' });
SpkCorrectiveItem.belongsTo(SpkCorrective, { foreignKey: 'spkId', as: 'spk' });

// SpkCorrective ||--o{ SpkCorrectivePhoto
SpkCorrective.hasMany(SpkCorrectivePhoto, { foreignKey: 'spkId', as: 'photos', onDelete: 'CASCADE' });
SpkCorrectivePhoto.belongsTo(SpkCorrective, { foreignKey: 'spkId', as: 'spk' });

// ── Supervisi Module ─────────────────────────────────────────────────────────
const SupervisiJob = require("./SupervisiJob");
const SupervisiVisit = require("./SupervisiVisit");
const SupervisiAmend = require("./SupervisiAmend");

SupervisiJob.hasMany(SupervisiVisit, {
  foreignKey: "jobId",
  as: "visits",
  onDelete: "CASCADE",
});
SupervisiVisit.belongsTo(SupervisiJob, {
  foreignKey: "jobId",
  as: "job",
});

SupervisiJob.hasMany(SupervisiAmend, {
  foreignKey: "jobId",
  as: "amends",
  onDelete: "CASCADE",
});
SupervisiAmend.belongsTo(SupervisiJob, {
  foreignKey: "jobId",
  as: "job",
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

// InspectionRequest (User → Planner)
const InspectionRequest = require("./InspectionRequest");

InspectionRequest.belongsTo(InspectionSchedule, {
  foreignKey: "scheduleId",
  as: "schedule",
  constraints: false,
});

// Reverse: InspectionSchedule → InspectionRequest (for schedules created from user requests)
InspectionSchedule.hasOne(InspectionRequest, {
  foreignKey: "scheduleId",
  as: "userRequest",
  constraints: false,
});

// InspectionFollowUp ↔ SuratPelanggaran
const SuratPelanggaran = require("./SuratPelanggaran");

InspectionFollowUp.hasMany(SuratPelanggaran, {
  foreignKey: "followUpId",
  as: "suratPelanggaran",
  onDelete: "CASCADE",
});
SuratPelanggaran.belongsTo(InspectionFollowUp, {
  foreignKey: "followUpId",
  as: "followUp",
});

// ── PushNotification ↔ User ──────────────────────────────────────────────────
PushNotification.belongsTo(User, { foreignKey: 'recipient_id', as: 'recipient' });
User.hasMany(PushNotification, { foreignKey: 'recipient_id', as: 'pushNotifications' });

// ── K3 Report ↔ User ─────────────────────────────────────────────────────────
K3Report.belongsTo(User, { foreignKey: 'dilaporkan_oleh', as: 'pelapor' });
User.hasMany(K3Report, { foreignKey: 'dilaporkan_oleh', as: 'k3Reports' });
K3Report.belongsTo(User, { foreignKey: 'ditugaskan_kepada', as: 'petugasHse' });
User.hasMany(K3Report, { foreignKey: 'ditugaskan_kepada', as: 'tugasK3Reports' });

// ── FunctionalLocation (self-referencing tree) ────────────────────────────────
FunctionalLocation.hasMany(FunctionalLocation, {
  foreignKey: "parentId",
  as: "children",
});
FunctionalLocation.belongsTo(FunctionalLocation, {
  foreignKey: "parentId",
  as: "parent",
});

// ── Equipment ↔ FunctionalLocation ───────────────────────────────────────────
// constraints: false — not all SAP funcLocIds exist in functional_locations tree,
// so we skip the DB-level FK and let Sequelize handle joins in application code.
FunctionalLocation.hasMany(Equipment, {
  foreignKey: "funcLocId",
  as: "equipment",
  constraints: false,
});
Equipment.belongsTo(FunctionalLocation, {
  foreignKey: "funcLocId",
  as: "funcLoc",
  constraints: false,
});

// ── GeneralTaskList ↔ GeneralTaskListActivity ────────────────────────────────
GeneralTaskList.hasMany(GeneralTaskListActivity, {
  foreignKey: "taskListId",
  as: "activities",
  onDelete: "CASCADE",
});
GeneralTaskListActivity.belongsTo(GeneralTaskList, {
  foreignKey: "taskListId",
  as: "taskList",
});

// ── Equipment x GeneralTaskList interval mappings ────────────────────────────
Equipment.hasMany(EquipmentIntervalMapping, { foreignKey: 'equipmentId', as: 'intervalMappings', onDelete: 'CASCADE' });
EquipmentIntervalMapping.belongsTo(Equipment, { foreignKey: 'equipmentId', as: 'equipment' });
GeneralTaskList.hasMany(EquipmentIntervalMapping, { foreignKey: 'taskListId', as: 'intervalMappings' });
EquipmentIntervalMapping.belongsTo(GeneralTaskList, { foreignKey: 'taskListId', as: 'taskList' });

module.exports = {
  User,
  Plant,
  Equipment,
  PreventiveWeekSchedule,
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
  Notification,
  SpkCorrective,
  SpkCorrectiveItem,
  SpkCorrectivePhoto,
  InspectionSchedule,
  InspectionReport,
  InspectionReportPhoto,
  InspectionFollowUp,
  InspectionRequest,
  SuratPelanggaran,
  FunctionalLocation,
  GeneralTaskList,
  GeneralTaskListActivity,
  EquipmentIntervalMapping,
  SupervisiJob,
  SupervisiVisit,
  PushNotification,
  K3Report,
  SupervisiAmend,
};
