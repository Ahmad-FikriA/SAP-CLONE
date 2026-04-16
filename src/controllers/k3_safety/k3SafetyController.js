'use strict';

const User = require('../../models/User');
const K3Report = require('../../models/K3Report');
const sequelize = require('../../config/database');
const { Op } = require('sequelize');
const NotificationService = require('../../services/notificationService');

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
      status: 'menunggu_validasi_kadis_hse',
    });

    // Optionally fetch with associations (pelapor details) to return
    const reportWithDetails = await K3Report.findByPk(newReport.id, {
      include: [
        {
          model: User,
          as: 'pelapor',
          attributes: ['id', 'name', 'role', 'divisi', 'dinas'],
        }
      ]
    });

    res.status(201).json({
      success: true,
      message: 'Laporan K3 berhasil dibuat',
      data: reportWithDetails,
    });

    try {
      // Skenario 1: Created (User Baru Lapor) -> Push ke Kadis HSE
      const kadisHseUsers = await User.findAll({
        where: {
          role: { [Op.in]: ['kadis', 'kepala dinas', 'kadiv', 'kepala divisi'] }, // Fallback to Kadiv if required
          dinas: { [Op.like]: '%hse%' },
        },
        attributes: ['id'],
      });
      if (kadisHseUsers.length > 0) {
        await NotificationService.notify({
          module: 'k3_safety',
          type: 'laporan_baru',
          title: 'Laporan K3 Baru',
          body: `Ada laporan K3 baru butuh divalidasi: ${kategori}`,
          data: { reportId: newReport.reportNumber, deepLink: 'k3_safety/detail' },
          recipientIds: kadisHseUsers.map(u => u.id),
        });
      }
    } catch (e) {
      console.error('Failed to send push notification', e);
    }
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
    const dinas = (req.user.dinas || '').toLowerCase();

    let whereClause = {};

    if (divisi.includes('pphse') || divisi.includes('hse') || dinas.includes('hse')) {
      if (role.includes('kadiv') || role.includes('kepala divisi') || role.includes('kadis') || role.includes('kepala dinas')) {
        // Kadiv/Kadis PPHSE can see all reports (including pending validations)
        whereClause = {}; 
      } else {
        // Staff HSE sees reports needing their action PLUS their own reports
        const userId = req.user.userId || req.user.id;
        whereClause = {
          [Op.or]: [
            {
              status: {
                [Op.in]: [
                  'menunggu_tindakan_hse', 
                  'menunggu_validasi_hasil_kadis_hse',
                  'perbaikan_ditolak_kadis_hse', 
                  'menunggu_validasi_akhir_kadiv_pphse', 
                  'perbaikan_ditolak_kadiv_pphse', 
                  'disetujui', 
                  'selesai', 
                  'ditolak'
                ]
              }
            },
            { dilaporkanOleh: userId }
          ]
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
        },
        {
          model: User,
          as: 'petugasHse',
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
    const { action, catatanValidasi, assignedTo } = req.body;
    const reportId = req.params.id;
    const role = (req.user.role || '').toLowerCase();
    const divisi = (req.user.divisi || '').toLowerCase();

    // Pastikan yang akses adalah Kepala Dinas HSE (atau representatif PPHSE tingkat Kadiv untuk backward compat)
    if (!(role.includes('kadiv') || role.includes('kepala divisi') || role.includes('kadis') || role.includes('kepala dinas')) || !(divisi === 'pphse' || divisi === 'hse')) {
      return res.status(403).json({ success: false, message: 'Akses Ditolak: Hanya Kepala Dinas HSE yang dapat memvalidasi awal' });
    }

    const report = await K3Report.findByPk(reportId);

    if (!report) {
      return res.status(404).json({ success: false, message: 'Laporan tidak ditemukan' });
    }

    if (report.status !== 'menunggu_validasi_kadis_hse' && report.status !== 'menunggu_validasi_kadiv_pphse') {
      return res.status(400).json({ success: false, message: 'Laporan tidak berada pada tahap validasi awal' });
    }

    if (action === 'approve') {
      report.status = 'menunggu_tindakan_hse';
      if (assignedTo) report.ditugaskanKepada = assignedTo;
      if (catatanValidasi) report.catatanKadivPphse = catatanValidasi;
    } else if (action === 'reject') {
      report.status = 'ditolak_kadis_hse';
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

    try {
      if (action === 'approve') {
        // Skenario 2: Validasi Awal Disetujui -> Push ke petugas yang ditugaskan (atau seluruh Dinas HSE jika tidak ada)
        let recipientIds = [];
        if (report.ditugaskanKepada) {
          recipientIds = [report.ditugaskanKepada];
        } else {
          const hseUsers = await User.findAll({
            where: {
              divisi: { [Op.like]: '%pphse%' },
            },
            attributes: ['id'],
          });
          recipientIds = hseUsers.map(u => u.id);
        }

        if (recipientIds.length > 0) {
          await NotificationService.notify({
            module: 'k3_safety',
            type: 'validasi_awal_disetujui',
            title: 'Temuan K3 Valid',
            body: report.ditugaskanKepada 
              ? 'Anda telah ditugaskan untuk menindaklanjuti temuan K3.' 
              : 'Ada temuan K3 butuh segera ditindaklanjuti.',
            data: { reportId: report.reportNumber, deepLink: 'k3_safety/detail' },
            recipientIds: recipientIds,
          });
        }
      } else if (action === 'reject') {
        // Skenario 3: Validasi Awal Ditolak -> Push ke Pelapor
        await NotificationService.notify({
          module: 'k3_safety',
          type: 'validasi_awal_ditolak',
          title: 'Laporan K3 Ditolak',
          body: `Laporan Anda ditolak oleh Kepala Dinas HSE: ${catatanValidasi || 'Tanpa catatan'}`,
          data: { reportId: report.reportNumber, deepLink: 'k3_safety/detail' },
          recipientIds: [report.dilaporkanOleh],
        });
      }
    } catch (e) {
      console.error('Failed to send push notification', e);
    }

  } catch (error) {
    next(error);
  }
};

exports.actionPerbaikan = async (req, res, next) => {
  try {
    const { tindakanPerbaikan } = req.body;
    const reportId = req.params.id;
    const role = (req.user.role || '').toLowerCase();
    const divisi = (req.user.divisi || '').toLowerCase();

    // Check if user is HSE Staff
    if (!(divisi === 'pphse' || divisi === 'hse')) {
      return res.status(403).json({ success: false, message: 'Akses Ditolak: Hanya Staf HSE yang dapat memproses' });
    }

    const report = await K3Report.findByPk(reportId);
    if (!report) {
      return res.status(404).json({ success: false, message: 'Laporan tidak ditemukan' });
    }

    // Handle foto perbaikan
    let fotos = report.fotoPerbaikan || [];
    if (req.files && req.files.length > 0) {
      const newPhotos = req.files.map(file => `uploads/k3_safety/${file.filename}`);
      fotos = fotos.concat(newPhotos);
    }

    report.status = 'menunggu_validasi_hasil_kadis_hse';
    report.tindakanPerbaikan = tindakanPerbaikan;
    report.fotoPerbaikan = fotos;

    await report.save();

    res.status(200).json({
      success: true,
      message: 'Aksi perbaikan berhasil disubmit',
      data: report
    });

    try {
      // Push ke Kadis HSE
      const kadisHseUsers = await User.findAll({
        where: {
          role: { [Op.in]: ['kadis', 'kepala dinas', 'kadiv', 'kepala divisi'] },
          dinas: { [Op.like]: '%hse%' },
        },
        attributes: ['id'],
      });
      if (kadisHseUsers.length > 0) {
        await NotificationService.notify({
          module: 'k3_safety',
          type: 'perbaikan_disubmit',
          title: 'Perbaikan K3 Telah Selesai',
          body: `Staf HSE telah melakukan perbaikan, mohon Kepala Dinas cek hasil.`,
          data: { reportId: report.reportNumber, deepLink: 'k3_safety/detail' },
          recipientIds: kadisHseUsers.map(u => u.id),
        });
      }
    } catch (e) {
      console.error('Failed to send push notification', e);
    }
  } catch (error) {
    next(error);
  }
};

exports.validasiHasil = async (req, res, next) => {
  try {
    const { action, catatan } = req.body;
    const reportId = req.params.id;
    const role = (req.user.role || '').toLowerCase();
    const divisi = (req.user.divisi || '').toLowerCase();

    // Pastikan yang akses adalah Kepala Dinas HSE (atau representatif PPHSE tingkat Kadiv untuk backward compat)
    if (!(role.includes('kadiv') || role.includes('kepala divisi') || role.includes('kadis') || role.includes('kepala dinas')) || !(divisi === 'pphse' || divisi === 'hse')) {
      return res.status(403).json({ success: false, message: 'Akses Ditolak: Hanya Kepala Dinas HSE yang dapat memvalidasi' });
    }

    const report = await K3Report.findByPk(reportId);
    if (!report) {
      return res.status(404).json({ success: false, message: 'Laporan tidak ditemukan' });
    }

    if (report.status !== 'menunggu_validasi_hasil_kadis_hse') {
      return res.status(400).json({ success: false, message: 'Laporan belum ada di tahap validasi hasil' });
    }

    if (action === 'approve') {
      report.status = 'menunggu_validasi_akhir_kadiv_pphse';
    } else if (action === 'reject') {
      report.status = 'perbaikan_ditolak_kadis_hse';
      if (catatan) report.catatanRevisiPerbaikan = catatan;
    } else {
      return res.status(400).json({ success: false, message: 'Action tidak valid. Gunakan approve atau reject' });
    }

    await report.save();

    res.status(200).json({
      success: true,
      message: `Validasi hasil berhasil (Status: ${report.status})`,
      data: report
    });

    try {
      if (action === 'approve') {
        const kadivPphseUsers = await User.findAll({
          where: {
            role: { [Op.in]: ['kadiv', 'kepala divisi'] },
            divisi: { [Op.in]: ['pphse', 'hse'] },
          },
          attributes: ['id'],
        });
        if (kadivPphseUsers.length > 0) {
          await NotificationService.notify({
            module: 'k3_safety',
            type: 'validasi_hasil_disetujui',
            title: 'Laporan Butuh Validasi Final',
            body: `Perbaikan K3 telah disetujui Kadis HSE, mohon Kadiv PPHSE menyelesaikan tiket.`,
            data: { reportId: report.reportNumber, deepLink: 'k3_safety/detail' },
            recipientIds: kadivPphseUsers.map(u => u.id),
          });
        }
      } else if (action === 'reject') {
        const hseUsers = await User.findAll({
          where: {
            divisi: { [Op.like]: '%pphse%' },
          },
          attributes: ['id'],
        });
        if (hseUsers.length > 0) {
          await NotificationService.notify({
            module: 'k3_safety',
            type: 'perbaikan_ditolak',
            title: 'Hasil Perbaikan K3 Ditolak',
            body: `Hasil perbaikan ditolak oleh Kadis HSE, mohon revisi.`,
            data: { reportId: report.reportNumber, deepLink: 'k3_safety/detail' },
            recipientIds: hseUsers.map(u => u.id),
          });
        }
      }
    } catch (e) {
      console.error('Failed to send push notification', e);
    }
  } catch (error) {
    next(error);
  }
};

exports.validasiAkhir = async (req, res, next) => {
  try {
    const { action, catatan } = req.body;
    const reportId = req.params.id;
    const role = (req.user.role || '').toLowerCase();
    const divisi = (req.user.divisi || '').toLowerCase();

    // Pastikan yang akses adalah Kadiv PPHSE (bukan Kadis) - Gatekeeper Akhir
    if (!(role.includes('kadiv') || role.includes('kepala divisi')) || !(divisi === 'pphse' || divisi === 'hse')) {
      return res.status(403).json({ success: false, message: 'Akses Ditolak: Hanya Kadiv PPHSE yang dapat memvalidasi akhir' });
    }

    const report = await K3Report.findByPk(reportId);
    if (!report) {
      return res.status(404).json({ success: false, message: 'Laporan tidak ditemukan' });
    }

    if (report.status !== 'menunggu_validasi_akhir_kadiv_pphse') {
      return res.status(400).json({ success: false, message: 'Laporan belum ada di tahap validasi akhir Kadiv PPHSE' });
    }

    if (action === 'approve') {
      report.status = 'selesai';
    } else if (action === 'reject') {
      report.status = 'perbaikan_ditolak_kadiv_pphse';
      if (catatan) report.catatanRevisiPerbaikan = catatan; // You can append or overwrite it here if you like
    } else {
      return res.status(400).json({ success: false, message: 'Action tidak valid. Gunakan approve atau reject' });
    }

    await report.save();

    res.status(200).json({
      success: true,
      message: `Validasi akhir berhasil (Status: ${report.status})`,
      data: report
    });

    try {
      if (action === 'approve') {
        // Skenario 6: Validasi Akhir Disetujui -> Push ke Pelapor
        await NotificationService.notify({
          module: 'k3_safety',
          type: 'laporan_selesai',
          title: 'Laporan K3 Selesai',
          body: `Laporan K3 Anda telah selesai ditindaklanjuti dan closed.`,
          data: { reportId: report.reportNumber, deepLink: 'k3_safety/detail' },
          recipientIds: [report.dilaporkanOleh],
        });
      } else if (action === 'reject') {
        // Skenario 5b: Action Perbaikan Ditolak oleh Kadiv -> Push ke Dinas HSE / Staf HSE
        const hseUsers = await User.findAll({
          where: {
            divisi: { [Op.like]: '%pphse%' },
          },
          attributes: ['id'],
        });
        if (hseUsers.length > 0) {
          await NotificationService.notify({
            module: 'k3_safety',
            type: 'perbaikan_ditolak',
            title: 'Hasil Validasi Ditolak Kadiv PPHSE',
            body: `Hasil perbaikan ditolak oleh Kadiv PPHSE, mohon revisi.`,
            data: { reportId: report.reportNumber, deepLink: 'k3_safety/detail' },
            recipientIds: hseUsers.map(u => u.id),
          });
        }
      }
    } catch (e) {
      console.error('Failed to send push notification', e);
    }
  } catch (error) {
    next(error);
  }
};

