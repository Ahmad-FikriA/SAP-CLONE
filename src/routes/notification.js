'use strict';

const express = require('express');
const router = express.Router();
const { verifyToken } = require('../middleware/auth');
const { Op } = require('sequelize');

function getModel() {
  return require('../models/PushNotification');
}

// GET /api/notifications?module=preventive&unreadOnly=true
router.get('/', verifyToken, async (req, res) => {
  try {
    const { module: mod, unreadOnly } = req.query;
    const userId = req.user.userId;
    const Model = getModel();

    const where = { recipientId: userId };
    if (mod) where.module = mod;
    if (unreadOnly === 'true') where.isRead = false;

    const notifications = await Model.findAll({
      where,
      order: [['createdAt', 'DESC']],
      limit: 50,
    });

    res.json({ data: notifications });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/notifications/read-all — MUST be before /:id/read
router.patch('/read-all', verifyToken, async (req, res) => {
  try {
    const { module: mod } = req.query;
    const userId = req.user.userId;
    const Model = getModel();

    const where = { recipientId: userId, isRead: false };
    if (mod) where.module = mod;

    await Model.update({ isRead: true }, { where });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/notifications/:id/read
router.patch('/:id/read', verifyToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const Model = getModel();

    await Model.update(
      { isRead: true },
      { where: { id: req.params.id, recipientId: userId } }
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
