'use strict';

const { Op } = require('sequelize');
const sequelize = require('../../config/database');
const PreventiveWeekSchedule = require('../../models/PreventiveWeekSchedule');

// All valid intervals in order
const INTERVALS = [
  { key: '1wk',  weeks: 1  },
  { key: '2wk',  weeks: 2  },
  { key: '3wk',  weeks: 3  },
  { key: '4wk',  weeks: 4  },
  { key: '8wk',  weeks: 8  },
  { key: '12wk', weeks: 12 },
  { key: '16wk', weeks: 16 },
  { key: '24wk', weeks: 24 },
];

/**
 * Compute the Monday (weekStart) and Sunday (weekEnd) of ISO week W in a given year.
 * ISO week 1 is the week containing January 4th.
 */
function getISOWeekDateRange(week, year) {
  // Use UTC throughout so toISOString() never shifts the date
  const jan4 = new Date(Date.UTC(year, 0, 4));
  const jan4Day = jan4.getUTCDay() || 7; // convert 0 (Sun) → 7
  const week1Mon = new Date(jan4);
  week1Mon.setUTCDate(jan4.getUTCDate() - (jan4Day - 1));

  const weekStart = new Date(week1Mon);
  weekStart.setUTCDate(week1Mon.getUTCDate() + (week - 1) * 7);

  const weekEnd = new Date(weekStart);
  weekEnd.setUTCDate(weekStart.getUTCDate() + 6);

  return {
    weekStart: weekStart.toISOString().slice(0, 10),
    weekEnd:   weekEnd.toISOString().slice(0, 10),
  };
}

// GET /api/preventive-schedule?year=2026&week=15
const getForWeek = async (req, res) => {
  const week = parseInt(req.query.week, 10);
  const year = parseInt(req.query.year, 10);

  if (!week || !year || week < 1 || week > 53) {
    return res.status(400).json({ error: 'week (1-53) and year are required' });
  }

  const rows = await PreventiveWeekSchedule.findAll({
    where: { year, weekNumber: week },
    attributes: ['interval'],
    order: [['interval', 'ASC']],
  });

  // Sort by the canonical interval order
  const intervalOrder = INTERVALS.map(i => i.key);
  const activeIntervals = rows
    .map(r => r.interval)
    .sort((a, b) => intervalOrder.indexOf(a) - intervalOrder.indexOf(b));

  const { weekStart, weekEnd } = getISOWeekDateRange(week, year);

  res.json({ year, week, weekStart, weekEnd, activeIntervals });
};

// GET /api/preventive-schedule/year?year=2026
// Returns full schedule for a year: { week: N, intervals: ['1wk', ...] }[]
const getForYear = async (req, res) => {
  const year = parseInt(req.query.year, 10);
  if (!year) return res.status(400).json({ error: 'year is required' });

  const rows = await PreventiveWeekSchedule.findAll({
    where: { year },
    attributes: ['weekNumber', 'interval'],
    order: [['weekNumber', 'ASC'], ['interval', 'ASC']],
  });

  // Group by week
  const byWeek = {};
  for (const r of rows) {
    if (!byWeek[r.weekNumber]) byWeek[r.weekNumber] = [];
    byWeek[r.weekNumber].push(r.interval);
  }

  const intervalOrder = INTERVALS.map(i => i.key);
  const result = Object.entries(byWeek).map(([week, intervals]) => ({
    week: parseInt(week, 10),
    intervals: intervals.sort((a, b) => intervalOrder.indexOf(a) - intervalOrder.indexOf(b)),
  }));

  res.json({ year, schedule: result });
};

// POST /api/preventive-schedule/generate
// Body: { year: 2026, overwrite: true }
// Auto-generates the full yearly schedule using formula: interval N active at week W if (W-1) % N === 0
const generateFromFormula = async (req, res) => {
  const year = parseInt(req.body.year, 10);
  if (!year) return res.status(400).json({ error: 'year is required' });

  const overwrite = req.body.overwrite !== false; // default true

  if (overwrite) {
    await PreventiveWeekSchedule.destroy({ where: { year } });
  }

  const toInsert = [];
  for (let week = 1; week <= 53; week++) {
    for (const { key, weeks } of INTERVALS) {
      if ((week - 1) % weeks === 0) {
        toInsert.push({ year, weekNumber: week, interval: key });
      }
    }
  }

  await PreventiveWeekSchedule.bulkCreate(toInsert, {
    ignoreDuplicates: true,
  });

  res.json({ message: `Generated schedule for ${year}`, count: toInsert.length, year });
};

// DELETE /api/preventive-schedule?year=2026
const clearYear = async (req, res) => {
  const year = parseInt(req.query.year, 10);
  if (!year) return res.status(400).json({ error: 'year is required' });

  const count = await PreventiveWeekSchedule.destroy({ where: { year } });
  res.json({ message: `Cleared ${count} schedule entries for ${year}`, year });
};

// POST /api/preventive-schedule/toggle
// Body: { year, week, interval }  →  toggles the cell on/off
const toggleCell = async (req, res) => {
  const year     = parseInt(req.body.year, 10);
  const week     = parseInt(req.body.week, 10);
  const interval = req.body.interval;

  if (!year || !week || !interval) {
    return res.status(400).json({ error: 'year, week, interval are required' });
  }
  if (week < 1 || week > 53) {
    return res.status(400).json({ error: 'week must be 1–53' });
  }
  if (!INTERVALS.find(i => i.key === interval)) {
    return res.status(400).json({ error: 'invalid interval: ' + interval });
  }

  const existing = await PreventiveWeekSchedule.findOne({
    where: { year, weekNumber: week, interval },
  });

  if (existing) {
    await existing.destroy();
    return res.json({ year, week, interval, active: false });
  }

  await PreventiveWeekSchedule.create({ year, weekNumber: week, interval });
  return res.json({ year, week, interval, active: true });
};

module.exports = { getForWeek, getForYear, generateFromFormula, clearYear, toggleCell };
