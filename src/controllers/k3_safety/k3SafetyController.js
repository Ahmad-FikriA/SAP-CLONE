'use strict';

const { User } = require('../../models');
const K3Report = require('../../models/K3Report');
const sequelize = require('../../config/database');
const { Op } = require('sequelize');

exports.createReport = async (req, res, next) => {
  try {
    const { kategori, deskripsi } = req.body;
    const userId = req.user.id; // from verifyToken

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
      status: 'menunggu_review_kadiv_pelapor',
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
