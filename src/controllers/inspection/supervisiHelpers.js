"use strict";

const { Op } = require("sequelize");
const User = require("../../models/User");

const APP_TIME_ZONE = "Asia/Jakarta";
const MAX_LOCATION_RADIUS_METRES = 300;
const DEFAULT_LOCATION_RADIUS_METRES = 100;

const APP_DATE_FORMATTER = new Intl.DateTimeFormat("en-US", {
  timeZone: APP_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

function hasOwn(obj, key) {
  return Object.prototype.hasOwnProperty.call(obj, key);
}

function normalizeNullableString(value) {
  if (value === undefined || value === null) return null;
  const text = String(value).trim();
  return text.length > 0 ? text : null;
}

function normalizeName(value) {
  return String(value || "").trim().toLowerCase();
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
    return value.map((item) => normalizeNullableString(item)).filter(Boolean);
  }

  if (value === null || value === "") return [];

  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) {
        return parsed.map((item) => normalizeNullableString(item)).filter(Boolean);
      }
    } catch (_err) {
      return [];
    }
  }

  return [];
}

function parseDraftFlag(value) {
  if (value === true || value === 1) return true;
  if (!value) return false;

  const str = Array.isArray(value) ? value[0] : String(value);
  return str.trim() === "true" || str.trim() === "1";
}

function getAppDateString(date = new Date()) {
  const parts = APP_DATE_FORMATTER.formatToParts(date).reduce((acc, part) => {
    if (part.type !== "literal") acc[part.type] = part.value;
    return acc;
  }, {});
  return `${parts.year}-${parts.month}-${parts.day}`;
}

function normalizeDateOnly(value) {
  if (!value) return null;
  if (value instanceof Date) return value.toISOString().split("T")[0];
  return String(value).slice(0, 10);
}

function addDaysDateOnly(dateString, days) {
  const [year, month, day] = String(dateString).split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().split("T")[0];
}

function maxDateOnly(values) {
  const sorted = values.map(normalizeDateOnly).filter(Boolean).sort();
  return sorted.length > 0 ? sorted[sorted.length - 1] : null;
}

function haversineMetres(lat1, lon1, lat2, lon2) {
  const earthRadiusMetres = 6371000;
  const toRad = (value) => (value * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return earthRadiusMetres * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function hasFiniteCoordinates(latitude, longitude) {
  return (
    latitude !== undefined &&
    latitude !== null &&
    longitude !== undefined &&
    longitude !== null &&
    Number.isFinite(Number(latitude)) &&
    Number.isFinite(Number(longitude))
  );
}

function parseLocations(value) {
  let rawLocations = [];

  if (Array.isArray(value)) {
    rawLocations = value;
  } else if (typeof value === "string" && value.trim()) {
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) rawLocations = parsed;
    } catch (_err) {
      rawLocations = [];
    }
  }

  return rawLocations
    .map((location) => {
      const latitude = parseFloat(location && location.latitude);
      const longitude = parseFloat(location && location.longitude);
      const radius = Math.min(
        parseFloat((location && location.radius) || DEFAULT_LOCATION_RADIUS_METRES) ||
          DEFAULT_LOCATION_RADIUS_METRES,
        MAX_LOCATION_RADIUS_METRES,
      );

      if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
        return null;
      }

      return {
        id: String((location && location.id) || Math.random().toString(36).substring(2, 10)),
        namaArea: String((location && location.namaArea) || "").trim(),
        latitude,
        longitude,
        radius,
      };
    })
    .filter(Boolean);
}

function resolveSupervisiGeofenceTarget(job, locationId) {
  const locations = Array.isArray(job && job.locations) ? job.locations : [];
  let targetLocation = null;

  if (locations.length > 0 && locationId) {
    targetLocation = locations.find((loc) => String(loc.id) === String(locationId || ""));
  }

  if (!targetLocation && locations.length === 1 && !locationId) {
    targetLocation = locations[0];
  }

  if (locations.length > 1 && !targetLocation) {
    return null;
  }

  const targetLatitude = targetLocation
    ? parseFloat(targetLocation.latitude)
    : parseFloat(job && job.latitude);
  const targetLongitude = targetLocation
    ? parseFloat(targetLocation.longitude)
    : parseFloat(job && job.longitude);
  const radius = targetLocation
    ? parseFloat(targetLocation.radius)
    : parseFloat((job && job.radius) || DEFAULT_LOCATION_RADIUS_METRES);

  if (!Number.isFinite(targetLatitude) || !Number.isFinite(targetLongitude)) {
    return null;
  }

  const effectiveRadius = Number.isFinite(radius)
    ? radius
    : DEFAULT_LOCATION_RADIUS_METRES;

  return {
    locationId: targetLocation ? String(targetLocation.id || "") : null,
    namaArea: targetLocation ? targetLocation.namaArea || null : job && job.namaArea,
    latitude: targetLatitude,
    longitude: targetLongitude,
    radius: effectiveRadius,
  };
}

