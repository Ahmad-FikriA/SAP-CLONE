"use strict";



const User = require("./User");
const Plant = require("./Plant");
const FunctionalLocation = require("./FunctionalLocation");
const Equipment = require("./Equipment");
const { Spk, SpkEquipment, SpkActivity } = require("./Spk");
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

const PushNotification = require("./PushNotification");
const K3Report = require("./K3Report");
const SapSpkCorrective = require("./SapSpkCorrective");


Plant.hasMany(Equipment, { foreignKey: "plantId", as: "equipment" });
Equipment.belongsTo(Plant, { foreignKey: "plantId", as: "plant" });


Spk.hasMany(SpkEquipment, {
  foreignKey: "spkNumber",
  as: "equipmentModels",
  onDelete: "CASCADE",
});
SpkEquipment.belongsTo(Spk, { foreignKey: "spkNumber", as: "spk" });


SpkEquipment.belongsTo(Equipment, {
  foreignKey: "equipmentId",
  as: "equipmentDetails",
  constraints: false,
});


Spk.hasMany(SpkActivity, {
  foreignKey: "spkNumber",
  as: "activitiesModel",
  onDelete: "CASCADE",
});
SpkActivity.belongsTo(Spk, { foreignKey: "spkNumber", as: "spk" });


Submission.belongsTo(Spk, { foreignKey: 'spkNumber', as: 'spk', constraints: false });
Spk.hasMany(Submission, { foreignKey: 'spkNumber', as: 'submissions', constraints: false });


Submission.hasMany(SubmissionPhoto, {
  foreignKey: "submissionId",
  as: "photos",
  onDelete: "CASCADE",
});
SubmissionPhoto.belongsTo(Submission, {
  foreignKey: "submissionId",
  as: "submission",
});


Submission.hasMany(SubmissionActivityResult, {
  foreignKey: "submissionId",
  as: "activityResults",
  onDelete: "CASCADE",
});
SubmissionActivityResult.belongsTo(Submission, {
  foreignKey: "submissionId",
  as: "submission",
});


CorrectiveRequest.hasMany(CorrectiveRequestImage, {
  foreignKey: "requestId",
  as: "images",
  onDelete: "CASCADE",
});
CorrectiveRequestImage.belongsTo(CorrectiveRequest, {
  foreignKey: "requestId",
  as: "request",
});



User.hasMany(Notification, { foreignKey: 'submittedBy', as: 'notificationsSubmitted' });
Notification.belongsTo(User, { foreignKey: 'submittedBy', as: 'submitter' });


User.hasMany(Notification, { foreignKey: 'kadisPelaporId', as: 'notificationsAsReporter' });
Notification.belongsTo(User, { foreignKey: 'kadisPelaporId', as: 'kadisPelapor' });


Equipment.hasMany(Notification, { foreignKey: 'equipmentId', as: 'notifications' });
Notification.belongsTo(Equipment, { foreignKey: 'equipmentId', as: 'equipment' });



SapSpkCorrective.hasOne(Notification, {
  foreignKey: "sapOrderNumber",
  sourceKey: "order_number",
  as: "notification",
  constraints: false,
});
Notification.belongsTo(SapSpkCorrective, {
  foreignKey: "sapOrderNumber",
  targetKey: "order_number",
  as: "sapSpk",
  constraints: false,
});


SapSpkCorrective.belongsTo(User, {
  foreignKey: "execution_nik",
  targetKey: "nik",
  as: "executor",
  constraints: false,
});

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


const InspectionSchedule = require("./InspectionSchedule");
const {
  InspectionReport,
  InspectionReportPhoto,
} = require("./InspectionReport");
const InspectionFollowUp = require("./InspectionFollowUp");


InspectionSchedule.hasMany(InspectionReport, {
  foreignKey: "scheduleId",
  as: "reports",
  onDelete: "CASCADE",
});
InspectionReport.belongsTo(InspectionSchedule, {
  foreignKey: "scheduleId",
  as: "schedule",
});


InspectionReport.hasMany(InspectionReportPhoto, {
  foreignKey: "reportId",
  as: "photos",
  onDelete: "CASCADE",
});
InspectionReportPhoto.belongsTo(InspectionReport, {
  foreignKey: "reportId",
  as: "report",
});


InspectionReport.hasMany(InspectionFollowUp, {
  foreignKey: "reportId",
  as: "followUps",
  onDelete: "CASCADE",
});
InspectionFollowUp.belongsTo(InspectionReport, {
  foreignKey: "reportId",
  as: "report",
});


const InspectionRequest = require("./InspectionRequest");

InspectionRequest.belongsTo(InspectionSchedule, {
  foreignKey: "scheduleId",
  as: "schedule",
  constraints: false,
});


InspectionSchedule.hasOne(InspectionRequest, {
  foreignKey: "scheduleId",
  as: "userRequest",
  constraints: false,
});


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


PushNotification.belongsTo(User, { foreignKey: 'recipient_id', as: 'recipient' });
User.hasMany(PushNotification, { foreignKey: 'recipient_id', as: 'pushNotifications' });


K3Report.belongsTo(User, { foreignKey: 'dilaporkan_oleh', as: 'pelapor' });
User.hasMany(K3Report, { foreignKey: 'dilaporkan_oleh', as: 'k3Reports' });
K3Report.belongsTo(User, { foreignKey: 'ditugaskan_kepada', as: 'petugasHse' });
User.hasMany(K3Report, { foreignKey: 'ditugaskan_kepada', as: 'tugasK3Reports' });


FunctionalLocation.hasMany(FunctionalLocation, {
  foreignKey: "parentId",
  as: "children",
});
FunctionalLocation.belongsTo(FunctionalLocation, {
  foreignKey: "parentId",
  as: "parent",
});



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


GeneralTaskList.hasMany(GeneralTaskListActivity, {
  foreignKey: "taskListId",
  as: "activities",
  onDelete: "CASCADE",
});
GeneralTaskListActivity.belongsTo(GeneralTaskList, {
  foreignKey: "taskListId",
  as: "taskList",
});


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
  Submission,
  SubmissionPhoto,
  SubmissionActivityResult,
  CorrectiveRequest,
  CorrectiveRequestImage,
  Notification,

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
  SapSpkCorrective,
};
