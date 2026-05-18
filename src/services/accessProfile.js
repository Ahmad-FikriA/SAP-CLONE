"use strict";

const APP_ROLE_MODULES = {
  teknisi: ["preventive", "corrective", "inspection", "supervisi", "k3_safety"],
  petugas: ["preventive", "corrective", "inspection", "supervisi", "k3_safety"],
  kasie: [
    "preventive",
    "corrective",
    "inspection",
    "supervisi",
    "k3_safety",
    "qr_generator",
    "pin_equipment",
  ],
  kadis: ["preventive", "corrective", "inspection", "supervisi", "k3_safety"],
  kadiv: [
    "preventive",
    "corrective",
    "inspection",
    "supervisi",
    "k3_safety",
    "qr_generator",
    "pin_equipment",
  ],
};

const CUSTOMIZABLE_APP_MODULES = [
  "preventive",
  "corrective",
  "inspection",
  "supervisi",
  "k3_safety",
];

const EXECUTOR_APP_ROLES = new Set(["kasie", "petugas", "teknisi"]);

function containsText(value, needle) {
  return String(value || "").toLowerCase().includes(needle);
}

function hasInspectionText(value) {
  return containsText(value, "inpeksi") || containsText(value, "inspeksi");
}

function parseAppRole(roleStr) {
  const role = String(roleStr || "").toLowerCase().trim();
  if (role === "teknisi") return "teknisi";
  if (role === "petugas") return "petugas";
  if (["kasie", "kepala_seksi", "kepala seksi", "supervisor", "planner"].includes(role)) {
    return "kasie";
  }
  if (["kadis", "kepala_dinas", "kepala dinas", "kadis_pusat"].includes(role)) {
    return "kadis";
  }
  if (["kadiv", "kepala_divisi", "kepala divisi", "admin"].includes(role)) {
    return "kadiv";
  }
  return "teknisi";
}

function getAppModuleOverrides(permissions) {
  const appPermissions = permissions && permissions._app;
  if (!appPermissions || typeof appPermissions !== "object" || Array.isArray(appPermissions)) {
    return null;
  }
  return appPermissions;
}

function resolveAppModules(role, permissions) {
  const modules = new Set(APP_ROLE_MODULES[role] || APP_ROLE_MODULES.teknisi);
  const appOverrides = getAppModuleOverrides(permissions);
  if (!appOverrides) return modules;

  for (const moduleKey of CUSTOMIZABLE_APP_MODULES) {
    if (appOverrides[moduleKey] === false) {
      modules.delete(moduleKey);
    } else if (appOverrides[moduleKey] === true) {
      modules.add(moduleKey);
    }
  }

  return modules;
}

function buildAccessProfile(user) {
  const rawRole = String((user && user.role) || "").toLowerCase().trim();
  const isAdmin = rawRole === "admin";
  const role = parseAppRole(user && user.role);
  const permissions = user && user.permissions;
  const dinas = String((user && user.dinas) || "");
  const divisi = String((user && user.divisi) || "");
  const group = String((user && user.group) || "");

  const inDinasInspeksiRaw = hasInspectionText(dinas);
  const inGroupInspeksiRaw = hasInspectionText(group);
  const inDinasSupervisiRaw =
    containsText(dinas, "supervisi") || containsText(group, "supervisi");
  const isDinasPerawatan = containsText(dinas, "perawatan");
  const isPlanner = containsText(group, "perencanaan");
  const isKadisPP =
    role === "kadis" &&
    (containsText(dinas, "pusat perawatan") ||
      containsText(group, "pusat perawatan"));

  const isDinasHSE = containsText(dinas, "hse") || containsText(group, "hse");
  const isKadisHSE = role === "kadis" && isDinasHSE;
  const isKadivPPHSE =
    role === "kadiv" &&
    (containsText(divisi, "pphse") ||
      (containsText(divisi, "pusat perawatan") && containsText(divisi, "hse")));
  const isInspectionAuthorityUnit =
    inDinasInspeksiRaw || inGroupInspeksiRaw || isDinasHSE;
  const isSupervisiOperationalUnit =
    inDinasInspeksiRaw || inGroupInspeksiRaw || inDinasSupervisiRaw;

  const modules = resolveAppModules(role, permissions);
  const canAccessInspection = modules.has("inspection");
  const hasSupervisiModule = modules.has("supervisi");
  const canAccessSupervisi =
    hasSupervisiModule &&
    (isAdmin || isKadivPPHSE || isSupervisiOperationalUnit);

  if (!canAccessSupervisi) {
    modules.delete("supervisi");
  }

  const isSupervisiScheduler =
    canAccessSupervisi &&
    (isAdmin || (role === "kadis" && isSupervisiOperationalUnit));
  const isSupervisiMonitor =
    canAccessSupervisi && (isAdmin || (role === "kadiv" && isKadivPPHSE));
  const isSupervisiDenied = hasSupervisiModule && !canAccessSupervisi;
  const isSupervisiGroup =
    canAccessSupervisi &&
    EXECUTOR_APP_ROLES.has(role) &&
    isSupervisiOperationalUnit;
  const isSupervisiExecutor =
    canAccessSupervisi &&
    EXECUTOR_APP_ROLES.has(role) &&
    isSupervisiOperationalUnit;

  const hasInspectionRoleOverride = false;
  const canReviewInspection =
    canAccessInspection && role === "kadis" && isInspectionAuthorityUnit;
  const isInspectionApprover = canReviewInspection;
  const isInspectionExecutor =
    canAccessInspection &&
    EXECUTOR_APP_ROLES.has(role) &&
    isInspectionAuthorityUnit;
  const isInspectionPlanner = canReviewInspection;
  const isInspectionMonitor = canAccessInspection && (isAdmin || role === "kadiv");
  const isInspectionPerawatan = canAccessInspection && !isInspectionExecutor && isDinasPerawatan;
  const isDinasInspeksi = !isInspectionExecutor && inDinasInspeksiRaw;

  return {
    appRole: role,
    modules: Array.from(modules),
    flags: {
      isPlanner,
      isKadisPP,
      isDinasHSE,
      isDinasInspeksi,
      isKadisHSE,
      isKadivPPHSE,
      canAccessInspection,
      isSupervisiScheduler,
      isSupervisiMonitor,
      isSupervisiDenied,
      isSupervisiGroup,
      isSupervisiExecutor,
      canAccessSupervisi,
      canManageSupervisiJobs: isSupervisiScheduler,
      canSubmitSupervisiVisit: isSupervisiExecutor,
      hasInspectionRoleOverride,
      isInspectionApprover,
      isInspectionExecutor,
      isInspectionPlanner,
      isInspectionMonitor,
      isInspectionPerawatan,
    },
  };
}

function applyWebPermissionsToAccessProfile(accessProfile, permissions) {
  void permissions;
  // Web CRUD permissions are display controls only. App/API capability stays
  // in buildAccessProfile, which reads the dedicated permissions._app slice.
  return accessProfile;
}

module.exports = {
  buildAccessProfile,
  parseAppRole,
  applyWebPermissionsToAccessProfile,
  getAppModuleOverrides,
};
