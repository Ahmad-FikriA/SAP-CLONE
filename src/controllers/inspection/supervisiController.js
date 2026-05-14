"use strict";

const { Op } = require("sequelize");
const SupervisiJob = require("../../models/SupervisiJob");
const SupervisiVisit = require("../../models/SupervisiVisit");
const SupervisiAmend = require("../../models/SupervisiAmend");
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
const {
  addCurrentUserNameFallback,
  addDaysDateOnly,
  buildNikNameMap,
  buildRadiusExemptionPatch,
  calculateDistanceOutsideRadius,
  evaluateSupervisiGeofence,
  enrichJobWithNames,
  getAppDateString,
  hasFiniteCoordinates,
  hasOwn,
  isRadiusExemptionActive,
  maxDateOnly,
  normalizeDateOnly,
  normalizeNullableString,
  parseDraftFlag,
  parseLocations,
  parseNullableDate,
  parseNullableFloat,
  parseStringArray,
} = require("./supervisiHelpers");
const {
  filesToSupervisiPaths,
  uploadJobAmendDocuments,
  uploadVisitMedia,
} = require("./supervisiUpload");
const {
  notifyExecutorAssignment,
  notifySupervisorVisitUpdate,
} = require("./supervisiNotifications");

const NILAI_PEKERJAAN_MAX_INTEGER_DIGITS = 19;

function isWebClientRequest(req) {
  const platformHeader = String(req.headers["x-client-platform"] || "")
    .trim()
    .toLowerCase();
  return platformHeader === "web";
}

function getSupervisiReadAccessOptions(req) {
  return {
    allowWebPermissionRead: isWebClientRequest(req),
  };
}

