"use strict";

const User = require("../../models/User");

const SUPERVISI_SCHEDULER_NIKS = new Set(["10000262"]);
const SUPERVISI_MONITOR_NIKS = new Set(["10000191"]);
const SUPERVISI_GROUP_PERPIPAAN = "Group supervisi Sipil dan Perpipaan";
const SUPERVISI_GROUP_MEKATRONIK = "Group supervisi Mekanikal Elektrik dan Instrumen";
const SUPERVISI_GROUP_KEY_PERPIPAAN = "sipil_perpipaan";
const SUPERVISI_GROUP_KEY_MEKATRONIK = "mekanikal_elektrik_instrumen";
const SUPERVISI_EXECUTOR_NAMES_BY_GROUP_KEY = {
  [SUPERVISI_GROUP_KEY_PERPIPAAN]: ["Deni Yuniardi", "Yoyon Sutrisno"],
  [SUPERVISI_GROUP_KEY_MEKATRONIK]: ["Ibrohim", "Agus Miftakh"],
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

  return String(value || "").trim() || null;
}

function getAllowedExecutorNamesForGroup(groupName) {
  const groupKey = getSupervisiGroupKey(groupName);
  return SUPERVISI_EXECUTOR_NAMES_BY_GROUP_KEY[groupKey] || [];
}

function getSupervisiAccess(user) {
  const nik = normalizeNik(user && user.nik);
  const displayName = String(user && user.name ? user.name : "").trim();

  if (SUPERVISI_SCHEDULER_NIKS.has(nik)) {
    return { kind: "scheduler", nik, displayName };
  }

  if (SUPERVISI_MONITOR_NIKS.has(nik)) {
    return { kind: "monitor", nik, displayName };
  }

  if (isSupervisiGroup(user && user.group)) {
    return { kind: "executor", nik, displayName };
  }

  return { kind: "none", nik, displayName };
}

function hasSupervisiAccess(user) {
  return getSupervisiAccess(user).kind !== "none";
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
  if (!user) return false;

  return isSupervisiGroup(user.group);
}

async function isAllowedExecutorForGroup(groupName, value) {
  const name = String(value || "").trim();
  const requestedGroupKey = getSupervisiGroupKey(groupName);
  if (!name || !requestedGroupKey) return false;

  const user = await User.findOne({
    where: { name },
    attributes: ["group"],
  });
  if (!user || !isSupervisiGroup(user.group)) {
    return false;
  }

  const userGroupKey = getSupervisiGroupKey(user.group);
  return userGroupKey === requestedGroupKey;
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
