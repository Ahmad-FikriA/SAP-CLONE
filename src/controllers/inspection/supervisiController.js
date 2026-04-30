"use strict";

const path = require("path");
const fs = require("fs");
const multer = require("multer");
const { Op } = require("sequelize");
const SupervisiJob = require("../../models/SupervisiJob");
const SupervisiVisit = require("../../models/SupervisiVisit");
const SupervisiAmend = require("../../models/SupervisiAmend");
const User = require("../../models/User");
const NotificationService = require("../../services/notificationService");
const {
  getSupervisiAccess,
  hasSupervisiAccess,
  isSupervisiScheduler,
  isSupervisiExecutor,
  normalizeSupervisiGroupLabel,
  isAllowedExecutorForGroup,
  canAccessSupervisiJob,
  forbiddenMessage,
} = require("./supervisiAccess");

// ── Haversine distance (metres) ───────────────────────────────────────────────
function haversineMetres(lat1, lon1, lat2, lon2) {
  const R = 6371000; // Earth radius in metres
  const toRad = (v) => (v * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

const GEOFENCE_RADIUS_METRES = 200;

// ── File upload config ────────────────────────────────────────────────────────
const uploadDir = path.join(__dirname, "../../../uploads/supervisi");
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `sv_${Date.now()}_${Math.random().toString(36).slice(2)}${ext}`);
  },
});
const upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 }, // 50 MB max per file
});

// Export multer middleware untuk dipakai di routes
const uploadVisitMedia = upload.fields([
  { name: "photos", maxCount: 20 },
  { name: "documents", maxCount: 5 }
]);
const uploadJobAmendDocuments = upload.fields([
  { name: "amendDocuments", maxCount: 10 },
]);

function hasOwn(obj, key) {
  return Object.prototype.hasOwnProperty.call(obj, key);
}

function normalizeNullableString(value) {
  if (value === undefined || value === null) return null;
  const text = String(value).trim();
  return text.length > 0 ? text : null;
}

function parseNullableFloat(value) {
  if (value === undefined) return undefined;
  if (value === null || value === "") return null;
  const parsed = parseFloat(value);
  return Number.isNaN(parsed) ? null : parsed;
}

function parseNullableDate(value) {
  if (value === undefined) return undefined;
  if (value === null || value === "") return null;
  return String(value);
}

function parseStringArray(value) {
  if (value === undefined) return undefined;
  if (Array.isArray(value)) {
    return value
      .map((item) => normalizeNullableString(item))
      .filter(Boolean);
  }
  if (value === null || value === "") return [];
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) {
        return parsed
          .map((item) => normalizeNullableString(item))
          .filter(Boolean);
      }
    } catch (_err) {
      return [];
    }
  }
  return [];
}

const SUPERVISI_MONITOR_NIK = "10000191";

function normalizeName(value) {
  return String(value || "").trim().toLowerCase();
}

// ── Name lookup helpers ───────────────────────────────────────────────────────

/**
 * Buat map { nik → name } dari sekumpulan NIK unik.
 * Satu query ke tabel users untuk semua NIK sekaligus.
 */
async function buildNikNameMap(niks) {
  if (!niks || niks.length === 0) return {};
  const uniqueNiks = [...new Set(niks.filter(Boolean))];
  if (uniqueNiks.length === 0) return {};
  try {
    const users = await User.findAll({
      where: { nik: { [Op.in]: uniqueNiks } },
      attributes: ["nik", "name"],
    });
    const map = {};
    for (const u of users) {
      if (u.nik) map[u.nik] = u.name || null;
    }
    return map;
  } catch (_err) {
    return {};
  }
}

/**
 * Tambahkan creatorName ke job plain object, dan submitterName ke setiap visit.
 */
function enrichJobWithNames(jobData, nikNameMap) {
  const obj = typeof jobData.toJSON === "function" ? jobData.toJSON() : { ...jobData };
  // Inject nama pembuat job
  obj.creatorName = nikNameMap[obj.createdBy] || null;
  // Inject nama pengirim visit
  if (Array.isArray(obj.visits)) {
    obj.visits = obj.visits.map((v) => {
      const visit = typeof v.toJSON === "function" ? v.toJSON() : { ...v };
      visit.submitterName = nikNameMap[visit.submittedBy] || null;
      return visit;
    });
  }
  return obj;
}

async function findExecutorRecipientIds(picSupervisi) {
  const targetName = normalizeNullableString(picSupervisi);
  if (!targetName) return [];

  // Prefer exact name match first.
  const exactUsers = await User.findAll({
    where: { name: targetName, group: { [Op.like]: "%supervisi%" } },
    attributes: ["id"],
  });
  if (exactUsers.length > 0) {
    return [...new Set(exactUsers.map((user) => user.id))];
  }

  // Fallback to case-insensitive matching for legacy name casing.
  const fallbackUsers = await User.findAll({
    where: { group: { [Op.like]: "%supervisi%" } },
    attributes: ["id", "name"],
  });
  return [
    ...new Set(
      fallbackUsers
        .filter((user) => normalizeName(user.name) === normalizeName(targetName))
        .map((user) => user.id),
    ),
  ];
}

