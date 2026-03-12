'use strict';

/**
 * Sequelize associations — import this ONCE at app startup (in server.js).
 * All models must be imported here so Sequelize knows about their relationships.
 */

const User        = require('./User');
const Plant       = require('./Plant');
const Equipment   = require('./Equipment');
const { Spk, SpkEquipment, SpkActivity }               = require('./Spk');
const { LembarKerja, LembarKerjaSpk }                  = require('./LembarKerja');
const { Submission, SubmissionPhoto, SubmissionActivityResult } = require('./Submission');
const { CorrectiveRequest, CorrectiveRequestImage } = require('./CorrectiveRequest');
const Notification = require('./Notification');
const SpkCorrective = require('./SpkCorrective');
const { SpkCorrectiveItem, SpkCorrectivePhoto } = require('./SpkCorrectiveItem');

// ── Equipment ↔ Plant ─────────────────────────────────────────────────────────
Plant.hasMany(Equipment, { foreignKey: 'plantId', as: 'equipment' });
Equipment.belongsTo(Plant, { foreignKey: 'plantId', as: 'plant' });

// ── SPK ↔ SpkEquipment ────────────────────────────────────────────────────────
Spk.hasMany(SpkEquipment, { foreignKey: 'spkNumber', as: 'equipmentModels', onDelete: 'CASCADE' });
SpkEquipment.belongsTo(Spk, { foreignKey: 'spkNumber', as: 'spk' });

// ── SPK ↔ SpkActivity ─────────────────────────────────────────────────────────
Spk.hasMany(SpkActivity, { foreignKey: 'spkNumber', as: 'activitiesModel', onDelete: 'CASCADE' });
SpkActivity.belongsTo(Spk, { foreignKey: 'spkNumber', as: 'spk' });

// ── LembarKerja ↔ LembarKerjaSpk ─────────────────────────────────────────────
LembarKerja.hasMany(LembarKerjaSpk, { foreignKey: 'lkNumber', as: 'spkLinks', onDelete: 'CASCADE' });
LembarKerjaSpk.belongsTo(LembarKerja, { foreignKey: 'lkNumber', as: 'lembarKerja' });

// ── LembarKerjaSpk ↔ Spk (resolve SPK details from junction) ──────────────────
LembarKerjaSpk.belongsTo(Spk, { foreignKey: 'spkNumber', as: 'spk' });
Spk.hasMany(LembarKerjaSpk, { foreignKey: 'spkNumber', as: 'lkLinks' });

// ── Submission ↔ SubmissionPhoto ──────────────────────────────────────────────
Submission.hasMany(SubmissionPhoto, { foreignKey: 'submissionId', as: 'photos', onDelete: 'CASCADE' });
SubmissionPhoto.belongsTo(Submission, { foreignKey: 'submissionId', as: 'submission' });

// ── Submission ↔ SubmissionActivityResult ─────────────────────────────────────
Submission.hasMany(SubmissionActivityResult, { foreignKey: 'submissionId', as: 'activityResults', onDelete: 'CASCADE' });
SubmissionActivityResult.belongsTo(Submission, { foreignKey: 'submissionId', as: 'submission' });

// ── CorrectiveRequest ↔ CorrectiveRequestImage ───────────────────────────────
CorrectiveRequest.hasMany(CorrectiveRequestImage, { foreignKey: 'requestId', as: 'images', onDelete: 'CASCADE' });
CorrectiveRequestImage.belongsTo(CorrectiveRequest, { foreignKey: 'requestId', as: 'request' });

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

module.exports = {
  User, Plant, Equipment,
  Spk, SpkEquipment, SpkActivity,
  LembarKerja, LembarKerjaSpk,
  Submission, SubmissionPhoto, SubmissionActivityResult,
  CorrectiveRequest, CorrectiveRequestImage,
  Notification, SpkCorrective, SpkCorrectiveItem, SpkCorrectivePhoto,
};
