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

// ─────────────────────────────────────────────────────────────────────────────
// JOBS
// ─────────────────────────────────────────────────────────────────────────────

// GET /api/inspection/supervisi/jobs
async function listJobs(req, res) {
  try {
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

    res.json({ success: true, data: jobs });
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
    res.json({ success: true, data: job });
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

    if (status === "hadir" && !keterangan) {
      return res.status(400).json({ success: false, message: "Keterangan wajib diisi jika hadir." });
    }

    if (status === "tidak_hadir" && !alasanTidakHadir) {
      return res.status(400).json({ success: false, message: "Alasan tidak hadir wajib diisi." });
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

    // ── Geofence calculation (hanya saat hadir) ──────────────────────────────
    if (status === "hadir") {
      if (vLat === null || vLon === null || isNaN(vLat) || isNaN(vLon)) {
        return res.status(400).json({
          success: false,
          message: "Koordinat GPS wajib dikirim saat hadir. Pastikan lokasi aktif.",
        });
      }

      // Cari lokasi target
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

    // Kumpulkan paths foto dan dokumen yang diupload
    const photoPaths = ((req.files && req.files.photos) || []).map(
      (f) => `/uploads/supervisi/${f.filename}`
    );
    const documentPaths = ((req.files && req.files.documents) || []).map(
      (f) => `/uploads/supervisi/${f.filename}`
    );

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
        keterangan: status === "hadir" ? keterangan : null,
        alasanTidakHadir: status === "tidak_hadir" ? alasanTidakHadir : null,
        photos: photoPaths,
        documents: documentPaths,
        submittedBy: req.user.nik,
        submittedAt: new Date(),
        isPelanggaran: status === "tidak_hadir",
        visitLatitude: vLat,
        visitLongitude: vLon,
        locationId: normalizedLocationId,
        jarakDariPusat: jarakDariPusat,
      },
    });

    if (!created) {
      // Update existing visit
      await visit.update({
        status,
        keterangan: status === "hadir" ? keterangan : null,
        alasanTidakHadir: status === "tidak_hadir" ? alasanTidakHadir : null,
        photos: photoPaths.length > 0 ? photoPaths : visit.photos,
        documents: documentPaths.length > 0 ? [...(visit.documents || []), ...documentPaths] : visit.documents,
        submittedBy: req.user.nik,
        submittedAt: new Date(),
        isPelanggaran: status === "tidak_hadir",
        visitLatitude: vLat,
        visitLongitude: vLon,
        locationId: normalizedLocationId,
        jarakDariPusat: jarakDariPusat,
      });
    }

    const executorName =
      normalizeNullableString(req.user && req.user.name) ||
      normalizeNullableString(req.user && req.user.nik) ||
      "Pelaksana";
    await notifySupervisorVisitUpdate({
      job,
      visitStatus: status,
      visitDate,
      executorName,
    });

    res.status(created ? 201 : 200).json({
      success: true,
      message: created ? "Kunjungan berhasil dicatat." : "Kunjungan berhasil diperbarui.",
      data: visit,
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
};