async function findSupervisorRecipientIds(job) {
  const targetNiks = [
    normalizeNullableString(job && job.createdBy),
    SUPERVISI_MONITOR_NIK,
  ].filter(Boolean);
  if (targetNiks.length === 0) return [];

  const users = await User.findAll({
    where: { nik: { [Op.in]: targetNiks } },
    attributes: ["id"],
  });
  return [...new Set(users.map((user) => user.id))];
}

async function notifyExecutorAssignment(job, { updated = false } = {}) {
  try {
    const recipientIds = await findExecutorRecipientIds(job.picSupervisi);
    if (recipientIds.length === 0) return;

    const title = updated ? "Jadwal Supervisi Diperbarui" : "Jadwal Supervisi Baru";
    const body = updated
      ? `Jadwal ${job.nomorJo || "-"} telah diperbarui dan ditugaskan ke Anda.`
      : `Anda mendapat jadwal supervisi ${job.nomorJo || "-"} (${job.namaKerja || "-"}).`;

    await NotificationService.notify({
      module: "supervisi",
      type: updated ? "job_updated" : "job_assigned",
      title,
      body,
      data: {
        jobId: String(job.id || ""),
        nomorJo: String(job.nomorJo || ""),
        deepLink: "supervisi/dashboard",
      },
      recipientIds,
    });
  } catch (err) {
    console.error("[Supervisi] Failed to notify executor assignment:", err.message);
  }
}

async function notifySupervisorVisitUpdate({ job, visitStatus, visitDate, executorName }) {
  try {
    const recipientIds = await findSupervisorRecipientIds(job);
    if (recipientIds.length === 0) return;

    const isHadir = visitStatus === "hadir";
    await NotificationService.notify({
      module: "supervisi",
      type: isHadir ? "visit_submitted" : "visit_absent",
      title: isHadir ? "Laporan Kunjungan Masuk" : "Ketidakhadiran Supervisi",
      body: isHadir
        ? `${executorName} mengirim laporan kunjungan untuk ${job.nomorJo || "-"}.`
        : `${executorName} melaporkan tidak hadir untuk ${job.nomorJo || "-"}.`,
      data: {
        jobId: String(job.id || ""),
        nomorJo: String(job.nomorJo || ""),
        visitDate: String(visitDate || ""),
        status: String(visitStatus || ""),
        deepLink: "supervisi/dashboard",
      },
      recipientIds,
    });
  } catch (err) {
    console.error("[Supervisi] Failed to notify visit update:", err.message);
  }
}

/**
 * Konversi draft kunjungan yang kedaluwarsa menjadi tidak_hadir (pelanggaran).
 *
 * Draft yang belum di-finalkan hingga pergantian hari dianggap tidak hadir.
 * Fungsi ini dipanggil secara lazy (tanpa cron job) di awal listJobs,
 * getJob, dan submitVisit agar konversi selalu terjadi saat app aktif.
 *
 * @param {number|null} jobId - Jika diisi, hanya konversi draft untuk job tertentu.
 */
