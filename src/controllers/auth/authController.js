'use strict';

const fs   = require('fs');
const path = require('path');
const jwt  = require('jsonwebtoken');
const User = require('../../models/User');
const { buildAccessProfile } = require('../../services/accessProfile');

const JWT_SECRET     = process.env.JWT_SECRET || 'kti-mock-secret-dev';
const TEMPLATES_PATH = path.join(__dirname, '..', '..', '..', 'data', 'role_templates.json');

function loadRoleTemplates() {
  try {
    return JSON.parse(fs.readFileSync(TEMPLATES_PATH, 'utf8'));
  } catch {
    return {};
  }
}

const login = async (req, res) => {
  const { nik, password } = req.body;
  if (!nik || !password) {
    return res.status(400).json({ error: 'NIK and password required' });
  }

  const user = await User.findOne({ where: { nik, password } });
  if (!user) return res.status(401).json({ error: 'Invalid credentials' });

  const roleTemplates  = loadRoleTemplates();
  const permissions    = user.permissions ?? roleTemplates[user.role] ?? null; // null = unrestricted
  const accessProfile  = buildAccessProfile(user);

  const token = jwt.sign(
    {
      userId: user.id,
      nik: user.nik,
      role: user.role,
      name: user.name || '',
      dinas: user.dinas || '',
      group: user.group || '',
      divisi: user.divisi || '',
      permissions,
    },
    JWT_SECRET,
    { expiresIn: '24h' }
  );

  res.json({
    token,
    user: {
      id: user.id,
      name: user.name,
      nik: user.nik,
      role: user.role,
      dinas: user.dinas,
      divisi: user.divisi,
      email: user.email,
      group: user.group,
      accessProfile,
      permissions,
    },
  });
};

const registerFcmToken = async (req, res) => {
  try {
    const { fcmToken } = req.body;
    if (!fcmToken) {
      return res.status(400).json({ error: 'fcmToken required' });
    }
    const userId = req.user.userId; // set by verifyToken middleware
    
    // Explicitly update to ensure model hooks/fields are processed correctly
    const user = await User.findByPk(userId);
    if (user) {
      user.fcmToken = fcmToken;
      await user.save();
      console.log(`[AUTH] Successfully updated FCM token for user: ${userId}`);
      res.json({ success: true, message: 'FCM token updated' });
    } else {
      console.error(`[AUTH] User not found for FCM token update: ${userId}`);
      res.status(404).json({ error: 'User not found' });
    }
  } catch (err) {
    console.error(`[AUTH] FCM token update error: ${err.message}`);
    res.status(500).json({ error: err.message });
  }
};

module.exports = { login, registerFcmToken };
