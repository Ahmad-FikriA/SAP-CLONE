'use strict';

const User = require('../../models/User');
const K3Report = require('../../models/K3Report');
const sequelize = require('../../config/database');
const { Op } = require('sequelize');

exports.createReport = async (req, res, next) => {
  try {
    const { kategori, deskripsi } = req.body;
    // user ID from verifyToken, mapped differently: userId could be in req.user.userId
    const userId = req.user.userId || req.user.id;

    // Get today's date in YYYYMMDD format
    const now = new Date();
    const todayStr = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;
    const prefix = `K3-${todayStr}-`;

    // Find the latest report number for today to auto-increment
    const latestReport = await K3Report.findOne({
      where: {
        reportNumber: {
          [Op.like]: `${prefix}%`,
        },
      },
      order: [['reportNumber', 'DESC']],
    });

    let counter = 1;
    if (latestReport && latestReport.reportNumber) {
      const parts = latestReport.reportNumber.split('-');
      if (parts.length === 3) {
        const lastCount = parseInt(parts[2], 10);
        if (!isNaN(lastCount)) {
          counter = lastCount + 1;
        }
      }
    }

    const reportNumber = `${prefix}${String(counter).padStart(4, '0')}`;

    // Handle uploaded photos
    let fotos = [];
    if (req.files && req.files.length > 0) {
      fotos = req.files.map(file => `uploads/k3_safety/${file.filename}`);
    }

    const newReport = await K3Report.create({
      reportNumber: reportNumber,
      kategori,
      deskripsi,
      foto: fotos, // Sequelize will stringify array to JSON
      dilaporkanOleh: userId,
      status: 'menunggu_validasi_kadiv_pphse',
    });

    // Optionally fetch with associations (pelapor details) to return
    const reportWithDetails = await K3Report.findByPk(newReport.id, {
      include: [
        {
          model: User,
          as: 'pelapor',
          attributes: ['id', 'name', 'jabatan', 'divisi', 'dinas'],
        }
      ]
    });

    res.status(201).json({
      success: true,
      message: 'Laporan K3 berhasil dibuat',
      data: reportWithDetails,
    });
  } catch (error) {
    if (error.name === 'SequelizeValidationError') {
      return res.status(400).json({ success: false, error: error.errors.map(e => e.message).join(', ') });
    }
    next(error);
  }
};

exports.getAll = async (req, res, next) => {
  try {
    const role = (req.user.role || '').toLowerCase();
    const divisi = (req.user.divisi || '').toLowerCase();

    let whereClause = {};

    if (divisi === 'pphse' || divisi === 'hse') {
      if (role.includes('kadiv') || role.includes('kepala divisi')) {
        // Kadiv PPHSE can see all reports (including pending validations)
        whereClause = {}; 
      } else {
        // Staff HSE only sees approved (waiting for their action) and onwards
        whereClause.status = {
          [Op.in]: ['menunggu_tindakan_hse', 'disetujui', 'selesai', 'ditolak']
        };
      }
    } else {
      // Regular user or other division: can only see their own reports.
      whereClause.dilaporkanOleh = req.user.userId || req.user.id;
    }

    const reports = await K3Report.findAll({
      where: whereClause,
      include: [
        {
          model: User,
          as: 'pelapor',
          attributes: ['id', 'name', 'role', 'divisi', 'dinas'],
        }
      ],
      order: [['createdAt', 'DESC']]
    });

    res.status(200).json({
      success: true,
      data: reports
    });
  } catch (error) {
    next(error);
  }
};

exports.validasiAwal = async (req, res, next) => {
  try {
    const { action, catatanValidasi } = req.body;
    const reportId = req.params.id;
    const role = (req.user.role || '').toLowerCase();
    const divisi = (req.user.divisi || '').toLowerCase();

    // Pastikan yang akses adalah Kadiv PPHSE
    if (!(role.includes('kadiv') || role.includes('kepala divisi')) || !(divisi === 'pphse' || divisi === 'hse')) {
      return res.status(403).json({ success: false, message: 'Akses Ditolak: Hanya Kadiv PPHSE yang dapat memvalidasi' });
    }

    const report = await K3Report.findByPk(reportId);

    if (!report) {
      return res.status(404).json({ success: false, message: 'Laporan tidak ditemukan' });
    }

    if (report.status !== 'menunggu_validasi_kadiv_pphse') {
      return res.status(400).json({ success: false, message: 'Laporan tidak berada pada tahap validasi awal' });
    }

    if (action === 'approve') {
      report.status = 'menunggu_tindakan_hse';
      if (catatanValidasi) report.catatanKadivPphse = catatanValidasi;
    } else if (action === 'reject') {
      report.status = 'ditolak_kadiv_pphse';
      report.catatanKadivPphse = catatanValidasi || 'Ditolak tanpa catatan';
    } else {
      return res.status(400).json({ success: false, message: 'Action tidak valid. Gunakan approve atau reject' });
    }

    await report.save();

    res.status(200).json({
      success: true,
      message: `Laporan berhasil di${action === 'approve' ? 'setujui' : 'tolak'}`,
      data: report
    });

  } catch (error) {
    next(error);
  }
};

