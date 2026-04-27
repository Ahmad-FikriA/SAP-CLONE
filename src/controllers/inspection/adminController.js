'use strict';

const sequelize = require('../../config/database');
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
    // 1. Otorisasi: Pastikan hanya admin
    if (!req.user || req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Akses Ditolak: Hanya Admin yang dapat melakukan aksi ini.'
      });
    }

    // 2. Disable foreign key checks
    await sequelize.query('SET FOREIGN_KEY_CHECKS = 0;');

    // 3. Clear Inspection Data
    await SuratPelanggaran.destroy({ where: {}, force: true });
    await InspectionFollowUp.destroy({ where: {}, force: true });
    await InspectionReportPhoto.destroy({ where: {}, force: true });
    await InspectionReport.destroy({ where: {}, force: true });
    await InspectionRequest.destroy({ where: {}, force: true });
    await InspectionSchedule.destroy({ where: {}, force: true });

    // 4. Clear Supervisi Data
    await SupervisiVisit.destroy({ where: {}, force: true });
    await SupervisiAmend.destroy({ where: {}, force: true });
    await SupervisiJob.destroy({ where: {}, force: true });

    // 5. Re-enable foreign key checks
    await sequelize.query('SET FOREIGN_KEY_CHECKS = 1;');

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
