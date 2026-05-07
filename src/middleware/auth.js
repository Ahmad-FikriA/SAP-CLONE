'use strict';

const jwt = require('jsonwebtoken');
const User = require('../models/User');

const JWT_SECRET = process.env.JWT_SECRET || 'kti-mock-secret-dev';

/**
 * Express middleware — verifies Authorization: Bearer <token>.
 * Attaches req.user = { userId, nik, role } on success.
 */
async function verifyToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  let token = null;

  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.split(' ')[1];
  } else if (req.query.token) {
    // Fallback: accept token via query param (for file download URLs)
    token = req.query.token;
  }

  if (!token) {
    return res.status(401).json({ error: 'Authorization header missing or malformed' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    let user = null;

    const needsUserLookup =
      !decoded.nik ||
      !decoded.role ||
      decoded.name === undefined ||
      decoded.group === undefined ||
      decoded.divisi === undefined ||
      decoded.dinas === undefined;

    if (needsUserLookup) {
      user = await User.findByPk(decoded.userId);
      if (!user) {
        return res.status(401).json({ error: 'Invalid user' });
      }
    }

    req.user = {
      userId: decoded.userId,
      nik: decoded.nik || user.nik,
      role: decoded.role || user.role,
      name: decoded.name !== undefined ? decoded.name : user.name,
      group: decoded.group !== undefined ? decoded.group : user.group,
      divisi: decoded.divisi !== undefined ? decoded.divisi : user.divisi,
      dinas: decoded.dinas !== undefined ? decoded.dinas : user.dinas,
    };
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

module.exports = { verifyToken };
