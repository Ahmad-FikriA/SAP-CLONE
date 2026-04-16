"use strict";

const express = require("express");
const router = express.Router();
const { verifyToken } = require("../middleware/auth");

const {
  listSchedules,
  getSchedule,
  createSchedule,
  updateSchedule,
  getNextSpkNumber,
} = require("../controllers/inspection/scheduleController");

const {
  listReports,
  getReport,
  createReport,
  approveReport,
  rejectReport,
} = require("../controllers/inspection/reportController");

const {
  listFollowUps,
  getFollowUp,
  createFollowUp,
  updateFollowUp,
  approveFollowUp,
  rejectFollowUp,
} = require("../controllers/inspection/followUpController");

const {
  listSuratPelanggaran,
  getSuratPelanggaran,
  createSuratPelanggaran,
  updateSuratPelanggaran,
  checkOverdueFollowUps,
} = require("../controllers/inspection/suratPelanggaranController");

const {
  listRequests,
  getRequest,
  createRequest,
  approveRequest,
  rejectRequest,
  cancelRequest,
} = require("../controllers/inspection/inspectionRequestController");

const {
  uploadVisitMedia,
  uploadJobAmendDocuments,
  listJobs,
  getJob,
  createJob,
  updateJob,
  listVisits,
  submitVisit,
  listPelanggaran,
} = require("../controllers/inspection/supervisiController");

const {
  uploadAmendDocuments,
  createAmend,
  updateAmend,
  deleteAmend,
  listAmends,
} = require("../controllers/inspection/supervisiAmendController");

// All inspection routes require authentication
router.use(verifyToken);

// ── Schedules ────────────────────────────────────────────────────────────────
router.get("/schedules/next-spk", getNextSpkNumber); // ⚠️ Harus sebelum /:id
router.get("/schedules", listSchedules);
router.get("/schedules/:id", getSchedule);
router.post("/schedules", createSchedule);
router.put("/schedules/:id", updateSchedule);

// ── Reports ──────────────────────────────────────────────────────────────────
router.get("/reports", listReports);
router.get("/reports/:id", getReport);
router.post("/reports", createReport);
router.put("/reports/:id/approve", approveReport);
router.put("/reports/:id/reject", rejectReport);

// ── Follow-ups ───────────────────────────────────────────────────────────────
router.get("/follow-ups", listFollowUps);
router.get("/follow-ups/:id", getFollowUp);
router.post("/follow-ups", createFollowUp);
router.put("/follow-ups/:id", updateFollowUp);
router.put("/follow-ups/:id/approve", approveFollowUp);
router.put("/follow-ups/:id/reject", rejectFollowUp);

// ── Surat Pelanggaran ────────────────────────────────────────────────────────
router.get("/surat-pelanggaran", listSuratPelanggaran);
router.get("/surat-pelanggaran/:id", getSuratPelanggaran);
router.post("/surat-pelanggaran", createSuratPelanggaran);
router.put("/surat-pelanggaran/:id", updateSuratPelanggaran);
router.post("/surat-pelanggaran/check-overdue", checkOverdueFollowUps);

// ── Inspection Requests (User → Planner) ─────────────────────────────────────
router.get("/requests", listRequests);
router.get("/requests/:id", getRequest);
router.post("/requests", createRequest);
router.put("/requests/:id/approve", approveRequest);
router.put("/requests/:id/reject", rejectRequest);
router.put("/requests/:id/cancel", cancelRequest);

// ── Supervisi ───────────────────────────────────────────────────────────────────────────
router.get("/supervisi/jobs", listJobs);
router.get("/supervisi/jobs/:id", getJob);
router.post("/supervisi/jobs", createJob);
router.put("/supervisi/jobs/:id", uploadJobAmendDocuments, updateJob);
router.get("/supervisi/jobs/:id/visits", listVisits);
router.post("/supervisi/visits", uploadVisitMedia, submitVisit);
router.get("/supervisi/pelanggaran", listPelanggaran);
// ── Supervisi Amend ───────────────────────────────────────────────────────────
router.get("/supervisi/jobs/:jobId/amends", listAmends);
router.post("/supervisi/jobs/:jobId/amends", uploadAmendDocuments, createAmend);
router.put("/supervisi/jobs/:jobId/amends/:amendId", uploadAmendDocuments, updateAmend);
router.delete("/supervisi/jobs/:jobId/amends/:amendId", deleteAmend);

module.exports = router;
