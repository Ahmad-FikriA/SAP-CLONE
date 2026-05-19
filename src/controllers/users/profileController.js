'use strict';

const fs = require('fs');
const path = require('path');
const bcrypt = require('bcrypt');
const User = require('../../models/User');

const getMyProfile = async (req, res) => {
  try {
    const user = await User.findByPk(req.user.userId, {
      attributes: { exclude: ['password'] }
    });
    if (!user) return res.status(404).json({ error: 'User not found' });
    
    res.json(user);
  } catch (err) {
    console.error('[Profile] getMyProfile error:', err.message);
    res.status(500).json({ error: 'Gagal mengambil profil' });
  }
};

const updateMyProfile = async (req, res) => {
  try {
    const user = await User.findByPk(req.user.userId);
    if (!user) return res.status(404).json({ error: 'User not found' });

    // Only allow updating specific safe fields (excluding name per request)
    const { tanggalLahir, alamat, noHp, email } = req.body;
    
    const updateData = {};
    if (tanggalLahir !== undefined) updateData.tanggalLahir = tanggalLahir || null;
    if (alamat !== undefined) updateData.alamat = alamat || null;
    if (noHp !== undefined) updateData.noHp = noHp || null;
    if (email !== undefined) updateData.email = email || null;

    await user.update(updateData);
    
    const { password, ...safeUser } = user.toJSON();
    res.json({ message: 'Profil berhasil diperbarui', user: safeUser });
  } catch (err) {
    console.error('[Profile] updateMyProfile error:', err.message);
    res.status(500).json({ error: 'Gagal memperbarui profil: ' + err.message });
  }
};

const updatePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: 'Password saat ini dan baru wajib diisi' });
    }

    if (newPassword.length < 8) {
      return res.status(400).json({ error: 'Password baru minimal 8 karakter' });
    }

    const user = await User.findByPk(req.user.userId);
    if (!user) return res.status(404).json({ error: 'User not found' });

    // Verify current password
    let isValid = false;
    if (user.password.startsWith('$2b$') || user.password.startsWith('$2a$')) {
      isValid = await bcrypt.compare(currentPassword, user.password);
    } else {
      isValid = (user.password === currentPassword);
    }

    if (!isValid) {
      return res.status(401).json({ error: 'Password saat ini tidak cocok' });
    }

    // Hash new password
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(newPassword, saltRounds);

    await user.update({ password: hashedPassword });
    res.json({ message: 'Password berhasil diperbarui' });
  } catch (err) {
    console.error('[Profile] updatePassword error:', err.message);
    res.status(500).json({ error: 'Gagal memperbarui password: ' + err.message });
  }
};

const uploadProfilePhoto = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Tidak ada file yang diunggah' });
    }

    const user = await User.findByPk(req.user.userId);
    if (!user) {
      // Clean up uploaded file if user not found
      fs.unlinkSync(req.file.path);
      return res.status(404).json({ error: 'User not found' });
    }

    // Delete old photo if exists
    if (user.fotoProfil) {
      const oldPath = path.join(__dirname, '../../../uploads/profiles', user.fotoProfil);
      if (fs.existsSync(oldPath)) {
        fs.unlinkSync(oldPath);
      }
    }

    const filename = req.file.filename;
    await user.update({ fotoProfil: filename });

    res.json({ message: 'Foto profil berhasil diperbarui', fotoProfil: filename });
  } catch (err) {
    console.error('[Profile] uploadProfilePhoto error:', err.message);
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    res.status(500).json({ error: 'Gagal mengunggah foto: ' + err.message });
  }
};

module.exports = {
  getMyProfile,
  updateMyProfile,
  updatePassword,
  uploadProfilePhoto
};
