'use strict';

const sequelize = require('../../config/database');
const {
  disableForeignKeyChecks,
  enableForeignKeyChecks,
} = require('../../config/sqlServerHelpers');
const {
  SuratPelanggaran,
  InspectionFollowUp,
  InspectionReportPhoto,
  InspectionReport,
  InspectionRequest,
  InspectionSchedule,
  SupervisiVisit,
  SupervisiAmend,
  SupervisiJob
} = require('../../models/associations');

async function clearInspectionSupervisiData(req, res) {
  try {

    if (!req.user || req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Akses Ditolak: Hanya Admin yang dapat melakukan aksi ini.'
      });
    }

    await disableForeignKeyChecks();

    await SuratPelanggaran.destroy({ where: {}, force: true });
    await InspectionFollowUp.destroy({ where: {}, force: true });
    await InspectionReportPhoto.destroy({ where: {}, force: true });
    await InspectionReport.destroy({ where: {}, force: true });
    await InspectionRequest.destroy({ where: {}, force: true });
    await InspectionSchedule.destroy({ where: {}, force: true });

    await SupervisiVisit.destroy({ where: {}, force: true });
    await SupervisiAmend.destroy({ where: {}, force: true });
    await SupervisiJob.destroy({ where: {}, force: true });

    await enableForeignKeyChecks();

    res.json({
      success: true,
      message: 'Semua data percobaan Inspeksi dan Supervisi berhasil dihapus.'
    });

  } catch (error) {
    console.error('Error clearing dummy data:', error);
    res.status(500).json({ success: false, message: 'Gagal menghapus data: ' + error.message });
  }
}

module.exports = {
  clearInspectionSupervisiData
};