function evaluateSupervisiGeofence(job, locationId, visitLatitude, visitLongitude) {
  if (!hasFiniteCoordinates(visitLatitude, visitLongitude)) {
    return { status: "missing_visit" };
  }

  const target = resolveSupervisiGeofenceTarget(job, locationId);
  if (!target) {
    return { status: "missing_target" };
  }

  const distance = haversineMetres(
    target.latitude,
    target.longitude,
    Number(visitLatitude),
    Number(visitLongitude),
  );
  const outsideMeters = distance > target.radius
    ? Math.round(distance - target.radius)
    : 0;

  return {
    status: outsideMeters > 0 ? "outside" : "inside",
    distanceMeters: Math.round(distance),
    outsideMeters,
    radius: target.radius,
    target,
  };
}

function calculateDistanceOutsideRadius(job, locationId, visitLatitude, visitLongitude) {
  const evaluation = evaluateSupervisiGeofence(
    job,
    locationId,
    visitLatitude,
    visitLongitude,
  );
  if (
    evaluation.status === "missing_visit" ||
    evaluation.status === "missing_target"
  ) {
    return null;
  }
  return evaluation.outsideMeters;
}

function isRadiusExemptionActive(job, dateString = getAppDateString()) {
  const start = normalizeDateOnly(job && job.radiusExemptionStartDate);
  const end = normalizeDateOnly(job && job.radiusExemptionEndDate);
  const date = normalizeDateOnly(dateString);

  if (!start || !end || !date) return false;
  return start <= date && date <= end;
}

function validateRadiusExemptionDates(startDate, endDate) {
  const start = normalizeDateOnly(startDate);
  const end = normalizeDateOnly(endDate);

  if (!start && !end) return null;
  if (!start || !end) {
    return "Tanggal mulai dan tanggal akhir pengecualian radius wajib diisi.";
  }
  if (end < start) {
    return "Tanggal akhir pengecualian radius tidak boleh lebih awal dari tanggal mulai.";
  }
  return null;
}

function buildRadiusExemptionPatch(body, currentJob, user) {
  const keys = [
    "radiusExemptionStartDate",
    "radiusExemptionEndDate",
    "radiusExemptionReason",
  ];
  const hasPayload = keys.some((key) => hasOwn(body, key));
  if (!hasPayload) return { hasPayload: false, patch: {}, error: null };

  const nextStart = hasOwn(body, "radiusExemptionStartDate")
    ? parseNullableDate(body.radiusExemptionStartDate)
    : normalizeDateOnly(currentJob && currentJob.radiusExemptionStartDate);
  const nextEnd = hasOwn(body, "radiusExemptionEndDate")
    ? parseNullableDate(body.radiusExemptionEndDate)
    : normalizeDateOnly(currentJob && currentJob.radiusExemptionEndDate);
  const nextReason = hasOwn(body, "radiusExemptionReason")
    ? normalizeNullableString(body.radiusExemptionReason)
    : normalizeNullableString(currentJob && currentJob.radiusExemptionReason);

  if (!nextStart && !nextEnd && nextReason) {
    return {
      hasPayload: true,
      patch: {},
      error: "Tanggal mulai dan tanggal akhir pengecualian radius wajib diisi.",
    };
  }

  const error = validateRadiusExemptionDates(nextStart, nextEnd);
  if (error) return { hasPayload: true, patch: {}, error };

  const isClearing = !nextStart && !nextEnd;
  const hasExistingExemption = Boolean(
    currentJob &&
      (
        currentJob.radiusExemptionStartDate ||
        currentJob.radiusExemptionEndDate ||
        currentJob.radiusExemptionReason ||
        currentJob.radiusExemptionBy ||
        currentJob.radiusExemptionUpdatedAt
      ),
  );

  if (isClearing && !hasExistingExemption) {
    return { hasPayload: false, error: null, patch: {} };
  }

  return {
    hasPayload: true,
    error: null,
    patch: {
      radiusExemptionStartDate: isClearing ? null : nextStart,
      radiusExemptionEndDate: isClearing ? null : nextEnd,
      radiusExemptionReason: isClearing ? null : nextReason,
      radiusExemptionBy: isClearing ? null : normalizeNullableString(user && user.nik),
      radiusExemptionUpdatedAt: new Date(),
    },
  };
}

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
    for (const user of users) {
      if (user.nik) map[user.nik] = user.name || null;
    }
    return map;
  } catch (_err) {
    return {};
  }
}

function enrichJobWithNames(jobData, nikNameMap) {
  const obj = typeof jobData.toJSON === "function" ? jobData.toJSON() : { ...jobData };
  obj.creatorName = nikNameMap[obj.createdBy] || null;

  if (Array.isArray(obj.visits)) {
    obj.visits = obj.visits.map((visitData) => {
      const visit =
        typeof visitData.toJSON === "function" ? visitData.toJSON() : { ...visitData };
      visit.submitterName = nikNameMap[visit.submittedBy] || null;
      return visit;
    });
  }

  return obj;
}

function addCurrentUserNameFallback(nikNameMap, user) {
  const nik = normalizeNullableString(user && user.nik);
  const name = normalizeNullableString(user && user.name);
  if (nik && name && !nikNameMap[nik]) {
    nikNameMap[nik] = name;
  }
}

module.exports = {
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
  normalizeName,
  normalizeNullableString,
  parseDraftFlag,
  parseLocations,
  parseNullableDate,
  parseNullableFloat,
  parseStringArray,
};
