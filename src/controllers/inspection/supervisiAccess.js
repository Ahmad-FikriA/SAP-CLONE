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
const SUPERVISI_EXECUTOR_NAMES_BY_GROUP_KEY = {
  [SUPERVISI_GROUP_KEY_PERPIPAAN]: ["Deni Yuniardi", "Yoyon Sutrisno"],
  [SUPERVISI_GROUP_KEY_MEKATRONIK]: ["Ibrohim", "Agus Miftakh"],
  [SUPERVISI_GROUP_KEY_INSPEKSI]: ["Rangga Pramana Putra", "Usep Supriatna"],
};

function normalizeNik(value) {
  return String(value || "").trim();
}

function normalizeName(value) {
  return String(value || "").trim().toLowerCase();
}

function normalizeGroup(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z]/g, "");
}

function getSupervisiGroupKey(value) {
  const normalized = normalizeGroup(value);
  if (!normalized) return null;

  if (normalized.includes("sipil") || normalized.includes("perpipaan")) {
    return SUPERVISI_GROUP_KEY_PERPIPAAN;
  }

  if (
    normalized.includes("mekan") ||
    normalized.includes("elektrik") ||
    normalized.includes("instrumen")
  ) {
    return SUPERVISI_GROUP_KEY_MEKATRONIK;
  }

  if (normalized.includes("inspeksi")) {
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

function getDefaultSupervisiPersonnelGroups() {
  return Object.entries(SUPERVISI_EXECUTOR_NAMES_BY_GROUP_KEY).map(
    ([key, names]) => ({
      group: SUPERVISI_GROUP_LABEL_BY_KEY[key],
      users: names.map((name) => ({ name, source: "default" })),
    })
  );
}

function getAllowedExecutorNamesForGroup(groupName) {
  const groupKey = getSupervisiGroupKey(groupName);
  return SUPERVISI_EXECUTOR_NAMES_BY_GROUP_KEY[groupKey] || [];
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

  const user = await User.findOne({ where: { name } });
  if (user && buildAccessProfile(user).flags.isSupervisiExecutor) {
    return true;
  }

  // Fallback: cek di daftar hardcoded executor
  const nameLower = name.toLowerCase();
  for (const names of Object.values(SUPERVISI_EXECUTOR_NAMES_BY_GROUP_KEY)) {
    if (names.some((n) => n.toLowerCase() === nameLower)) return true;
  }
  return false;
}

async function isAllowedExecutorForGroup(groupName, value) {
  const name = String(value || "").trim();
  const requestedGroupKey = getSupervisiGroupKey(groupName);
  if (!name || !requestedGroupKey) return false;

  // Cek di database dulu
  const user = await User.findOne({
    where: { name },
  });
  if (user && buildAccessProfile(user).flags.isSupervisiExecutor) {
    const userGroupKey = getSupervisiGroupKey(user.group);
    return !userGroupKey || userGroupKey === requestedGroupKey;
  }

  // Fallback: cek di daftar hardcoded executor per group
  const allowedNames = SUPERVISI_EXECUTOR_NAMES_BY_GROUP_KEY[requestedGroupKey] || [];
  const nameLower = name.toLowerCase();
  return allowedNames.some((n) => n.toLowerCase() === nameLower);
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
  getDefaultSupervisiPersonnelGroups,
  normalizeSupervisiGroupLabel,
  getAllowedExecutorNamesForGroup,
  isAllowedExecutorName,
  isAllowedExecutorForGroup,
  canAccessSupervisiJob,
  forbiddenMessage,
};