function parseNilaiPekerjaan(value) {
  if (value === undefined) return { value: undefined };
  if (value === null || value === "") return { value: null };

  const rawText = String(value).trim().replace(/\s/g, "").replace(/^rp/i, "");
  let numericText = rawText;

  if (/^\d{1,3}(\.\d{3})+(,\d+)?$/.test(rawText)) {
    numericText = rawText.replace(/\./g, "").replace(",", ".");
  } else if (/^\d{1,3}(,\d{3})+(\.\d+)?$/.test(rawText)) {
    numericText = rawText.replace(/,/g, "");
  } else {
    numericText = rawText.replace(/,/g, "");
  }

  if (/e/i.test(numericText)) {
    const parsed = Number(numericText);
    if (!Number.isFinite(parsed) || parsed < 0) {
      return { error: "Nilai pekerjaan harus berupa angka positif." };
    }
    numericText = parsed.toFixed(2);
  }

  if (!/^\d+(\.\d+)?$/.test(numericText)) {
    return { error: "Nilai pekerjaan harus berupa angka positif." };
  }

  const [integerPart, fractionPart = ""] = numericText.split(".");
  const normalizedInteger = integerPart.replace(/^0+(?=\d)/, "") || "0";

  if (normalizedInteger.length > NILAI_PEKERJAAN_MAX_INTEGER_DIGITS) {
    return {
      error: `Nilai pekerjaan maksimal ${NILAI_PEKERJAAN_MAX_INTEGER_DIGITS} digit.`,
    };
  }

  const normalizedFraction = fractionPart.slice(0, 2).padEnd(2, "0");
  return { value: `${normalizedInteger}.${normalizedFraction}` };
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
  const today = getAppDateString();
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

/**
 * Bersihkan data pengecualian radius yang batas waktunya telah terlewati.
 *
 * @param {number|null} jobId - Jika diisi, hanya bersihkan untuk job tertentu.
 */
async function clearExpiredRadiusExemptions(jobId = null) {
  const today = getAppDateString();
  const where = {
    radiusExemptionEndDate: { [Op.lt]: today },
  };
  if (jobId) where.id = parseInt(jobId);
  try {
    const [count] = await SupervisiJob.update(
      { 
        radiusExemptionStartDate: null,
        radiusExemptionEndDate: null,
        radiusExemptionReason: null,
        radiusExemptionBy: null
      },
      { where }
    );
    if (count > 0) {
      console.log(`[Supervisi] clearExpiredRadiusExemptions: ${count} pengecualian radius kedaluwarsa dibersihkan.`);
    }
  } catch (err) {
    console.error("[Supervisi] clearExpiredRadiusExemptions error:", err.message);
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
    await clearExpiredRadiusExemptions();

    const accessOptions = getSupervisiReadAccessOptions(req);
    const access = getSupervisiAccess(req.user, accessOptions);
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
    addCurrentUserNameFallback(nikNameMap, req.user);
    const enrichedJobs = jobs.map((job) => enrichJobWithNames(job, nikNameMap));

    res.json({ success: true, data: enrichedJobs });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}

// GET /api/inspection/supervisi/jobs/:id
async function getJob(req, res) {
  try {
    const accessOptions = getSupervisiReadAccessOptions(req);

    if (!hasSupervisiAccess(req.user, accessOptions)) {
      return res.status(403).json({
        success: false,
        message: forbiddenMessage(),
      });
    }

    // Konversi draft kedaluwarsa untuk job ini sebelum fetch
    await convertStaleDrafts(parseInt(req.params.id));
    await clearExpiredRadiusExemptions(parseInt(req.params.id));

    const job = await SupervisiJob.findByPk(req.params.id, {
      include: [
        { model: SupervisiVisit, as: "visits", order: [["visitDate", "ASC"]] },
        { model: SupervisiAmend, as: "amends", order: [["amendMulai", "ASC"]] },
      ],
    });
    if (!job) return res.status(404).json({ success: false, message: "Job tidak ditemukan." });
    if (!canAccessSupervisiJob(req.user, job, accessOptions)) {
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
    addCurrentUserNameFallback(nikNameMap, req.user);
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

    const parsedNilaiPekerjaan = parseNilaiPekerjaan(nilaiPekerjaan);
    if (parsedNilaiPekerjaan.error) {
      return res.status(400).json({
        success: false,
        message: parsedNilaiPekerjaan.error,
      });
    }

    const radiusExemptionPatch = buildRadiusExemptionPatch(req.body, null, req.user);
    if (radiusExemptionPatch.error) {
      return res.status(400).json({
        success: false,
        message: radiusExemptionPatch.error,
      });
    }

    const job = await SupervisiJob.create({
      namaKerja: normalizedNamaKerja,
      nomorJo: normalizedNomorJo,
      nilaiPekerjaan: parsedNilaiPekerjaan.value,
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
      ...radiusExemptionPatch.patch,
    });

    const formattedLocations = parseLocations(req.body.locations);
    if (formattedLocations.length > 0) {
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
      const parsedNilaiPekerjaan = parseNilaiPekerjaan(req.body.nilaiPekerjaan);
      if (parsedNilaiPekerjaan.error) {
        return res.status(400).json({
          success: false,
          message: parsedNilaiPekerjaan.error,
        });
      }
      nextData.nilaiPekerjaan = parsedNilaiPekerjaan.value;
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
        // Validasi transisi status: cancel hanya dari active
        if (normalizedStatus === "cancelled") {
          if (job.status !== "active") {
            return res.status(400).json({
              success: false,
              message: `Pembatalan hanya bisa dilakukan pada pekerjaan berstatus aktif. Status saat ini: ${job.status}.`,
            });
          }
          const reason = normalizeNullableString(req.body.cancelReason);
          if (!reason) {
            return res.status(400).json({
              success: false,
              message: "Alasan pembatalan (cancelReason) wajib diisi saat membatalkan pekerjaan.",
            });
          }
          nextData.cancelReason = reason;
        }
        nextData.status = normalizedStatus;
      }
    }
    if (hasOwn(req.body, "amendDocuments")) {
      nextData.amendDocuments = parseStringArray(req.body.amendDocuments);
    }
    if (hasOwn(req.body, "locations")) {
      nextData.locations = parseLocations(req.body.locations);
    }
    if (hasOwn(req.body, "existingAmendDocuments")) {
      nextData.amendDocuments = parseStringArray(req.body.existingAmendDocuments);
    }

    const radiusExemptionPatch = buildRadiusExemptionPatch(req.body, job, req.user);
    if (radiusExemptionPatch.error) {
      return res.status(400).json({
        success: false,
        message: radiusExemptionPatch.error,
      });
    }
    if (radiusExemptionPatch.hasPayload) {
      Object.assign(nextData, radiusExemptionPatch.patch);
    }

    const uploadedAmendDocs = filesToSupervisiPaths(
      (req.files && req.files.amendDocuments) || [],
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
        hasOwn(req.body, "locations") ||
        radiusExemptionPatch.hasPayload
      );

    if (shouldNotifyExecutor) {
      await notifyExecutorAssignment(job, { updated: true });
    }

    res.json({ success: true, message: "Job diperbarui.", data: job });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}

// DELETE /api/inspection/supervisi/jobs/:id
async function deleteJob(req, res) {
  try {
    if (!isSupervisiScheduler(req.user)) {
      return res.status(403).json({
        success: false,
        message: "Hanya pembuat jadwal supervisi yang dapat menghapus pekerjaan.",
      });
    }

    const job = await SupervisiJob.findByPk(req.params.id);
    if (!job) {
      return res.status(404).json({ success: false, message: "Job tidak ditemukan." });
    }

    // Hanya boleh hapus permanen jika sudah dibatalkan, selesai, atau draft
    if (job.status !== "cancelled" && job.status !== "completed" && job.status !== "draft") {
      return res.status(400).json({
        success: false,
        message: `Pekerjaan hanya bisa dihapus jika berstatus 'dibatalkan', 'selesai', atau 'draft'. Status saat ini: ${job.status}.`,
      });
    }

    await job.destroy();

    res.json({ success: true, message: "Pekerjaan berhasil dihapus." });
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
    const accessOptions = getSupervisiReadAccessOptions(req);

    if (!hasSupervisiAccess(req.user, accessOptions)) {
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

    if (!canAccessSupervisiJob(req.user, job, accessOptions)) {
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
//                 optional visitLatitude/visitLongitude + photos[]
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
    const isDraftBool =
      parseDraftFlag(req.query.isDraft) || parseDraftFlag(req.body.isDraft);

    // Use server time in Asia/Jakarta; never trust the client's date.
    const visitDate = getAppDateString();

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
    const hasVisitCoordinates = hasFiniteCoordinates(vLat, vLon);
    const normalizedLocationId = locationId ? String(locationId).trim() : null;
    const queryWhere = { jobId: parseInt(jobId), visitDate };
    if (normalizedLocationId) {
      queryWhere.locationId = normalizedLocationId;
    } else {
      queryWhere.locationId = null;
    }
    const existingVisit = await SupervisiVisit.findOne({ where: queryWhere });

    // ── Geofence calculation ─────────────────────────────────────────────────
    if (status === "hadir") {
      const existingLat = parseNullableFloat(existingVisit && existingVisit.visitLatitude);
      const existingLon = parseNullableFloat(existingVisit && existingVisit.visitLongitude);
      const effectiveLat = hasVisitCoordinates ? vLat : existingLat;
      const effectiveLon = hasVisitCoordinates ? vLon : existingLon;
      const exemptionActive = isRadiusExemptionActive(job, visitDate);

      if (!exemptionActive && !isDraftBool) {
        const geofence = evaluateSupervisiGeofence(
          job,
          normalizedLocationId,
          vLat,
          vLon,
        );

        if (geofence.status === "missing_visit") {
          return res.status(400).json({
            success: false,
            message: "GPS submit wajib dikirim untuk laporan hadir supervisi.",
          });
        }

        if (geofence.status === "missing_target") {
          return res.status(400).json({
            success: false,
            message: "Titik lokasi/radius supervisi belum valid. Hubungi planner.",
          });
        }

        jarakDariPusat = geofence.outsideMeters;
        if (geofence.status === "outside") {
          return res.status(422).json({
            success: false,
            message: `Submit ditolak karena posisi berada ${geofence.outsideMeters} meter di luar radius ${Math.round(geofence.radius)} meter.`,
            data: {
              distanceMeters: geofence.distanceMeters,
              outsideMeters: geofence.outsideMeters,
              radius: geofence.radius,
            },
          });
        }
      } else if (hasFiniteCoordinates(effectiveLat, effectiveLon)) {
        jarakDariPusat = calculateDistanceOutsideRadius(
          job,
          normalizedLocationId,
          effectiveLat,
          effectiveLon,
        );
      }
    }

    const photoPaths = filesToSupervisiPaths((req.files && req.files.photos) || []);
    const documentPaths = filesToSupervisiPaths(
      (req.files && req.files.documents) || [],
    );

    // existingPhotos/existingDocuments: URL foto/dokumen yang MASIH ada di draft
    // (sudah di-filter oleh user — foto yang dihapus di UI tidak ikut dikirim).
    // Jika tidak dikirim sama sekali → fallback ke semua file lama dari server.
    const sentExistingPhotos = req.body.existingPhotos !== undefined;
    const sentExistingDocs   = req.body.existingDocuments !== undefined;
    const existingPhotoUrls  = sentExistingPhotos ? (parseStringArray(req.body.existingPhotos) || []) : null;
    const existingDocUrls    = sentExistingDocs   ? (parseStringArray(req.body.existingDocuments) || []) : null;

    // Konversi draft kedaluwarsa milik job ini sebelum upsert
    await convertStaleDrafts(parseInt(jobId));
    await clearExpiredRadiusExemptions(parseInt(jobId));

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
        visitLatitude: hasVisitCoordinates ? vLat : null,
        visitLongitude: hasVisitCoordinates ? vLon : null,
        locationId: normalizedLocationId,
        jarakDariPusat: jarakDariPusat,
        isDraft: isDraftBool,
      },
    });

    if (!created) {
      // Tentukan basis foto/dokumen:
      // - Frontend kirim existingPhotos → pakai itu (user sudah filter mana yang mau disimpan)
      // - Frontend tidak kirim → pakai semua foto lama dari server (backward compat)
      const basePhotos = sentExistingPhotos ? existingPhotoUrls : (visit.photos || []);
      const baseDocs   = sentExistingDocs   ? existingDocUrls   : (visit.documents || []);

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
        visitLatitude: hasVisitCoordinates ? vLat : visit.visitLatitude,
        visitLongitude: hasVisitCoordinates ? vLon : visit.visitLongitude,
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
    addCurrentUserNameFallback(visitNikMap, req.user);
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
    const accessOptions = getSupervisiReadAccessOptions(req);
    const access = getSupervisiAccess(req.user, accessOptions);
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
    const todayStr = getAppDateString();
    const yesterdayStr = addDaysDateOnly(todayStr, -1);

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

      const jobStartStr = normalizeDateOnly(job.waktuMulai);
      const defaultEndStr = normalizeDateOnly(job.waktuBerakhir);
      const legacyAmendEndStr = normalizeDateOnly(job.amendBerakhir);
      const childAmendEndStrs = (job.amends || [])
        .map((a) => normalizeDateOnly(a && a.amendBerakhir))
        .filter(Boolean);

      const effectiveEndStr = maxDateOnly([defaultEndStr, legacyAmendEndStr, ...childAmendEndStrs]);

      if (!jobStartStr || !effectiveEndStr) continue;

      // Kumpulkan semua (visitDate, locationId) yang sudah ada
      const existingVisitKeys = new Set(
        (job.visits || []).map((v) => {
          const d = normalizeDateOnly(v.visitDate);
          return `${d}__${v.locationId || ""}`;
        })
      );

      // Tentukan lokasi-lokasi yang harus dikunjungi
      const locations =
        Array.isArray(job.locations) && job.locations.length > 0
          ? job.locations
          : [{ id: null }]; // Single-location job (no locationId)

      // Scope cron: kemarin harus berada dalam range waktuMulai–effectiveEndDate.
      if (yesterdayStr < jobStartStr || yesterdayStr > effectiveEndStr) continue;

      // Iterasi setiap hari terlewat dari start hingga kemarin.
      let dateStr = jobStartStr;
      while (dateStr <= yesterdayStr && dateStr <= effectiveEndStr) {

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
        dateStr = addDaysDateOnly(dateStr, 1);
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

// PUT /api/inspection/supervisi/visits/:id/undo
// Revert a finalized visit back to draft — only allowed on the same day.
async function undoVisit(req, res) {
  try {
    if (!isSupervisiExecutor(req.user)) {
      return res.status(403).json({
        success: false,
        message: "Hanya pelaksana supervisi yang dapat membatalkan submit kunjungan.",
      });
    }

    const visit = await SupervisiVisit.findByPk(req.params.id, {
      include: [{ model: SupervisiJob, as: "job" }],
    });

    if (!visit) {
      return res.status(404).json({
        success: false,
        message: "Kunjungan tidak ditemukan.",
      });
    }

    if (!canAccessSupervisiJob(req.user, visit.job)) {
      return res.status(403).json({
        success: false,
        message: "Anda hanya dapat membatalkan submit untuk pekerjaan yang ditugaskan ke Anda.",
      });
    }

    if (visit.isDraft) {
      return res.status(400).json({
        success: false,
        message: "Kunjungan ini sudah berstatus draft.",
      });
    }

    // Only allow undo on the same calendar day (server time)
    const serverToday = getAppDateString();
    const visitDateStr = String(visit.visitDate);
    if (visitDateStr !== serverToday) {
      return res.status(400).json({
        success: false,
        message: "Batal submit hanya bisa dilakukan pada hari yang sama dengan tanggal kunjungan.",
      });
    }

    await visit.update({ isDraft: true });

    const executorName =
      normalizeNullableString(req.user && req.user.name) ||
      normalizeNullableString(req.user && req.user.nik) ||
      "Pelaksana";

    // Beritahu supervisor bahwa laporan ditarik kembali
    await notifySupervisorVisitUpdate({
      job: visit.job,
      visitStatus: visit.status,
      visitDate: visitDateStr,
      executorName,
      isUndo: true
    });

    // Inject submitterName
    const nikMap = await buildNikNameMap(visit.submittedBy ? [visit.submittedBy] : []);
    addCurrentUserNameFallback(nikMap, req.user);
    const visitData = typeof visit.toJSON === "function" ? visit.toJSON() : { ...visit };
    visitData.submitterName = nikMap[visit.submittedBy] || null;
    // Remove included job to keep response lean
    delete visitData.job;

    res.json({
      success: true,
      message: "Laporan berhasil dikembalikan ke draft.",
      data: visitData,
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
  deleteJob,
  listVisits,
  submitVisit,
  listPelanggaran,
  markMissedVisitsAsPelanggaran,
  submitViolationReason,
  undoVisit,
};
