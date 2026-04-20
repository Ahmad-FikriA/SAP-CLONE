"use strict";

const User = require("../../models/User");

const SUPERVISI_SCHEDULER_NIKS = new Set(["10000262"]);
const SUPERVISI_MONITOR_NIKS = new Set(["10000191"]);
const SUPERVISI_GROUP_PERPIPAAN = "Group supervisi Sipil dan Perpipaan";
const SUPERVISI_GROUP_MEKATRONIK = "Group supervisi Mekanikal Elektrik dan Instrumen";
const SUPERVISI_EXECUTOR_NAMES_BY_GROUP = {
  [SUPERVISI_GROUP_PERPIPAAN]: ["Ibrohim", "Agus Miftakh"],
  [SUPERVISI_GROUP_MEKATRONIK]: ["Deni Yuniardi", "Yoyon Sutrisno"],
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

function normalizeSupervisiGroupLabel(value) {
  const normalized = String(value || "").trim().toLowerCase();
  if (!normalized) return null;

  if (
    normalized === "group supervisi sipil dan perpipaan" ||
    normalized === "group supervisi sipil dan perpipaan"
  ) {
    return SUPERVISI_GROUP_PERPIPAAN;
  }

  if (
    normalized === "group supervisi mekanikal elektrik dan instrumen" ||
    normalized === "group supervisi mekanikal elektrik dan instrumen"
  ) {
    return SUPERVISI_GROUP_MEKATRONIK;
  }

  return String(value || "").trim() || null;
}

function getAllowedExecutorNamesForGroup(groupName) {
  const normalizedGroup = normalizeSupervisiGroupLabel(groupName);
  return SUPERVISI_EXECUTOR_NAMES_BY_GROUP[normalizedGroup] || [];
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
  if (!name) return false;

  const allowedNames = getAllowedExecutorNamesForGroup(groupName);
  if (!allowedNames.some((item) => normalizeName(item) === normalizeName(name))) {
    return false;
  }

  return true;
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
