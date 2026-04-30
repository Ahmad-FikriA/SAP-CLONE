'use strict';

const User = require('../../models/User');
const K3Report = require('../../models/K3Report');
const sequelize = require('../../config/database');
const { Op } = require('sequelize');
const NotificationService = require('../../services/notificationService');

exports.createReport = async (req, res, next) => {
  try {
    const { kategori, deskripsi } = req.body;

    const userId = req.user.userId || req.user.id;


    const now = new Date();
    const todayStr = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;
    const prefix = `K3-${todayStr}-`;

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

    let fotos = [];
    if (req.files && req.files.length > 0) {
      fotos = req.files.map(file => `uploads/k3_safety/${file.filename}`);
    }

    const newReport = await K3Report.create({
      reportNumber: reportNumber,
      kategori,
      deskripsi,
      foto: fotos,
      dilaporkanOleh: userId,
      status: 'menunggu_validasi_kadis_hse',
    });


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

    if (role.includes('admin') || role === 'superadmin') {
      whereClause = {};
    } else if (divisi.includes('pphse') || divisi.includes('hse') || dinas.includes('hse')) {
      if (role.includes('kadiv') || role.includes('kepala divisi') || role.includes('kadis') || role.includes('kepala dinas')) {

        whereClause = {}; 
      } else {

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
    const { action, catatanValidasi, assignedTo, jenisTindakan } = req.body;
    const reportId = req.params.id;
    const role = (req.user.role || '').toLowerCase();
    const divisi = (req.user.divisi || '').toLowerCase();

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
      if (jenisTindakan) report.jenisTindakan = jenisTindakan;
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

    if (!(divisi === 'pphse' || divisi === 'hse')) {
      return res.status(403).json({ success: false, message: 'Akses Ditolak: Hanya Staf HSE yang dapat memproses' });
    }

    const report = await K3Report.findByPk(reportId);
    if (!report) {
      return res.status(404).json({ success: false, message: 'Laporan tidak ditemukan' });
    }

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
      if (report.jenisTindakan === 'perbaikan_langsung') {
        report.status = 'selesai';
      } else {
        report.status = 'menunggu_validasi_akhir_kadiv_pphse';
      }
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
        if (report.status === 'selesai') {

          await NotificationService.notify({
            module: 'k3_safety',
            type: 'laporan_selesai',
            title: 'Laporan K3 Selesai',
            body: `Hasil perbaikan telah disetujui Kadis HSE. Laporan Anda kini dinyatakan selesai (Closed).`,
            data: { reportId: report.reportNumber, deepLink: 'k3_safety/detail' },
            recipientIds: [report.dilaporkanOleh],
          });
        } else {

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
      if (catatan) report.catatanRevisiPerbaikan = catatan;
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

        await NotificationService.notify({
          module: 'k3_safety',
          type: 'laporan_selesai',
          title: 'Laporan K3 Selesai',
          body: `Laporan K3 Anda telah selesai ditindaklanjuti dan closed.`,
          data: { reportId: report.reportNumber, deepLink: 'k3_safety/detail' },
          recipientIds: [report.dilaporkanOleh],
        });
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




exports.submitInvestigasi = async (req, res, next) => {
  try {
    const reportId = req.params.id;
    const divisi = (req.user.divisi || '').toLowerCase();


    if (!(divisi === 'pphse' || divisi === 'hse')) {
      return res.status(403).json({ success: false, message: 'Akses Ditolak: Hanya Staf HSE yang dapat mengisi investigasi' });
    }

    const report = await K3Report.findByPk(reportId);
    if (!report) {
      return res.status(404).json({ success: false, message: 'Laporan tidak ditemukan' });
    }


    const allowedStatuses = [
      'menunggu_tindakan_hse',
      'investigasi_ditolak_kadis_hse',
      'investigasi_ditolak_kadiv',
    ];
    if (!allowedStatuses.includes(report.status)) {
      return res.status(400).json({ success: false, message: `Laporan tidak dalam tahap tindakan HSE (status: ${report.status})` });
    }

    const { investigasiCategory, isDraftInvestigasi } = req.body;


    let investigasiData = req.body.investigasiData;
    if (typeof investigasiData === 'string') {
      try {
        investigasiData = JSON.parse(investigasiData);
      } catch (_) {

      }
    }

    const isDraft = isDraftInvestigasi === true || isDraftInvestigasi === 'true';

    let fotos = report.fotoInvestigasi || [];
    if (req.files) {
      const fotoFiles = Array.isArray(req.files) 
        ? req.files.filter(f => f.fieldname === 'fotoInvestigasi')
        : (req.files['fotoInvestigasi'] || []);
      
      if (fotoFiles.length > 0) {
        const newPhotos = fotoFiles.map(file => `uploads/k3_safety/${file.filename}`);
        fotos = newPhotos;
      }
    }

    let dokumenPath = report.dokumenInvestigasi;
    if (req.files) {
      const docFiles = Array.isArray(req.files)
        ? req.files.filter(f => f.fieldname === 'dokumenInvestigasi')
        : (req.files['dokumenInvestigasi'] || []);
      
      if (docFiles.length > 0) {
        dokumenPath = `uploads/k3_safety/${docFiles[0].filename}`;
      }
    }

    report.investigasiCategory = investigasiCategory || report.investigasiCategory;
    report.investigasiData = investigasiData || report.investigasiData;
    report.isDraftInvestigasi = isDraft;
    report.fotoInvestigasi = fotos;
    report.dokumenInvestigasi = dokumenPath;


    if (isDraft) {

    } else {

      report.status = 'menunggu_verifikasi_investigasi';

      report.catatanRevisiInvestigasi = null;
    }

    await report.save();


    const updated = await K3Report.findByPk(reportId, {
      include: [
        { model: User, as: 'pelapor', attributes: ['id', 'name', 'role', 'divisi', 'dinas'] },
        { model: User, as: 'petugasHse', attributes: ['id', 'name', 'role', 'divisi', 'dinas'] },
      ],
    });

    res.status(200).json({
      success: true,
      message: isDraft ? 'Draft investigasi disimpan' : 'Investigasi berhasil disubmit',
      data: updated,
    });


    if (!isDraft) {
      try {
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
            type: 'investigasi_disubmit',
            title: 'Investigasi K3 Selesai',
            body: `Staf HSE telah menyelesaikan investigasi (${investigasiCategory || '-'}), butuh verifikasi.`,
            data: { reportId: report.reportNumber, deepLink: 'k3_safety/detail' },
            recipientIds: kadisHseUsers.map(u => u.id),
          });
        }
      } catch (e) {
        console.error('Failed to send push notification', e);
      }
    }
  } catch (error) {
    next(error);
  }
};


exports.verifikasiInvestigasi = async (req, res, next) => {
  try {
    const { action, catatan } = req.body;
    const reportId = req.params.id;
    const role = (req.user.role || '').toLowerCase();
    const divisi = (req.user.divisi || '').toLowerCase();


    if (!(role.includes('kadiv') || role.includes('kepala divisi') || role.includes('kadis') || role.includes('kepala dinas')) || !(divisi === 'pphse' || divisi === 'hse')) {
      return res.status(403).json({ success: false, message: 'Akses Ditolak: Hanya Kepala Dinas HSE yang dapat memverifikasi investigasi' });
    }

    const report = await K3Report.findByPk(reportId);
    if (!report) {
      return res.status(404).json({ success: false, message: 'Laporan tidak ditemukan' });
    }

    if (report.status !== 'menunggu_verifikasi_investigasi') {
      return res.status(400).json({ success: false, message: 'Laporan belum ada di tahap verifikasi investigasi' });
    }

    if (action === 'approve') {
      report.status = 'menunggu_validasi_kadiv';

      report.isApprovedKadivPelapor = false;
      report.isApprovedKadivPphse = false;
    } else if (action === 'reject') {
      report.status = 'investigasi_ditolak_kadis_hse';
      report.catatanRevisiInvestigasi = catatan || 'Ditolak tanpa catatan';
    } else {
      return res.status(400).json({ success: false, message: 'Action tidak valid. Gunakan approve atau reject' });
    }

    await report.save();


    const updated = await K3Report.findByPk(reportId, {
      include: [
        { model: User, as: 'pelapor', attributes: ['id', 'name', 'role', 'divisi', 'dinas'] },
        { model: User, as: 'petugasHse', attributes: ['id', 'name', 'role', 'divisi', 'dinas'] },
      ],
    });

    res.status(200).json({
      success: true,
      message: `Verifikasi investigasi berhasil (${action})`,
      data: updated,
    });

    try {
      if (action === 'approve') {

        const kadivUsers = await User.findAll({
          where: {
            role: { [Op.in]: ['kadiv', 'kepala divisi'] },
          },
          attributes: ['id'],
        });
        if (kadivUsers.length > 0) {
          await NotificationService.notify({
            module: 'k3_safety',
            type: 'investigasi_terverifikasi',
            title: 'Investigasi K3 Butuh Validasi Kadiv',
            body: `Kadis HSE telah memverifikasi investigasi K3, mohon Kadiv tinjau dan setujui.`,
            data: { reportId: report.reportNumber, deepLink: 'k3_safety/detail' },
            recipientIds: kadivUsers.map(u => u.id),
          });
        }
      } else if (action === 'reject') {

        let recipientIds = [];
        if (report.ditugaskanKepada) {
          recipientIds = [report.ditugaskanKepada];
        } else {
          const hseUsers = await User.findAll({
            where: { divisi: { [Op.like]: '%pphse%' } },
            attributes: ['id'],
          });
          recipientIds = hseUsers.map(u => u.id);
        }
        if (recipientIds.length > 0) {
          await NotificationService.notify({
            module: 'k3_safety',
            type: 'investigasi_ditolak',
            title: 'Investigasi K3 Ditolak',
            body: `Investigasi ditolak oleh Kadis HSE: ${catatan || 'Tanpa catatan'}. Silakan revisi.`,
            data: { reportId: report.reportNumber, deepLink: 'k3_safety/detail' },
            recipientIds: recipientIds,
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


exports.validasiInvestigasiKadiv = async (req, res, next) => {
  try {
    const { action, kadivType, catatan } = req.body;
    const reportId = req.params.id;
    const role = (req.user.role || '').toLowerCase();


    if (!(role.includes('kadiv') || role.includes('kepala divisi'))) {
      return res.status(403).json({ success: false, message: 'Akses Ditolak: Hanya Kadiv yang dapat melakukan validasi ini' });
    }

    if (!kadivType || !['pelapor', 'pphse'].includes(kadivType)) {
      return res.status(400).json({ success: false, message: 'kadivType harus "pelapor" atau "pphse"' });
    }

    const report = await K3Report.findByPk(reportId);
    if (!report) {
      return res.status(404).json({ success: false, message: 'Laporan tidak ditemukan' });
    }

    if (report.status !== 'menunggu_validasi_kadiv') {
      return res.status(400).json({ success: false, message: 'Laporan belum ada di tahap validasi Kadiv' });
    }

    if (action === 'approve') {
      if (kadivType === 'pelapor') {
        report.isApprovedKadivPelapor = true;
      } else {
        report.isApprovedKadivPphse = true;
      }

      const bothApproved = report.isApprovedKadivPelapor && report.isApprovedKadivPphse;
      if (bothApproved) {
        report.status = 'selesai';
      }


    } else if (action === 'reject') {
      report.status = 'investigasi_ditolak_kadiv';
      report.catatanRevisiInvestigasi = catatan || 'Ditolak tanpa catatan';

      report.isApprovedKadivPelapor = false;
      report.isApprovedKadivPphse = false;
    } else {
      return res.status(400).json({ success: false, message: 'Action tidak valid. Gunakan approve atau reject' });
    }

    await report.save();


    const updated = await K3Report.findByPk(reportId, {
      include: [
        { model: User, as: 'pelapor', attributes: ['id', 'name', 'role', 'divisi', 'dinas'] },
        { model: User, as: 'petugasHse', attributes: ['id', 'name', 'role', 'divisi', 'dinas'] },
      ],
    });

    res.status(200).json({
      success: true,
      message: action === 'approve'
        ? (report.status === 'selesai' ? 'Investigasi disetujui & laporan selesai' : `Kadiv ${kadivType} telah menyetujui`)
        : 'Investigasi ditolak',
      data: updated,
    });

    try {
      if (action === 'approve' && report.status === 'selesai') {

        await NotificationService.notify({
          module: 'k3_safety',
          type: 'laporan_selesai',
          title: 'Laporan K3 Selesai',
          body: `Investigasi K3 Anda telah disetujui oleh kedua Kadiv dan dinyatakan selesai.`,
          data: { reportId: report.reportNumber, deepLink: 'k3_safety/detail' },
          recipientIds: [report.dilaporkanOleh],
        });
      } else if (action === 'reject') {

        let recipientIds = [];
        if (report.ditugaskanKepada) {
          recipientIds = [report.ditugaskanKepada];
        } else {
          const hseUsers = await User.findAll({
            where: { divisi: { [Op.like]: '%pphse%' } },
            attributes: ['id'],
          });
          recipientIds = hseUsers.map(u => u.id);
        }
        if (recipientIds.length > 0) {
          await NotificationService.notify({
            module: 'k3_safety',
            type: 'investigasi_ditolak_kadiv',
            title: 'Investigasi Ditolak Kadiv',
            body: `Investigasi ditolak oleh Kadiv ${kadivType}: ${catatan || 'Tanpa catatan'}. Silakan revisi.`,
            data: { reportId: report.reportNumber, deepLink: 'k3_safety/detail' },
            recipientIds: recipientIds,
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






exports.deleteReport = async (req, res, next) => {
  try {
    const reportId = req.params.id;
    const role = (req.user.role || '').toLowerCase();
    

    if (!role.includes('admin') && !role.includes('developer')) {
      return res.status(403).json({ success: false, message: 'Akses Ditolak: Hanya Admin yang dapat menghapus data' });
    }

    const report = await K3Report.findByPk(reportId);
    if (!report) {
      return res.status(404).json({ success: false, message: 'Laporan tidak ditemukan' });
    }

    await report.destroy();
    
    res.status(200).json({ success: true, message: 'Laporan berhasil dihapus' });
  } catch (error) {
    next(error);
  }
};


exports.deleteAllReports = async (req, res, next) => {
  try {
    const role = (req.user.role || '').toLowerCase();
    

    if (!role.includes('admin') && !role.includes('developer')) {
      return res.status(403).json({ success: false, message: 'Akses Ditolak: Hanya Admin yang dapat melakukan hapus semua data' });
    }

    const count = await K3Report.destroy({
      where: {},
      truncate: false 
    });
    
    res.status(200).json({ success: true, message: `Berhasil menghapus ${count} laporan K3 Safety secara permanen` });
  } catch (error) {
    next(error);
  }
};

