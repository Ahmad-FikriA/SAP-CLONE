'use strict';

const jwt  = require('jsonwebtoken');
const User = require('../../models/User');

const JWT_SECRET = process.env.JWT_SECRET || 'kti-mock-secret-dev';

const login = async (req, res) => {
  const { nik, password } = req.body;
  if (!nik || !password) {
    return res.status(400).json({ error: 'NIK and password required' });
  }

  const user = await User.findOne({ where: { nik, password } });
  if (!user) return res.status(401).json({ error: 'Invalid credentials' });

  const token = jwt.sign(
    { userId: user.id, nik: user.nik, role: user.role },
    JWT_SECRET,
    { expiresIn: '24h' }
  );

  res.json({
    token,
    user: { id: user.id, name: user.name, nik: user.nik, role: user.role, dinas: user.dinas, divisi: user.divisi, email: user.email },
  });
};

module.exports = { login };
