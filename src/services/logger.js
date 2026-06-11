'use strict';

const logHistory = [];
const MAX_LOGS = 300;

// Save reference to original console methods
const originalLog = console.log;
const originalError = console.error;
const originalWarn = console.warn;

function addLog(level, source, message) {
  const timestamp = new Date().toISOString().replace('T', ' ').substring(0, 19);
  logHistory.push({ timestamp, level, source, message });
  if (logHistory.length > MAX_LOGS) {
    logHistory.shift();
  }
}

// Intercept console functions to capture backend activity logs in non-test environments
if (process.env.NODE_ENV !== 'test') {
  console.log = (...args) => {
    originalLog(...args);
    const msg = args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' ');
    addLog('INFO', 'SERVER', msg);
  };

  console.error = (...args) => {
    originalError(...args);
    const msg = args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' ');
    addLog('ERROR', 'SERVER', msg);
  };

  console.warn = (...args) => {
    originalWarn(...args);
    const msg = args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' ');
    addLog('WARN', 'SERVER', msg);
  };
}

function getLogs() {
  return logHistory;
}

function clearLogs() {
  logHistory.length = 0;
}

const activeUsers = new Map();

function recordUserActivity(userId, name) {
  if (!userId) return;
  activeUsers.set(userId, { name, timestamp: Date.now() });
}

function getActiveUserCount() {
  const fifteenMinutesAgo = Date.now() - 15 * 60 * 1000;
  let count = 0;
  for (const [userId, info] of activeUsers.entries()) {
    if (info.timestamp > fifteenMinutesAgo) {
      count++;
    } else {
      activeUsers.delete(userId);
    }
  }
  return Math.max(1, count); // at least 1 (the user themselves)
}

module.exports = {
  getLogs,
  clearLogs,
  addLog,
  recordUserActivity,
  getActiveUserCount,
};
