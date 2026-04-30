"use strict";

const admin = require("firebase-admin");
const fs = require("fs");
const path = require("path");

const serviceAccountPath = path.resolve(
  __dirname,
  "../config/serviceAccountKey.json",
);

let initialized = false;
let initializationFailed = false;

function ensureInitialized() {
  if (initialized) return true;
  if (initializationFailed) return false;
  try {
    if (fs.existsSync(serviceAccountPath)) {
      const serviceAccount = require(serviceAccountPath);
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
      });
    } else {
      admin.initializeApp({
        credential: admin.credential.applicationDefault(),
      });
      console.warn(
        "[NotificationService] serviceAccountKey.json not found, trying application default credentials for FCM.",
      );
    }

    initialized = true;
    return true;
  } catch (error) {
    initializationFailed = true;
    console.warn(
      `[NotificationService] FCM initialization unavailable, skipping push delivery: ${error.message}`,
    );
    return false;
  }
}

let _User, _PushNotification;
function getModels() {
  if (!_User) {
    _User = require("../models/User");
    _PushNotification = require("../models/PushNotification");
  }
  return { User: _User, PushNotification: _PushNotification };
}

async function notify({
  module,
  type,
  title,
  body,
  data = {},
  recipientIds = [],
  targetNik,
  targetId,
}) {
  if (!type && data.type) type = data.type;

  let ids = [];
  if (Array.isArray(recipientIds)) {
    ids = [...recipientIds];
  } else if (recipientIds) {
    ids = [recipientIds];
  }

  if (targetNik) ids.push(targetNik);
  if (targetId) ids.push(targetId);

  const normalizedRecipientIds = ids
    .map((id) => String(id ?? "").trim())
    .filter((id) => id.length > 0);

  if (normalizedRecipientIds.length === 0) return;

  const { User, PushNotification } = getModels();

  try {
    const { Op } = require("sequelize");

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
        })),
      );
    } catch (err) {
      console.error(
        "[NotificationService] Failed to persist notification:",
        err.message,
      );
    }

    if (!ensureInitialized()) return;

    const tokens = users.filter((u) => u.fcmToken).map((u) => u.fcmToken);

    if (tokens.length > 0) {
      const fcmMessage = {
        notification: { title, body },
        data: {
          module,
          type,
          ...Object.fromEntries(
            Object.entries(data).map(([k, v]) => [k, String(v ?? "")]),
          ),
        },
        tokens,
      };
      const response = await admin.messaging().sendEachForMulticast(fcmMessage);
      const staleTokens = [];
      response.responses.forEach((r, i) => {
        if (!r.success) {
          console.error(
            `[NotificationService] FCM failed token=${tokens[i]}:`,
            r.error?.message,
          );
          const code = r.error?.code ?? "";
          if (
            code === "messaging/registration-token-not-registered" ||
            code === "messaging/invalid-registration-token"
          ) {
            staleTokens.push(tokens[i]);
          }
        }
      });
      if (staleTokens.length > 0) {
        await User.update(
          { fcmToken: null },
          { where: { fcmToken: staleTokens } },
        ).catch((e) =>
          console.error(
            "[NotificationService] Failed to clear stale tokens:",
            e.message,
          ),
        );
        console.log(
          `[NotificationService] Cleared ${staleTokens.length} stale FCM token(s)`,
        );
      }
    }
  } catch (err) {
    console.error("[NotificationService] notify() error:", err.message);
  }
}

module.exports = { notify };
