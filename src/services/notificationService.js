'use strict';

const admin = require('firebase-admin');
const path = require('path');

// Initialize firebase-admin once (lazy)
let initialized = false;

function ensureInitialized() {
  if (!initialized) {
    const serviceAccount = require(
      path.resolve(__dirname, '../config/serviceAccountKey.json')
    );
    admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
    initialized = true;
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
 * @param {string[]} opts.recipientIds  User IDs (STRING) to notify
 */
async function notify({ module, type, title, body, data = {}, recipientIds = [] }) {
  if (recipientIds.length === 0) return;

  try {
    ensureInitialized();
    const { User, PushNotification } = getModels();
    const { Op } = require('sequelize');

    // 1. Look up FCM tokens for all recipients
    const users = await User.findAll({
      where: { id: { [Op.in]: recipientIds } },
      attributes: ['id', 'fcmToken'],
    });

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

    // 3. Persist one row per recipient (even those without FCM token)
    await PushNotification.bulkCreate(
      recipientIds.map((recipientId) => ({
        module,
        type,
        title,
        body,
        data,
        recipientId,
        isRead: false,
      }))
    );
  } catch (err) {
    console.error('[NotificationService] notify() error:', err.message);
    // Intentionally swallowed — approval flow must not be blocked
  }
}

module.exports = { notify };
