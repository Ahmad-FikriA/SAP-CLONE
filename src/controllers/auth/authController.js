'use strict';

const fs   = require('fs');
const path = require('path');
const jwt  = require('jsonwebtoken');
const User = require('../../models/User');
const { buildAccessProfile } = require('../../services/accessProfile');

if (!process.env.JWT_SECRET && process.env.NODE_ENV === 'production') {
  throw new Error('JWT_SECRET environment variable is required in production');
}
const JWT_SECRET     = process.env.JWT_SECRET || 'kti-mock-secret-dev';
const TEMPLATES_PATH = path.join(__dirname, '..', '..', '..', 'data', 'role_templates.json');

function loadRoleTemplates() {
  try {
    return JSON.parse(fs.readFileSync(TEMPLATES_PATH, 'utf8'));
  } catch {
    return {};
  }
}

function buildUserAccessProfile(user, permissions) {
  const userPayload = typeof user.toJSON === 'function' ? user.toJSON() : user;
  return buildAccessProfile({ ...userPayload, permissions });
}

const login = async (req, res) => {
  const { nik, password } = req.body;
  if (!nik || !password) {
    return res.status(400).json({ error: 'NIK and password required' });
  }

  const user = await User.findOne({ where: { nik } });
  if (!user || !user.password) return res.status(401).json({ error: 'Invalid credentials' });

  const bcrypt = require('bcrypt');
  let isValid = false;
  if (user.password.startsWith('$2b$') || user.password.startsWith('$2a$')) {
    isValid = await bcrypt.compare(password, user.password);
  } else {
    isValid = (user.password === password || user.password.toLowerCase() === password.toLowerCase());
    if (isValid) {
      // Migrate plaintext password to bcrypt on first successful login
      const hashed = await bcrypt.hash(password, 12);
      await user.update({ password: hashed });
    }
  }

  if (!isValid) return res.status(401).json({ error: 'Invalid credentials' });

  const roleTemplates  = loadRoleTemplates();
  const permissions    = user.permissions ?? roleTemplates[user.role] ?? null; // null = unrestricted
  const accessProfile  = buildUserAccessProfile(user, permissions);

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
      fotoProfil: user.fotoProfil,
      accessProfile,
      permissions,
    },
  });
};

const me = async (req, res) => {
  try {
    const user = await User.findByPk(req.user.userId);
    if (!user) return res.status(404).json({ error: 'User not found' });

    const roleTemplates = loadRoleTemplates();
    const permissions   = user.permissions ?? roleTemplates[user.role] ?? null;
    const accessProfile = buildUserAccessProfile(user, permissions);

    res.json({
      user: {
        id: user.id,
        name: user.name,
        nik: user.nik,
        role: user.role,
        dinas: user.dinas,
        divisi: user.divisi,
        email: user.email,
        group: user.group,
        fotoProfil: user.fotoProfil,
        accessProfile,
        permissions,
      },
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
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

module.exports = { login, me, registerFcmToken };
