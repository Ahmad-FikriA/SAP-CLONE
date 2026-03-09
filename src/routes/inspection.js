"use strict";

const express = require("express");
const router = express.Router();
const { verifyToken } = require("../middleware/auth");

const {
  listSchedules,
  getSchedule,
  createSchedule,
  updateSchedule,
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
} = require("../controllers/inspection/followUpController");

// All inspection routes require authentication
router.use(verifyToken);

// ── Schedules ────────────────────────────────────────────────────────────────
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

module.exports = router;
