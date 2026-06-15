"use strict";

const express = require("express");
const router = express.Router();
const { verifyToken } = require("../middleware/auth");

const {
  listSchedules,
  getSchedule,
  createSchedule,
  updateSchedule,
  deleteSchedule,
  getNextSpkNumber,
  createRecurringSchedules,
} = require("../controllers/inspection/scheduleController");

const {
  listReports,
  getReport,
  createReport,
  updateReport,
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
  listPersonnel,
  listJobs,
  getJob,
  createJob,
  updateJob,
  deleteJob,
  listVisits,
  submitVisit,
  listPelanggaran,
  submitViolationReason,
  undoVisit,
} = require("../controllers/inspection/supervisiController");

const {
  uploadAmendDocuments,
  createAmend,
  updateAmend,
  deleteAmend,
  listAmends,
} = require("../controllers/inspection/supervisiAmendController");

const {
  clearInspectionSupervisiData,
} = require("../controllers/inspection/adminController");



router.use(verifyToken);


router.get("/schedules/next-spk", getNextSpkNumber);
router.post("/schedules/recurring", createRecurringSchedules);
router.get("/schedules", listSchedules);
router.get("/schedules/:id", getSchedule);
router.post("/schedules", createSchedule);
router.put("/schedules/:id", updateSchedule);
router.delete("/schedules/:id", deleteSchedule);


router.get("/reports", listReports);
router.get("/reports/:id", getReport);
router.post("/reports", createReport);
router.put("/reports/:id", updateReport);
router.put("/reports/:id/approve", approveReport);
router.put("/reports/:id/reject", rejectReport);


router.get("/follow-ups", listFollowUps);
router.get("/follow-ups/:id", getFollowUp);
router.post("/follow-ups", createFollowUp);
router.put("/follow-ups/:id", updateFollowUp);
router.put("/follow-ups/:id/approve", approveFollowUp);
router.put("/follow-ups/:id/reject", rejectFollowUp);





router.get("/requests", listRequests);
router.get("/requests/:id", getRequest);
router.post("/requests", createRequest);
router.put("/requests/:id/approve", approveRequest);
router.put("/requests/:id/reject", rejectRequest);
router.put("/requests/:id/cancel", cancelRequest);

// ── Supervisi ───────────────────────────────────────────────────────────────────────────
router.get("/supervisi/personnel", listPersonnel);
router.get("/supervisi/jobs", listJobs);
router.get("/supervisi/jobs/:id", getJob);
router.post("/supervisi/jobs", createJob);
router.put("/supervisi/jobs/:id", uploadJobAmendDocuments, updateJob);
router.delete("/supervisi/jobs/:id", deleteJob);
router.get("/supervisi/jobs/:id/visits", listVisits);
router.post("/supervisi/visits", uploadVisitMedia, submitVisit);
router.get("/supervisi/pelanggaran", listPelanggaran);
router.put("/supervisi/visits/:id/violation-reason", submitViolationReason);
router.put("/supervisi/visits/:id/undo", undoVisit);
// ── Supervisi Amend ───────────────────────────────────────────────────────────
router.get("/supervisi/jobs/:jobId/amends", listAmends);
router.post("/supervisi/jobs/:jobId/amends", uploadAmendDocuments, createAmend);
router.put("/supervisi/jobs/:jobId/amends/:amendId", uploadAmendDocuments, updateAmend);
router.delete("/supervisi/jobs/:jobId/amends/:amendId", deleteAmend);

router.delete("/clear-dummy-data", clearInspectionSupervisiData);

module.exports = router;
