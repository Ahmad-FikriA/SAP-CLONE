"use strict";

const sequelize = require("../config/database");

const statusEnumCache = new Map();

function parseEnumValues(typeDefinition) {
  const rawType = String(typeDefinition || "").trim();
  const match = rawType.match(/^enum\((.*)\)$/i);
  if (!match) return [];

  return match[1]
    .split(",")
    .map((value) => value.trim().replace(/^'(.*)'$/, "$1"))
    .filter(Boolean);
}

async function getStatusEnumValues(tableName) {
  if (statusEnumCache.has(tableName)) {
    return statusEnumCache.get(tableName);
  }

  const tableDefinition = await sequelize.getQueryInterface().describeTable(
    tableName,
  );
  const enumValues = parseEnumValues(tableDefinition?.status?.type);
  statusEnumCache.set(tableName, enumValues);
  return enumValues;
}

async function resolveSupportedStatus(tableName, preferredStatus, fallbackStatus) {
  const enumValues = await getStatusEnumValues(tableName);
  if (enumValues.includes(preferredStatus)) {
    return preferredStatus;
  }

  if (enumValues.includes(fallbackStatus)) {
    return fallbackStatus;
  }

  return preferredStatus;
}

function invalidateStatusEnumCache(tableName) {
  statusEnumCache.delete(tableName);
}

module.exports = {
  getStatusEnumValues,
  resolveSupportedStatus,
  invalidateStatusEnumCache,
};
