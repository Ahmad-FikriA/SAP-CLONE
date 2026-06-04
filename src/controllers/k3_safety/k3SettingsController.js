'use strict';

const K3Settings = require('../../models/K3Settings');

/**
 * GET /api/k3-settings
 * Mengambil data K3 settings (total karyawan, jam kerja, dsb).
 * Jika belum ada, maka membuat row default 'main'.
 */
exports.getSettings = async (req, res, next) => {
  try {
    let settings = await K3Settings.findByPk('main');
    if (!settings) {
      settings = await K3Settings.create({ id: 'main' });
    }
    
    res.status(200).json({
      success: true,
      data: settings,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * PUT /api/k3-settings
 * Mengupdate K3 settings (total karyawan, jam kerja, dsb).
 * Hanya untuk admin / kadiv / HSE staff.
 */
exports.updateSettings = async (req, res, next) => {
  try {
    const role = (req.user.role || '').toLowerCase();
    const divisi = (req.user.divisi || '').toLowerCase();
    
    // Auth Check: Cuma Admin, Developer, Kadiv, atau HSE yang boleh edit
    if (!role.includes('admin') && !role.includes('developer') && !role.includes('kadiv') && !divisi.includes('hse') && !divisi.includes('pphse')) {
      return res.status(403).json({ success: false, message: 'Akses Ditolak: Hanya Admin/Kadiv/HSE yang dapat mengubah pengaturan K3' });
    }

    const {
      totalKaryawan,
      jamKerjaPerHari,
      hariKerjaPerBulan,
      jamKerjaTanpaKecelakaan,
      jumlahFatality,
      bannerTitle1,
      bannerTitle2,
      bannerDescription,
      bannerSlides
    } = req.body;
    
    if (bannerTitle1 && bannerTitle1.length > 35) {
      return res.status(400).json({ success: false, message: 'Judul Baris 1 maksimal 35 karakter' });
    }
    if (bannerTitle2 && bannerTitle2.length > 35) {
      return res.status(400).json({ success: false, message: 'Judul Baris 2 maksimal 35 karakter' });
    }
    if (bannerDescription && bannerDescription.length > 140) {
      return res.status(400).json({ success: false, message: 'Deskripsi Banner maksimal 140 karakter' });
    }

    let settings = await K3Settings.findByPk('main');
    if (!settings) {
      settings = await K3Settings.create({ id: 'main' });
    }

    // Update field yang ada di request body
    if (totalKaryawan !== undefined) settings.totalKaryawan = totalKaryawan;
    if (jamKerjaPerHari !== undefined) settings.jamKerjaPerHari = jamKerjaPerHari;
    if (hariKerjaPerBulan !== undefined) settings.hariKerjaPerBulan = hariKerjaPerBulan;
    if (jamKerjaTanpaKecelakaan !== undefined) settings.jamKerjaTanpaKecelakaan = jamKerjaTanpaKecelakaan;
    if (jumlahFatality !== undefined) settings.jumlahFatality = jumlahFatality;
    if (bannerTitle1 !== undefined) settings.bannerTitle1 = bannerTitle1;
    if (bannerTitle2 !== undefined) settings.bannerTitle2 = bannerTitle2;
    if (bannerDescription !== undefined) settings.bannerDescription = bannerDescription;
    if (bannerSlides !== undefined) settings.bannerSlides = bannerSlides;

    await settings.save();

    res.status(200).json({
      success: true,
      message: 'K3 Settings berhasil diupdate',
      data: settings,
    });
  } catch (error) {
    next(error);
  }
};
