"use strict";

const User = require("../../models/User");

const SUPERVISI_SCHEDULER_NIKS = new Set(["10000262"]);
const SUPERVISI_MONITOR_NIKS = new Set(["10000191"]);
const SUPERVISI_GROUP_PERPIPAAN = "Group supervisi Sipil dan Perpipaan";
const SUPERVISI_GROUP_MEKATRONIK = "Group supervisi Mekanikal Elektrik dan Instrumen";
const SUPERVISI_GROUP_INSPEKSI = "Group inspeksi";
const SUPERVISI_GROUP_KEY_PERPIPAAN = "sipil_perpipaan";
const SUPERVISI_GROUP_KEY_MEKATRONIK = "mekanikal_elektrik_instrumen";
const SUPERVISI_GROUP_KEY_INSPEKSI = "inspeksi";
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

function isSupervisiGroup(value) {
  return normalizeGroup(value).includes("supervisi");
}

/**
 * Cek apakah nama user terdaftar di whitelist executor supervisi.
 * Ini memungkinkan user dari group non-supervisi (misal "Inspeksi")
 * untuk tetap bisa mengerjakan job supervisi.
 */
function isWhitelistedSupervisiExecutor(userName) {
  if (!userName) return false;
  const nameLower = String(userName).trim().toLowerCase();
  for (const names of Object.values(SUPERVISI_EXECUTOR_NAMES_BY_GROUP_KEY)) {
    if (names.some((n) => n.toLowerCase() === nameLower)) return true;
  }
  return false;
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

  if (normalizedKey === SUPERVISI_GROUP_KEY_PERPIPAAN) {
    return SUPERVISI_GROUP_PERPIPAAN;
  }

  if (normalizedKey === SUPERVISI_GROUP_KEY_MEKATRONIK) {
    return SUPERVISI_GROUP_MEKATRONIK;
  }

  if (normalizedKey === SUPERVISI_GROUP_KEY_INSPEKSI) {
    return SUPERVISI_GROUP_INSPEKSI;
  }

  return String(value || "").trim() || null;
}

function getAllowedExecutorNamesForGroup(groupName) {
  const groupKey = getSupervisiGroupKey(groupName);
  return SUPERVISI_EXECUTOR_NAMES_BY_GROUP_KEY[groupKey] || [];
}

function isAdminUser(user) {
  return String(user && user.role ? user.role : "").toLowerCase() === "admin";
}

function getSupervisiAccess(user) {
  const nik = normalizeNik(user && user.nik);
  const displayName = String(user && user.name ? user.name : "").trim();

  // Admin memiliki akses penuh (seperti monitor) ke semua data supervisi
  if (isAdminUser(user)) {
    return { kind: "monitor", nik, displayName };
  }

  // Jika user diberi akses baca ("R") melalui fitur manajemen user di web
  // Catatan: di frontend, permissions === null dianggap "unrestricted" (bebas akses)
  if (user && (user.permissions === null || (user.permissions && Array.isArray(user.permissions.supervisi) && user.permissions.supervisi.includes("R")))) {
    return { kind: "monitor", nik, displayName };
  }

  if (SUPERVISI_SCHEDULER_NIKS.has(nik)) {
    return { kind: "scheduler", nik, displayName };
  }

  if (SUPERVISI_MONITOR_NIKS.has(nik)) {
    return { kind: "monitor", nik, displayName };
  }

  if (isSupervisiGroup(user && user.group)) {
    return { kind: "executor", nik, displayName };
  }

  // User dari group lain (misal "Inspeksi") yang di-whitelist sebagai executor supervisi
  if (isWhitelistedSupervisiExecutor(displayName)) {
    return { kind: "executor", nik, displayName };
  }

  return { kind: "none", nik, displayName };
}

function hasSupervisiAccess(user) {
  return getSupervisiAccess(user).kind !== "none";
}

function isSupervisiScheduler(user) {
  // Admin juga bisa mengelola job seperti scheduler
  if (isAdminUser(user)) return true;
  return getSupervisiAccess(user).kind === "scheduler";
}

function isSupervisiExecutor(user) {
  return getSupervisiAccess(user).kind === "executor";
}

async function isAllowedExecutorName(value) {
  const name = String(value || "").trim();
  if (!name) return false;

  const user = await User.findOne({ where: { name } });
  if (user && isSupervisiGroup(user.group)) {
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
    attributes: ["group"],
  });
  if (user && isSupervisiGroup(user.group)) {
    const userGroupKey = getSupervisiGroupKey(user.group);
    return userGroupKey === requestedGroupKey;
  }

  // Fallback: cek di daftar hardcoded executor per group
  const allowedNames = SUPERVISI_EXECUTOR_NAMES_BY_GROUP_KEY[requestedGroupKey] || [];
  const nameLower = name.toLowerCase();
  return allowedNames.some((n) => n.toLowerCase() === nameLower);
}

function canAccessSupervisiJob(user, job) {
  const access = getSupervisiAccess(user);

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
  normalizeSupervisiGroupLabel,
  getAllowedExecutorNamesForGroup,
  isAllowedExecutorName,
  isAllowedExecutorForGroup,
  canAccessSupervisiJob,
  forbiddenMessage,
};
