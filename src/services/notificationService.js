'use strict';

const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

const serviceAccountPath = path.resolve(
  __dirname,
  '../config/serviceAccountKey.json'
);

// Initialize firebase-admin once (lazy)
let initialized = false;
let initializationFailed = false;

function ensureInitialized() {
  if (initialized) return true;
  if (initializationFailed) return false;
  try {
    if (fs.existsSync(serviceAccountPath)) {
      const serviceAccount = require(serviceAccountPath);
      admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
    } else {
      admin.initializeApp({
        credential: admin.credential.applicationDefault(),
      });
      console.warn(
        '[NotificationService] serviceAccountKey.json not found, trying application default credentials for FCM.'
      );
    }

    initialized = true;
    return true;
  } catch (error) {
    initializationFailed = true;
    console.warn(
      `[NotificationService] FCM initialization unavailable, skipping push delivery: ${error.message}`
    );
    return false;
  }
}

let _User, _PushNotification;
function getModels() {
  if (!_User) {
    _User = require('../models/User');
    _PushNotification = require('../models/PushNotification');
  }
  return { User: _User, PushNotification: _PushNotification };
}

/**
 * Send a push notification and persist it to the DB.
 * NEVER throws — notification failure must not block approval flow.
 *
 * @param {Object} opts
 * @param {string}   opts.module        'preventive' | 'corrective' | 'inspection' | 'supervisi'
 * @param {string}   opts.type          e.g. 'spk_created', 'spk_submitted'
 * @param {string}   opts.title         Notification title shown in system tray
 * @param {string}   opts.body          Notification body text
 * @param {Object}   opts.data          Arbitrary data (e.g. { spkNumber, deepLink })
 * @param {string[]} opts.recipientIds  Recipient identifiers (NIK / user id) to notify
 */
async function notify({ module, type, title, body, data = {}, recipientIds = [] }) {
  if (recipientIds.length === 0) return;

  const normalizedRecipientIds = recipientIds
    .map((recipientId) => String(recipientId ?? '').trim())
    .filter((recipientId) => recipientId.length > 0);
  if (normalizedRecipientIds.length === 0) return;

  const { User, PushNotification } = getModels();

  try {
    const { Op } = require('sequelize');

    // 1. Look up users by NIK or ID (since recipientIds can contain either)
    const users = await User.findAll({
      where: {
        [Op.or]: [
          { nik: { [Op.in]: normalizedRecipientIds } },
          { id: { [Op.in]: normalizedRecipientIds } },
        ],
      },
      attributes: ["id", "nik", "fcmToken"],
    });

    if (users.length === 0) return;

    // 2. Persist to PushNotification using user.id
    try {
      await PushNotification.bulkCreate(
        users.map((u) => ({
          module,
          type,
          title,
          body,
          data,
          recipientId: u.id,
          isRead: false,
        }))
      );
    } catch (err) {
      console.error('[NotificationService] Failed to persist notification:', err.message);
    }

    if (!ensureInitialized()) return;

    const tokens = users.filter((u) => u.fcmToken).map((u) => u.fcmToken);

    // 2. Send FCM multicast (only if any tokens found)
    if (tokens.length > 0) {
      const fcmMessage = {
        notification: { title, body },
        data: {
          module,
          type,
          ...Object.fromEntries(
            Object.entries(data).map(([k, v]) => [k, String(v ?? '')])
          ),
        },
        tokens,
      };
      const response = await admin.messaging().sendEachForMulticast(fcmMessage);
      const staleTokens = [];
      response.responses.forEach((r, i) => {
        if (!r.success) {
          console.error(`[NotificationService] FCM failed token=${tokens[i]}:`, r.error?.message);
          // "registration-token-not-registered" and "invalid-registration-token"
          // mean the token is permanently invalid — clear it from the DB.
          const code = r.error?.code ?? '';
          if (
            code === 'messaging/registration-token-not-registered' ||
            code === 'messaging/invalid-registration-token'
          ) {
            staleTokens.push(tokens[i]);
          }
        }
      });
      if (staleTokens.length > 0) {
        await User.update(
          { fcmToken: null },
          { where: { fcmToken: staleTokens } }
        ).catch((e) =>
          console.error('[NotificationService] Failed to clear stale tokens:', e.message)
        );
        console.log(`[NotificationService] Cleared ${staleTokens.length} stale FCM token(s)`);
      }
    }

  } catch (err) {
    console.error('[NotificationService] notify() error:', err.message);
    // Intentionally swallowed — approval flow must not be blocked
  }
}

module.exports = { notify };
