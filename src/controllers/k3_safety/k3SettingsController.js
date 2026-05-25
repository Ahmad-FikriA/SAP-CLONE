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
 * Hanya untuk admin / kadiv (di-handle oleh middleware route).
 */
exports.updateSettings = async (req, res, next) => {
  try {
    const { totalKaryawan, jamKerjaPerHari, hariKerjaPerBulan, jamKerjaTanpaKecelakaan } = req.body;
    
    let settings = await K3Settings.findByPk('main');
    if (!settings) {
      settings = await K3Settings.create({ id: 'main' });
    }

    // Update field yang ada di request body
    if (totalKaryawan !== undefined) settings.totalKaryawan = totalKaryawan;
    if (jamKerjaPerHari !== undefined) settings.jamKerjaPerHari = jamKerjaPerHari;
    if (hariKerjaPerBulan !== undefined) settings.hariKerjaPerBulan = hariKerjaPerBulan;
    if (jamKerjaTanpaKecelakaan !== undefined) settings.jamKerjaTanpaKecelakaan = jamKerjaTanpaKecelakaan;

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
