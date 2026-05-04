"use strict";

const SUPERVISI_SCHEDULER_NIK = "10000262";
const SUPERVISI_MONITOR_NIK = "10000191";
const INSPECTION_APPROVAL_NIK = "10000262";
const INSPECTION_PLANNER_NIK = "10000262";
const INSPECTION_EXECUTOR_NIK_1 = "10000375";
const INSPECTION_EXECUTOR_NIK_2 = "10000275";
const INSPECTION_MONITOR_NIK = "10000191";

const SUPERVISI_DENIED_NIKS = new Set([
  // Kosong — Rangga & Usep kini diizinkan akses supervisi.
]);

// Nama-nama executor yang di-whitelist untuk supervisi meskipun
// group DB-nya bukan group supervisi (misal: group "Inspeksi").
const SUPERVISI_WHITELISTED_NAMES = new Set([
  "rangga pramana putra",
  "usep supriatna",
]);

const INSPECTION_ROLE_OVERRIDE_NIKS = new Set([
  INSPECTION_APPROVAL_NIK,
  INSPECTION_PLANNER_NIK,
  INSPECTION_EXECUTOR_NIK_1,
  INSPECTION_EXECUTOR_NIK_2,
  INSPECTION_MONITOR_NIK,
]);

const APP_ROLE_MODULES = {
  teknisi: ["preventive", "corrective", "inspection", "k3_safety"],
  petugas: ["preventive", "corrective", "inspection", "k3_safety"],
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

function normalizeNik(value) {
  return String(value || "").trim();
}

function containsText(value, needle) {
  return String(value || "").toLowerCase().includes(needle);
}

function normalizeGroup(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z]/g, "");
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

function buildAccessProfile(user) {
  const nik = normalizeNik(user && user.nik);
  const role = parseAppRole(user && user.role);
  const dinas = String((user && user.dinas) || "");
  const divisi = String((user && user.divisi) || "");
  const group = String((user && user.group) || "");

  const inDinasInspeksiRaw =
    containsText(dinas, "inpeksi") || containsText(dinas, "inspeksi");
  const inGroupInspeksiRaw =
    containsText(group, "inpeksi") || containsText(group, "inspeksi");

  const isTeknisiType = role === "teknisi" || role === "petugas";
  const isDinasPerawatan = containsText(dinas, "perawatan");
  const isPlanner = containsText(group, "perencanaan");
  const isKadisPP =
    role === "kadis" &&
    (containsText(dinas, "pusat perawatan") ||
      containsText(group, "pusat perawatan") ||
      containsText(divisi, "pusat perawatan"));

  const isDinasHSE = containsText(dinas, "hse") || containsText(group, "hse");
  const isKadisHSE =
    role === "kadis" &&
    (containsText(dinas, "hse") || containsText(divisi, "hse") || containsText(group, "hse"));
  const isKadivPPHSE = role === "kadiv" && containsText(divisi, "pphse");

  const normalizedGroup = normalizeGroup(group);
  const isSupervisiScheduler = nik === SUPERVISI_SCHEDULER_NIK;
  const isSupervisiMonitor = nik === SUPERVISI_MONITOR_NIK;
  const isSupervisiDenied = SUPERVISI_DENIED_NIKS.has(nik);
  const userName = String((user && user.name) || "").trim().toLowerCase();
  const isSupervisiGroup = !isSupervisiDenied &&
    (normalizedGroup.includes("supervisi") || SUPERVISI_WHITELISTED_NAMES.has(userName));
  const isSupervisiExecutor =
    !isSupervisiScheduler && !isSupervisiMonitor && isSupervisiGroup;
  const canAccessSupervisi =
    !isSupervisiDenied && (isSupervisiScheduler || isSupervisiExecutor || isSupervisiMonitor);

  const hasInspectionRoleOverride = INSPECTION_ROLE_OVERRIDE_NIKS.has(nik);
  const isInspectionApprover =
    nik === INSPECTION_APPROVAL_NIK || (role === "kadis" && inDinasInspeksiRaw);
  const isInspectionExecutor =
    nik === INSPECTION_EXECUTOR_NIK_1 || nik === INSPECTION_EXECUTOR_NIK_2 ||
    (isTeknisiType && inDinasInspeksiRaw && inGroupInspeksiRaw);
  const isInspectionPlanner =
    nik !== INSPECTION_EXECUTOR_NIK_1 &&
    nik !== INSPECTION_EXECUTOR_NIK_2 &&
    (nik === INSPECTION_PLANNER_NIK ||
      (role === "kasie" && inDinasInspeksiRaw && inGroupInspeksiRaw));
  const isInspectionMonitor = nik === INSPECTION_MONITOR_NIK || role === "kadiv";
  const isInspectionPerawatan = !hasInspectionRoleOverride && isDinasPerawatan;
  const isDinasInspeksi = !isInspectionExecutor && inDinasInspeksiRaw;

  const modules = new Set(APP_ROLE_MODULES[role] || APP_ROLE_MODULES.teknisi);
  if (canAccessSupervisi) {
    modules.add("supervisi");
  }

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

module.exports = {
  buildAccessProfile,
  parseAppRole,
};
