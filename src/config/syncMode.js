'use strict';

function getDbSyncMode() {
  const rawMode = String(process.env.DB_SYNC_MODE || 'safe')
    .trim()
    .toLowerCase();

  if (['safe', 'create', 'default'].includes(rawMode)) {
    return 'safe';
  }

  if (['alter', 'force', 'off', 'none'].includes(rawMode)) {
    return rawMode === 'none' ? 'off' : rawMode;
  }

  console.warn(
    `[db-sync] Unknown DB_SYNC_MODE="${process.env.DB_SYNC_MODE}". Falling back to "safe".`,
  );
  return 'safe';
}

async function syncDatabase(sequelize, context = 'startup') {
  const mode = getDbSyncMode();

  if (mode === 'off') {
    console.log(`[db-sync] Skipping database sync during ${context}.`);
    return;
  }

  const options =
    mode === 'safe'
      ? {}
      : {
          [mode]: true,
        };

  console.log(`[db-sync] Running sequelize.sync in "${mode}" mode during ${context}.`);
  await sequelize.sync(options);
}

module.exports = {
  getDbSyncMode,
  syncDatabase,
};