async function convertStaleDrafts(jobId = null) {
  const today = new Date().toISOString().split("T")[0]; // YYYY-MM-DD (server UTC)
  const where = {
    isDraft: true,
    visitDate: { [Op.lt]: today },
  };
  if (jobId) where.jobId = parseInt(jobId);
  try {
    const [count] = await SupervisiVisit.update(
      { isDraft: false, status: "tidak_hadir", isPelanggaran: true },
      { where }
    );
    if (count > 0) {
      console.log(`[Supervisi] convertStaleDrafts: ${count} draft kedaluwarsa dikonversi ke tidak_hadir.`);
    }
  } catch (err) {
    console.error("[Supervisi] convertStaleDrafts error:", err.message);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// JOBS
// ─────────────────────────────────────────────────────────────────────────────

// GET /api/inspection/supervisi/jobs
async function listJobs(req, res) {
  try {
    // Konversi draft kedaluwarsa (visitDate < hari ini) → tidak_hadir
    await convertStaleDrafts();

    const access = getSupervisiAccess(req.user);
    if (access.kind === "none") {
      return res.status(403).json({
        success: false,
        message: forbiddenMessage(),
      });
    }

    const where = {};
    if (req.query.status) where.status = req.query.status;
    if (access.kind === "scheduler") {
      where.createdBy = access.nik;
    } else if (access.kind === "executor") {
      where.picSupervisi = access.displayName;
    } else {
      if (req.query.createdBy) where.createdBy = req.query.createdBy;
      if (req.query.picSupervisi) where.picSupervisi = req.query.picSupervisi;
    }

    const jobs = await SupervisiJob.findAll({
      where,
      order: [["waktuMulai", "DESC"]],
      include: [
        { model: SupervisiVisit, as: "visits" },
        { model: SupervisiAmend, as: "amends", order: [["amendMulai", "ASC"]] },
      ],
    });

    // Kumpulkan semua NIK unik (createdBy + semua submittedBy visit)
    const nikSet = new Set();
    for (const job of jobs) {
      if (job.createdBy) nikSet.add(job.createdBy);
      for (const visit of job.visits || []) {
        if (visit.submittedBy) nikSet.add(visit.submittedBy);
      }
    }
    const nikNameMap = await buildNikNameMap([...nikSet]);
    const enrichedJobs = jobs.map((job) => enrichJobWithNames(job, nikNameMap));

    res.json({ success: true, data: enrichedJobs });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}

// GET /api/inspection/supervisi/jobs/:id
async function getJob(req, res) {
  try {
    if (!hasSupervisiAccess(req.user)) {
      return res.status(403).json({
        success: false,
        message: forbiddenMessage(),
      });
    }

    // Konversi draft kedaluwarsa untuk job ini sebelum fetch
    await convertStaleDrafts(parseInt(req.params.id));

    const job = await SupervisiJob.findByPk(req.params.id, {
      include: [
        { model: SupervisiVisit, as: "visits", order: [["visitDate", "ASC"]] },
        { model: SupervisiAmend, as: "amends", order: [["amendMulai", "ASC"]] },
      ],
    });
    if (!job) return res.status(404).json({ success: false, message: "Job tidak ditemukan." });
    if (!canAccessSupervisiJob(req.user, job)) {
      return res.status(403).json({
        success: false,
        message: forbiddenMessage(),
      });
    }

    // Inject nama pembuat dan nama pengirim visit
    const nikSet = new Set();
    if (job.createdBy) nikSet.add(job.createdBy);
    for (const visit of job.visits || []) {
      if (visit.submittedBy) nikSet.add(visit.submittedBy);
    }
    const nikNameMap = await buildNikNameMap([...nikSet]);
    const enrichedJob = enrichJobWithNames(job, nikNameMap);

    res.json({ success: true, data: enrichedJob });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}

// POST /api/inspection/supervisi/jobs
async function createJob(req, res) {
  try {
    if (!isSupervisiScheduler(req.user)) {
      return res.status(403).json({
        success: false,
        message: "Hanya pembuat jadwal supervisi yang dapat membuat pekerjaan.",
      });
    }

    const {
      namaKerja,
      nomorJo,
      nilaiPekerjaan,
      pelaksana,
      waktuMulai,
      waktuBerakhir,
      namaPengawas,
      picSupervisi,
      latitude,
      longitude,
      radius,
      status,
      namaArea,
    } = req.body;
    const normalizedNamaPengawas = normalizeSupervisiGroupLabel(namaPengawas);
    const normalizedPicSupervisi = normalizeNullableString(picSupervisi);
    const normalizedNamaKerja = String(namaKerja || "").trim();
    const normalizedNomorJo = String(nomorJo || "").trim();

    const isDraft = status === "draft";
    if (!isDraft && (!normalizedNamaKerja || !normalizedNomorJo)) {
      return res.status(400).json({ success: false, message: "Nama pekerjaan dan nomor JO wajib diisi." });
    }
    if (
      !isDraft &&
      (!pelaksana ||
        !waktuMulai ||
        !waktuBerakhir ||
        !normalizedNamaPengawas ||
        !normalizedPicSupervisi)
    ) {
      return res.status(400).json({ success: false, message: "Field wajib belum lengkap untuk jadwal aktif." });
    }

    if (normalizedPicSupervisi && !normalizedNamaPengawas) {
      return res.status(400).json({
        success: false,
        message: "Group supervisi wajib dipilih sebelum menentukan PIC supervisi.",
      });
    }

    if (
      normalizedPicSupervisi &&
      !(await isAllowedExecutorForGroup(normalizedNamaPengawas, normalizedPicSupervisi))
    ) {
      return res.status(400).json({
        success: false,
        message: "PIC supervisi harus sesuai dengan group supervisi yang dipilih.",
      });
    }

    const job = await SupervisiJob.create({
      namaKerja: normalizedNamaKerja,
      nomorJo: normalizedNomorJo,
      nilaiPekerjaan: nilaiPekerjaan ? parseFloat(nilaiPekerjaan) : null,
      pelaksana: pelaksana || null,
      waktuMulai: waktuMulai || null,
      waktuBerakhir: waktuBerakhir || null,
      namaPengawas: normalizedNamaPengawas,
      picSupervisi: normalizedPicSupervisi,
      latitude: parseNullableFloat(latitude),
      longitude: parseNullableFloat(longitude),
      radius: parseNullableFloat(radius),
      namaArea: normalizeNullableString(namaArea),
      status: isDraft ? "draft" : "active",
      createdBy: req.user.nik,
    });

    // Proses multi lokasi (Maks 300m)
    let parsedLocations = [];
    if (req.body.locations) {
      if (Array.isArray(req.body.locations)) {
        parsedLocations = req.body.locations;
      } else if (typeof req.body.locations === 'string') {
        try {
          parsedLocations = JSON.parse(req.body.locations);
        } catch(e) {}
      }
    }
    
    if (Array.isArray(parsedLocations) && parsedLocations.length > 0) {
      const formattedLocations = parsedLocations.map(loc => ({
        id: loc.id || Math.random().toString(36).substring(2, 10),
        namaArea: String(loc.namaArea || "").trim(),
        latitude: parseFloat(loc.latitude),
        longitude: parseFloat(loc.longitude),
        radius: Math.min(parseFloat(loc.radius || 100) || 100, 300.0)
      })).filter(loc => !isNaN(loc.latitude) && !isNaN(loc.longitude));
      await job.update({ locations: formattedLocations });
    }

    if (!isDraft && normalizedPicSupervisi) {
      await notifyExecutorAssignment(job);
    }

    const label = isDraft ? "Draft" : "Pekerjaan supervisi";
    res.status(201).json({ success: true, message: `${label} berhasil dibuat.`, data: job });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}

// PUT /api/inspection/supervisi/jobs/:id
async function updateJob(req, res) {
  try {
    if (!isSupervisiScheduler(req.user)) {
      return res.status(403).json({
        success: false,
        message: "Hanya pembuat jadwal supervisi yang dapat memperbarui pekerjaan.",
      });
    }

    const job = await SupervisiJob.findByPk(req.params.id);
    if (!job) return res.status(404).json({ success: false, message: "Job tidak ditemukan." });

    const nextData = {};

    if (hasOwn(req.body, "namaKerja")) {
      nextData.namaKerja = String(req.body.namaKerja || "").trim();
    }
    if (hasOwn(req.body, "nomorJo")) {
      nextData.nomorJo = String(req.body.nomorJo || "").trim();
    }
    if (hasOwn(req.body, "nilaiPekerjaan")) {
      nextData.nilaiPekerjaan = parseNullableFloat(req.body.nilaiPekerjaan);
    }
    if (hasOwn(req.body, "pelaksana")) {
      nextData.pelaksana = normalizeNullableString(req.body.pelaksana);
    }
    if (hasOwn(req.body, "waktuMulai")) {
      nextData.waktuMulai = parseNullableDate(req.body.waktuMulai);
    }
    if (hasOwn(req.body, "waktuBerakhir")) {
      nextData.waktuBerakhir = parseNullableDate(req.body.waktuBerakhir);
    }
    if (hasOwn(req.body, "namaPengawas")) {
      nextData.namaPengawas = normalizeSupervisiGroupLabel(req.body.namaPengawas);
    }
    if (hasOwn(req.body, "picSupervisi")) {
      nextData.picSupervisi = normalizeNullableString(req.body.picSupervisi);
    }
    if (hasOwn(req.body, "nomorAmend")) {
      nextData.nomorAmend = normalizeNullableString(req.body.nomorAmend);
    }
    if (hasOwn(req.body, "amendMulai")) {
      nextData.amendMulai = parseNullableDate(req.body.amendMulai);
    }
    if (hasOwn(req.body, "amendBerakhir")) {
      nextData.amendBerakhir = parseNullableDate(req.body.amendBerakhir);
    }
    if (hasOwn(req.body, "latitude")) {
      nextData.latitude = parseNullableFloat(req.body.latitude);
    }
    if (hasOwn(req.body, "longitude")) {
      nextData.longitude = parseNullableFloat(req.body.longitude);
    }
    if (hasOwn(req.body, "radius")) {
      nextData.radius = parseNullableFloat(req.body.radius);
    }
    if (hasOwn(req.body, "namaArea")) {
      nextData.namaArea = normalizeNullableString(req.body.namaArea);
    }
    if (hasOwn(req.body, "status")) {
      const normalizedStatus = normalizeNullableString(req.body.status);
      if (normalizedStatus) {
        nextData.status = normalizedStatus;
      }
    }
    if (hasOwn(req.body, "amendDocuments")) {
      nextData.amendDocuments = parseStringArray(req.body.amendDocuments);
    }
    if (hasOwn(req.body, "locations")) {
      if (Array.isArray(req.body.locations)) {
        nextData.locations = req.body.locations.map(loc => ({
          id: String(loc.id || Math.random().toString(36).substring(2, 10)),
          namaArea: String(loc.namaArea || "").trim(),
          latitude: parseFloat(loc.latitude),
          longitude: parseFloat(loc.longitude),
          radius: Math.min(parseFloat(loc.radius || 100) || 100, 300.0)
        })).filter(loc => !isNaN(loc.latitude) && !isNaN(loc.longitude));
      } else {
        nextData.locations = [];
      }
    }
    if (hasOwn(req.body, "existingAmendDocuments")) {
      nextData.amendDocuments = parseStringArray(req.body.existingAmendDocuments);
    }

    const uploadedAmendDocs = ((req.files && req.files.amendDocuments) || []).map(
      (file) => `/uploads/supervisi/${file.filename}`,
    );
    if (uploadedAmendDocs.length > 0) {
      const existingDocs = nextData.amendDocuments ?? (job.amendDocuments || []);
      nextData.amendDocuments = [...existingDocs, ...uploadedAmendDocs];
    }

    const nextStatus = nextData.status ?? job.status;
    const nextNamaKerja = nextData.namaKerja ?? job.namaKerja;
    const nextNomorJo = nextData.nomorJo ?? job.nomorJo;
    const nextPelaksana = nextData.pelaksana ?? job.pelaksana;
    const nextNamaPengawas = nextData.namaPengawas ?? job.namaPengawas;
    const nextPicSupervisi = nextData.picSupervisi ?? job.picSupervisi;
    const nextWaktuMulai = nextData.waktuMulai ?? job.waktuMulai;
    const nextWaktuBerakhir = nextData.waktuBerakhir ?? job.waktuBerakhir;
    const nextNomorAmend = nextData.nomorAmend ?? job.nomorAmend;
    const nextAmendMulai = nextData.amendMulai ?? job.amendMulai;
    const nextAmendBerakhir = nextData.amendBerakhir ?? job.amendBerakhir;
    const nextAmendDocuments = nextData.amendDocuments ?? (job.amendDocuments || []);

    if (nextStatus !== "cancelled") {
      if (nextStatus !== "draft" && (!nextNamaKerja || !nextNomorJo)) {
        return res.status(400).json({
          success: false,
          message: "Nama pekerjaan dan nomor JO wajib diisi.",
        });
      }

      if (
        nextStatus === "active" &&
        (!nextPelaksana ||
          !nextWaktuMulai ||
          !nextWaktuBerakhir ||
          !nextNamaPengawas ||
          !nextPicSupervisi)
      ) {
        return res.status(400).json({
          success: false,
          message: "Field wajib belum lengkap untuk jadwal aktif.",
        });
      }

      if (nextPicSupervisi && !nextNamaPengawas) {
        return res.status(400).json({
          success: false,
          message: "Group supervisi wajib dipilih sebelum menentukan PIC supervisi.",
        });
      }

      if (nextPicSupervisi && !(await isAllowedExecutorForGroup(nextNamaPengawas, nextPicSupervisi))) {
        return res.status(400).json({
          success: false,
          message: "PIC supervisi harus sesuai dengan group supervisi yang dipilih.",
        });
      }

      if (
        nextWaktuMulai &&
        nextWaktuBerakhir &&
        new Date(nextWaktuBerakhir) < new Date(nextWaktuMulai)
      ) {
        return res.status(400).json({
          success: false,
          message: "Waktu berakhir tidak boleh lebih awal dari waktu mulai.",
        });
      }

      const hasAmendData =
        Boolean(nextNomorAmend) ||
        Boolean(nextAmendMulai) ||
        Boolean(nextAmendBerakhir) ||
        (Array.isArray(nextAmendDocuments) && nextAmendDocuments.length > 0);

      if (hasAmendData && (!nextNomorAmend || !nextAmendMulai || !nextAmendBerakhir)) {
        return res.status(400).json({
          success: false,
          message: "No. amend, tanggal awal amend, dan tanggal akhir amend wajib dilengkapi.",
        });
      }

      if (
        nextAmendMulai &&
        nextAmendBerakhir &&
        new Date(nextAmendBerakhir) < new Date(nextAmendMulai)
      ) {
        return res.status(400).json({
          success: false,
          message: "Tanggal akhir amend tidak boleh lebih awal dari tanggal awal amend.",
        });
      }
    }

    await job.update(nextData);

    const shouldNotifyExecutor =
      nextStatus === "active" &&
      Boolean(nextPicSupervisi) &&
      (
        hasOwn(req.body, "picSupervisi") ||
        hasOwn(req.body, "status") ||
        hasOwn(req.body, "waktuMulai") ||
        hasOwn(req.body, "waktuBerakhir") ||
        hasOwn(req.body, "namaKerja") ||
        hasOwn(req.body, "nomorJo") ||
        hasOwn(req.body, "locations")
      );

    if (shouldNotifyExecutor) {
      await notifyExecutorAssignment(job, { updated: true });
    }

    res.json({ success: true, message: "Job diperbarui.", data: job });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// VISITS
// ─────────────────────────────────────────────────────────────────────────────

// GET /api/inspection/supervisi/jobs/:id/visits
async function listVisits(req, res) {
  try {
    if (!hasSupervisiAccess(req.user)) {
      return res.status(403).json({
        success: false,
        message: forbiddenMessage(),
      });
    }

    const job = await SupervisiJob.findByPk(req.params.id);
    if (!job) {
      return res.status(404).json({
        success: false,
        message: "Job tidak ditemukan.",
      });
    }

    if (!canAccessSupervisiJob(req.user, job)) {
      return res.status(403).json({
        success: false,
        message: forbiddenMessage(),
      });
    }

    const visits = await SupervisiVisit.findAll({
      where: { jobId: req.params.id },
      order: [["visitDate", "ASC"]],
    });
    res.json({ success: true, data: visits });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}

// POST /api/inspection/supervisi/visits
// Multipart form: jobId, status, keterangan/alasanTidakHadir,
//                 visitLatitude, visitLongitude + photos[]
// NOTE: visitDate is ALWAYS derived from the server clock — the client value is
//       intentionally ignored to prevent device date/time manipulation.
async function submitVisit(req, res) {
  // multer sudah dijalankan di middleware sebelum controller ini
  try {
    if (!isSupervisiExecutor(req.user)) {
      return res.status(403).json({
        success: false,
        message: "Hanya pelaksana supervisi yang dapat mengisi kunjungan.",
      });
    }

    const { jobId, status, keterangan, alasanTidakHadir,
            visitLatitude, visitLongitude, locationId } = req.body;

    // Tentukan apakah submission ini adalah draft atau final.
    // Baca dari query param ATAU body — query param lebih andal untuk multipart.
    const parseDraft = (val) => {
      if (val === true || val === 1) return true;
      if (!val) return false;
      const str = Array.isArray(val) ? val[0] : String(val);
      return str.trim() === "true" || str.trim() === "1";
    };
    const isDraftBool = parseDraft(req.query.isDraft) || parseDraft(req.body.isDraft);

    // Use server time — never trust the client's date
    const serverNow = new Date();
    // Format as YYYY-MM-DD in UTC to stay consistent with DATEONLY column
    const visitDate = serverNow.toISOString().split('T')[0];

    if (!jobId || !status) {
      return res.status(400).json({ success: false, message: "jobId dan status wajib diisi." });
    }

    if (!["hadir", "tidak_hadir"].includes(status)) {
      return res.status(400).json({ success: false, message: "Status harus 'hadir' atau 'tidak_hadir'." });
    }

    // Validasi mandatory fields hanya untuk submit final (bukan draft)
    if (!isDraftBool) {
      if (status === "hadir" && !keterangan) {
        return res.status(400).json({ success: false, message: "Keterangan wajib diisi jika hadir." });
      }
      if (status === "tidak_hadir" && !alasanTidakHadir) {
        return res.status(400).json({ success: false, message: "Alasan tidak hadir wajib diisi." });
      }
    }

    // Cek job ada
    const job = await SupervisiJob.findByPk(jobId);
    if (!job) return res.status(404).json({ success: false, message: "Job tidak ditemukan." });
    if (!canAccessSupervisiJob(req.user, job)) {
      return res.status(403).json({
        success: false,
        message: "Anda hanya dapat mengisi kunjungan untuk pekerjaan yang ditugaskan ke Anda.",
      });
    }

    let jarakDariPusat = null;
    const vLat = parseNullableFloat(visitLatitude);
    const vLon = parseNullableFloat(visitLongitude);
    const normalizedLocationId = locationId ? String(locationId).trim() : null;

    // ── Geofence calculation ─────────────────────────────────────────────────
    if (status === "hadir") {
      // Saat final submit, GPS wajib ada. Saat draft, GPS opsional.
      if (!isDraftBool && (vLat === null || vLon === null || isNaN(vLat) || isNaN(vLon))) {
        return res.status(400).json({
          success: false,
          message: "Koordinat GPS wajib dikirim saat hadir. Pastikan lokasi aktif.",
        });
      }

      // Hitung jarak dari pusat geofence jika koordinat tersedia
      if (vLat !== null && vLon !== null && !isNaN(vLat) && !isNaN(vLon)) {
        let targetLocation = null;
        if (job.locations && Array.isArray(job.locations)) {
          targetLocation = job.locations.find(loc => String(loc.id) === normalizedLocationId);
        }
        const tLat = targetLocation ? parseFloat(targetLocation.latitude) : parseFloat(job.latitude);
        const tLon = targetLocation ? parseFloat(targetLocation.longitude) : parseFloat(job.longitude);
        const tRad = targetLocation ? parseFloat(targetLocation.radius) : parseFloat(job.radius || 100);
        if (!isNaN(tLat) && !isNaN(tLon)) {
          const dist = haversineMetres(tLat, tLon, vLat, vLon);
          jarakDariPusat = dist > tRad ? Math.round(dist - tRad) : 0;
        }
      }
    }

    // Kumpulkan paths foto dan dokumen yang diupload
    const photoPaths = ((req.files && req.files.photos) || []).map(
      (f) => `/uploads/supervisi/${f.filename}`
    );
    const documentPaths = ((req.files && req.files.documents) || []).map(
      (f) => `/uploads/supervisi/${f.filename}`
    );

    // existingPhotos/existingDocuments: URL foto/dokumen yang MASIH ada di draft
    // (sudah di-filter oleh user — foto yang dihapus di UI tidak ikut dikirim).
    // Jika tidak dikirim, fallback ke semua file lama dari server.
    const existingPhotoUrls = parseStringArray(req.body.existingPhotos);
    const existingDocumentUrls = parseStringArray(req.body.existingDocuments);

    // Konversi draft kedaluwarsa milik job ini sebelum upsert
    await convertStaleDrafts(parseInt(jobId));

    // Upsert — jika sudah ada visit untuk hari ini dan lokasi ini, update
    const queryWhere = { jobId: parseInt(jobId), visitDate };
    if (normalizedLocationId) {
      queryWhere.locationId = normalizedLocationId;
    } else {
      queryWhere.locationId = null;
    }

    const [visit, created] = await SupervisiVisit.findOrCreate({
      where: queryWhere,
      defaults: {
        status,
        keterangan: status === "hadir" ? (keterangan || null) : null,
        alasanTidakHadir: status === "tidak_hadir" ? (alasanTidakHadir || null) : null,
        photos: photoPaths,
        documents: documentPaths,
        submittedBy: req.user.nik,
        submittedAt: new Date(),
        isPelanggaran: !isDraftBool && status === "tidak_hadir",
        visitLatitude: vLat,
        visitLongitude: vLon,
        locationId: normalizedLocationId,
        jarakDariPusat: jarakDariPusat,
        isDraft: isDraftBool,
      },
    });

    if (!created) {
      // Tentukan basis foto/dokumen yang akan disimpan:
      // - Jika frontend mengirim existingPhotos → gunakan itu (sudah di-filter user)
      // - Jika tidak dikirim → pakai seluruh foto lama dari server (backward compat)
      const basePhotos = existingPhotoUrls.length > 0 || req.body.existingPhotos !== undefined
        ? existingPhotoUrls
        : (visit.photos || []);
      const baseDocs = existingDocumentUrls.length > 0 || req.body.existingDocuments !== undefined
        ? existingDocumentUrls
        : (visit.documents || []);

      // Update existing visit (draft → final, atau re-submit hari yang sama)
      await visit.update({
        status,
        keterangan: status === "hadir" ? (keterangan || null) : null,
        alasanTidakHadir: status === "tidak_hadir" ? (alasanTidakHadir || null) : null,
        // Gabungkan: foto yang tersisa dari draft + foto baru yang diupload
        photos: [...basePhotos, ...photoPaths],
        // Dokumen: gabungkan yang tersisa + baru
        documents: [...baseDocs, ...documentPaths],
        submittedBy: req.user.nik,
        submittedAt: new Date(),
        isPelanggaran: !isDraftBool && status === "tidak_hadir",
        visitLatitude: vLat !== null ? vLat : visit.visitLatitude,
        visitLongitude: vLon !== null ? vLon : visit.visitLongitude,
        locationId: normalizedLocationId,
        jarakDariPusat: jarakDariPusat !== null ? jarakDariPusat : visit.jarakDariPusat,
        isDraft: isDraftBool,
      });
    }


    const executorName =
      normalizeNullableString(req.user && req.user.name) ||
      normalizeNullableString(req.user && req.user.nik) ||
      "Pelaksana";

    // Kirim notifikasi ke supervisor HANYA untuk submit final (bukan draft)
    if (!isDraftBool) {
      await notifySupervisorVisitUpdate({
        job,
        visitStatus: status,
        visitDate,
        executorName,
      });
    }

    // Inject submitterName ke response visit
    const visitNikMap = await buildNikNameMap(visit.submittedBy ? [visit.submittedBy] : []);
    const visitData = typeof visit.toJSON === "function" ? visit.toJSON() : { ...visit };
    visitData.submitterName = visitNikMap[visit.submittedBy] || null;

    const successMessage = isDraftBool
      ? (created ? "Kunjungan disimpan sebagai draft." : "Draft kunjungan diperbarui.")
      : (created ? "Kunjungan berhasil dicatat." : "Kunjungan berhasil diperbarui.");

    res.status(created ? 201 : 200).json({
      success: true,
      message: successMessage,
      data: visitData,
    });
  } catch (err) {
    // Handle unique constraint violation
    if (err.name === "SequelizeUniqueConstraintError") {
      return res.status(409).json({ success: false, message: "Kunjungan untuk hari ini sudah tercatat." });
    }
    res.status(500).json({ success: false, message: err.message });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// PELANGGARAN
// ─────────────────────────────────────────────────────────────────────────────

// GET /api/inspection/supervisi/pelanggaran
async function listPelanggaran(req, res) {
  try {
    const access = getSupervisiAccess(req.user);
    if (access.kind === "none") {
      return res.status(403).json({
        success: false,
        message: forbiddenMessage(),
      });
    }

    const where = { isPelanggaran: true };
    if (req.query.jobId) where.jobId = req.query.jobId;

    const jobInclude = {
      model: SupervisiJob,
      as: "job",
      attributes: ["id", "namaKerja", "nomorJo", "pelaksana", "picSupervisi"],
    };

    if (access.kind === "executor") {
      jobInclude.where = { picSupervisi: access.displayName };
    }

    const pelanggaran = await SupervisiVisit.findAll({
      where,
      order: [["visitDate", "DESC"]],
      include: [jobInclude],
    });

    res.json({ success: true, data: pelanggaran });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// CRON JOB — Auto-flag missed visits as Pelanggaran
// ─────────────────────────────────────────────────────────────────────────────

/**
 * markMissedVisitsAsPelanggaran
 *
 * Dipanggil oleh cron job setiap hari pukul 00:01.
 * Logic:
 *   1. Ambil semua SupervisiJob dengan status 'active' yang memiliki jadwal.
 *   2. Untuk setiap tanggal yang sudah lewat (kemarin ke bawah) dalam range
 *      waktuMulai–effectiveEndDate, cek apakah ada SupervisiVisit.
 *   3. Jika belum ada visit → buat record baru dengan isPelanggaran=true.
 */
async function markMissedVisitsAsPelanggaran() {
  const LABEL = "[Supervisi Cron]";
  console.log(`${LABEL} Running missed-visit check at`, new Date().toISOString());

  try {
    const today = new Date();
    const todayOnly = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));
    const yesterday = new Date(todayOnly);
    yesterday.setUTCDate(yesterday.getUTCDate() - 1);
    const yesterdayStr = yesterday.toISOString().split("T")[0];

    // Hanya proses job active yang kemarin masih berada di rentang jadwal.
    // amendBerakhir disertakan untuk kompatibilitas field amend legacy.
    const activeJobs = await SupervisiJob.findAll({
      where: {
        status: "active",
        waktuMulai: { [Op.lte]: yesterdayStr },
      },
      include: [
        {
          model: SupervisiVisit,
          as: "visits",
          attributes: ["visitDate", "locationId", "status"],
        },
        {
          model: SupervisiAmend,
          as: "amends",
          attributes: ["amendBerakhir"],
        },
      ],
    });

    let totalCreated = 0;

    for (const job of activeJobs) {
      if (!job.waktuMulai || !job.waktuBerakhir) continue;

      const jobStart = new Date(job.waktuMulai);
      const defaultEnd = new Date(job.waktuBerakhir);
      const legacyAmendEnd = job.amendBerakhir ? new Date(job.amendBerakhir) : null;
      const childAmendEnds = (job.amends || [])
        .map((a) => (a && a.amendBerakhir ? new Date(a.amendBerakhir) : null))
        .filter(Boolean);

      const effectiveEnd = [defaultEnd, legacyAmendEnd, ...childAmendEnds]
        .filter(Boolean)
        .sort((a, b) => b.getTime() - a.getTime())[0];

      if (!effectiveEnd) continue;

      // Kumpulkan semua (visitDate, locationId) yang sudah ada
      const existingVisitKeys = new Set(
        (job.visits || []).map((v) => {
          const d = typeof v.visitDate === "string" ? v.visitDate : v.visitDate.toISOString().split("T")[0];
          return `${d}__${v.locationId || ""}`;
        })
      );

      // Tentukan lokasi-lokasi yang harus dikunjungi
      const locations =
        Array.isArray(job.locations) && job.locations.length > 0
          ? job.locations
          : [{ id: null }]; // Single-location job (no locationId)

      // Scope cron: kemarin harus berada dalam range waktuMulai–effectiveEndDate.
      if (yesterday < jobStart || yesterday > effectiveEnd) continue;

      // Iterasi setiap hari terlewat dari start hingga kemarin.
      let cur = new Date(jobStart);
      while (cur <= yesterday && cur <= effectiveEnd) {
        const dateStr = cur.toISOString().split("T")[0];

        for (const loc of locations) {
          const locId = loc.id ? String(loc.id) : null;
          const key = `${dateStr}__${locId || ""}`;

          if (!existingVisitKeys.has(key)) {
            try {
              await SupervisiVisit.create({
                jobId: job.id,
                visitDate: dateStr,
                status: "tidak_hadir",
                isPelanggaran: true,
                alasanTidakHadir: null,
                locationId: locId,
                submittedAt: null,
                submittedBy: null,
                photos: [],
                documents: [],
              });
              totalCreated++;
              // Tambahkan ke set agar iterasi berikutnya tidak duplikat
              existingVisitKeys.add(key);
            } catch (createErr) {
              // Abaikan duplicate key — bisa terjadi jika ada race condition
              if (createErr.name !== "SequelizeUniqueConstraintError") {
                console.warn(`${LABEL} Failed to create pelanggaran for job ${job.id} date ${dateStr} loc ${locId}:`, createErr.message);
              }
            }
          }
        }

        // Maju ke hari berikutnya
        cur.setUTCDate(cur.getUTCDate() + 1);
      }
    }

    console.log(`${LABEL} Done. Created ${totalCreated} pelanggaran record(s).`);
  } catch (err) {
    console.error(`${LABEL} Error during missed-visit check:`, err.message);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// VIOLATION REASON
// ─────────────────────────────────────────────────────────────────────────────

// PUT /api/inspection/supervisi/visits/:id/violation-reason
async function submitViolationReason(req, res) {
  try {
    if (!isSupervisiExecutor(req.user)) {
      return res.status(403).json({
        success: false,
        message: "Hanya pelaksana supervisi yang dapat mengisi alasan pelanggaran.",
      });
    }

    const visitId = parseInt(req.params.id, 10);
    if (isNaN(visitId)) {
      return res.status(400).json({ success: false, message: "ID visit tidak valid." });
    }

    const { alasanTidakHadir } = req.body;
    const normalizedAlasan = normalizeNullableString(alasanTidakHadir);

    if (!normalizedAlasan) {
      return res.status(400).json({
        success: false,
        message: "Alasan pelanggaran wajib diisi dan tidak boleh kosong.",
      });
    }

    // Cari visit beserta job-nya untuk validasi kepemilikan
    const visit = await SupervisiVisit.findByPk(visitId, {
      include: [
        {
          model: SupervisiJob,
          as: "job",
          attributes: ["id", "picSupervisi", "namaKerja", "nomorJo"],
        },
      ],
    });

    if (!visit) {
      return res.status(404).json({ success: false, message: "Kunjungan tidak ditemukan." });
    }

    // Pastikan visit ini memang pelanggaran
    if (!visit.isPelanggaran) {
      return res.status(400).json({
        success: false,
        message: "Kunjungan ini bukan pelanggaran dan tidak memerlukan alasan.",
      });
    }

    // Validasi: Eksekutor hanya bisa mengisi alasan untuk job-nya sendiri
    if (!canAccessSupervisiJob(req.user, visit.job)) {
      return res.status(403).json({
        success: false,
        message: "Anda hanya dapat mengisi alasan untuk pekerjaan yang ditugaskan ke Anda.",
      });
    }

    await visit.update({
      alasanTidakHadir: normalizedAlasan,
      submittedBy: req.user.nik,
      submittedAt: new Date(),
    });

    res.json({
      success: true,
      message: "Alasan pelanggaran berhasil disimpan.",
      data: visit,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}

module.exports = {
  uploadVisitMedia,
  uploadJobAmendDocuments,
  listJobs,
  getJob,
  createJob,
  updateJob,
  listVisits,
  submitVisit,
  listPelanggaran,
  markMissedVisitsAsPelanggaran,
  submitViolationReason,
};
