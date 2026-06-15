"use strict";

const User = require("../../models/User");
const { buildAccessProfile } = require("../../services/accessProfile");

const SUPERVISI_GROUP_PERPIPAAN = "Group supervisi Sipil dan Perpipaan";
const SUPERVISI_GROUP_MEKATRONIK = "Group supervisi Mekanikal Elektrik dan Instrumen";
const SUPERVISI_GROUP_INSPEKSI = "Group inspeksi";
const SUPERVISI_GROUP_KEY_PERPIPAAN = "sipil_perpipaan";
const SUPERVISI_GROUP_KEY_MEKATRONIK = "mekanikal_elektrik_instrumen";
const SUPERVISI_GROUP_KEY_INSPEKSI = "inspeksi";
const SUPERVISI_GROUP_LABEL_BY_KEY = {
  [SUPERVISI_GROUP_KEY_PERPIPAAN]: SUPERVISI_GROUP_PERPIPAAN,
  [SUPERVISI_GROUP_KEY_MEKATRONIK]: SUPERVISI_GROUP_MEKATRONIK,
  [SUPERVISI_GROUP_KEY_INSPEKSI]: SUPERVISI_GROUP_INSPEKSI,
};

function normalizeNik(value) {
  return String(value || "").trim();
}

function normalizeName(value) {
  return normalizeComparableText(value);
}

function normalizeComparableText(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/&/g, "dan")
    .replace(/[^a-z0-9]/g, "");
}

function normalizeGroup(value) {
  return normalizeComparableText(value).replace(/^group/, "");
}

function getSupervisiGroupKey(value) {
  const normalized = normalizeGroup(value);
  if (!normalized) return null;

  if (normalized === normalizeGroup(SUPERVISI_GROUP_PERPIPAAN)) {
    return SUPERVISI_GROUP_KEY_PERPIPAAN;
  }

  if (normalized === normalizeGroup(SUPERVISI_GROUP_MEKATRONIK)) {
    return SUPERVISI_GROUP_KEY_MEKATRONIK;
  }

  if (normalized === normalizeGroup(SUPERVISI_GROUP_INSPEKSI)) {
    return SUPERVISI_GROUP_KEY_INSPEKSI;
  }

  return null;
}

function normalizeSupervisiGroupLabel(value) {
  const normalizedKey = getSupervisiGroupKey(value);
  if (!normalizedKey) {
    const trimmed = String(value || "").trim();
    return trimmed || null;
  }

  return SUPERVISI_GROUP_LABEL_BY_KEY[normalizedKey] ||
    String(value || "").trim() ||
    null;
}

function getKnownSupervisiGroups() {
  return [
    SUPERVISI_GROUP_PERPIPAAN,
    SUPERVISI_GROUP_MEKATRONIK,
    SUPERVISI_GROUP_INSPEKSI,
  ];
}

function getAllowedExecutorNamesForGroup(groupName) {
  void groupName;
  return [];
}

function hasWebReadSupervisiPermission(user) {
  const permissions = user && user.permissions;
  if (!permissions || typeof permissions !== "object" || Array.isArray(permissions)) {
    return false;
  }
  return Array.isArray(permissions.supervisi) && permissions.supervisi.includes("R");
}

function getSupervisiAccess(user, options = {}) {
  const allowWebPermissionRead = Boolean(options && options.allowWebPermissionRead);
  const nik = normalizeNik(user && user.nik);
  const displayName = String(user && user.name ? user.name : "").trim();
  const profile = buildAccessProfile(user || {});
  const flags = profile.flags || {};

  if (flags.isSupervisiScheduler) {
    return { kind: "scheduler", nik, displayName };
  }

  if (flags.isSupervisiMonitor) {
    return { kind: "monitor", nik, displayName };
  }

  if (flags.isSupervisiExecutor) {
    return { kind: "executor", nik, displayName };
  }

  // Khusus web: user yang diberi akses baca supervisi dapat monitoring (read-only).
  // Tidak dipakai untuk app/mobile agar role operasional tetap ketat.
  if (allowWebPermissionRead && hasWebReadSupervisiPermission(user)) {
    return { kind: "monitor", nik, displayName };
  }

  return { kind: "none", nik, displayName };
}

function hasSupervisiAccess(user, options = {}) {
  return getSupervisiAccess(user, options).kind !== "none";
}

function isSupervisiScheduler(user) {

  return getSupervisiAccess(user).kind === "scheduler";
}

function isSupervisiExecutor(user) {
  return getSupervisiAccess(user).kind === "executor";
}

async function isAllowedExecutorName(value) {
  const name = String(value || "").trim();
  if (!name) return false;

  const users = await User.findAll({
    attributes: [
      "id",
      "nik",
      "name",
      "role",
      "dinas",
      "divisi",
      "group",
      "permissions",
    ],
  });
  return users.some((user) => {
    const plain = typeof user.toJSON === "function" ? user.toJSON() : user;
    return normalizeName(plain.name) === normalizeName(name) &&
      buildAccessProfile(plain).flags.isSupervisiExecutor;
  });
}

async function isAllowedExecutorForGroup(groupName, value) {
  const name = String(value || "").trim();
  const requestedGroupKey = getSupervisiGroupKey(groupName);
  if (!name || !requestedGroupKey) return false;

  const users = await User.findAll({
    attributes: [
      "id",
      "nik",
      "name",
      "role",
      "dinas",
      "divisi",
      "group",
      "permissions",
    ],
  });
  return users.some((user) => {
    const plain = typeof user.toJSON === "function" ? user.toJSON() : user;
    return normalizeName(plain.name) === normalizeName(name) &&
      buildAccessProfile(plain).flags.isSupervisiExecutor &&
      getSupervisiGroupKey(plain.group) === requestedGroupKey;
  });
}

function canAccessSupervisiJob(user, job, options = {}) {
  const access = getSupervisiAccess(user, options);

  if (access.kind === "scheduler" || access.kind === "monitor") {
    return true;
  }

  if (access.kind !== "executor") {
    return false;
  }

  return normalizeName(job && job.picSupervisi) ===
    normalizeName(access.displayName);
}

function forbiddenMessage() {
  return "Anda tidak memiliki akses ke modul supervisi.";
}

module.exports = {
  getSupervisiAccess,
  hasSupervisiAccess,
  isSupervisiScheduler,
  isSupervisiExecutor,
  getKnownSupervisiGroups,
  normalizeSupervisiGroupLabel,
  getAllowedExecutorNamesForGroup,
  isAllowedExecutorName,
  isAllowedExecutorForGroup,
  canAccessSupervisiJob,
  forbiddenMessage,
};
