'use strict';

const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'kti-mock-secret-dev';

/**
 * Express middleware — verifies Authorization: Bearer <token>.
 * Attaches req.user = { userId, nik, role } on success.
 */
function verifyToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authorization header missing or malformed' });
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = {
      userId: decoded.userId,
      nik: decoded.nik,
      role: decoded.role,
      dinas: decoded.dinas || null,
      group: decoded.group || null,
    };
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

module.exports = { verifyToken };
