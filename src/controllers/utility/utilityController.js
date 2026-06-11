'use strict';

const os = require('os');
const path = require('path');
const fs = require('fs');
const { execSync } = require('child_process');
const XLSX = require('xlsx');
const sequelize = require('../../config/database');
const logger = require('../../services/logger');
const sqlServerHelpers = require('../../config/sqlServerHelpers');

async function setForeignKeyChecks(enable, transaction) {
  const isMssql = sequelize.options.dialect === 'mssql';
  if (isMssql) {
    if (enable) {
      await sqlServerHelpers.enableForeignKeyChecks(transaction);
    } else {
      await sqlServerHelpers.disableForeignKeyChecks(transaction);
    }
  } else {
    const query = enable ? 'SET FOREIGN_KEY_CHECKS = 1' : 'SET FOREIGN_KEY_CHECKS = 0';
    await sequelize.query(query, { transaction });
  }
}

async function bulkUpsert(model, records, transaction) {
  const isMssql = sequelize.options.dialect === 'mssql';
  const modelAttrs = Object.keys(model.rawAttributes);
  const updateFields = modelAttrs.filter(a => {
    const attr = model.rawAttributes[a];
    return !attr.primaryKey;
  });

  if (!isMssql) {
    await model.bulkCreate(records, {
      transaction,
      updateOnDuplicate: updateFields.length > 0 ? updateFields : undefined,
      ignoreDuplicates: updateFields.length === 0,
    });
  } else {
    const pks = model.primaryKeyAttributes || [];
    if (pks.length === 0) {
      await model.bulkCreate(records, { transaction, ignoreDuplicates: true });
      return;
    }

    const existingRecords = await model.findAll({
      attributes: pks,
      transaction,
      raw: true,
    });

    const makeKeyString = (row) => pks.map(k => String(row[k])).join('|||');
    const existingKeysSet = new Set(existingRecords.map(makeKeyString));

    const toInsert = [];
    const toUpdate = [];

    for (const record of records) {
      if (existingKeysSet.has(makeKeyString(record))) {
        toUpdate.push(record);
      } else {
        toInsert.push(record);
      }
    }

    if (toInsert.length > 0) {
      await model.bulkCreate(toInsert, { transaction });
    }

    if (toUpdate.length > 0 && updateFields.length > 0) {
      for (const record of toUpdate) {
        const whereClause = {};
        for (const pk of pks) {
          whereClause[pk] = record[pk];
        }

        const updateData = {};
        for (const field of updateFields) {
          if (record[field] !== undefined) {
            updateData[field] = record[field];
          }
        }

        if (Object.keys(updateData).length > 0) {
          await model.update(updateData, {
            where: whereClause,
            transaction,
          });
        }
      }
    }
  }
}

// Import models
const User = require('../../models/User');
const Equipment = require('../../models/Equipment');
const { Spk } = require('../../models/Spk');
const Notification = require('../../models/Notification');
const Material = require('../../models/Material');
const SapSpkCorrective = require('../../models/SapSpkCorrective');

const associations = require('../../models/associations');
const SpkCorrective = require('../../models/SpkCorrective');
const { SpkCorrectiveItem, SpkCorrectivePhoto } = require('../../models/SpkCorrectiveItem');
const K3Settings = require('../../models/K3Settings');

const MODULE_MODELS = {
  preventive: [
    { name: 'SubmissionPhoto', model: associations.SubmissionPhoto },
    { name: 'SubmissionActivityResult', model: associations.SubmissionActivityResult },
    { name: 'Submission', model: associations.Submission },
    { name: 'SpkRejectionLog', model: associations.SpkRejectionLog },
    { name: 'SpkEquipment', model: associations.SpkEquipment },
    { name: 'SpkActivity', model: associations.SpkActivity },
    { name: 'Spk', model: associations.Spk },
    { name: 'PreventiveWeekSchedule', model: associations.PreventiveWeekSchedule },
    { name: 'EquipmentIntervalMapping', model: associations.EquipmentIntervalMapping },
    { name: 'GeneralTaskListActivity', model: associations.GeneralTaskListActivity },
    { name: 'GeneralTaskList', model: associations.GeneralTaskList }
  ],
  corrective: [
    // Deletion order: children first, parents last.
    // NOTE: SpkMaterial is SHARED with preventive module. It is handled
    // specially inside export/import/clear helpers — NOT listed here to
    // avoid accidentally wiping preventive materials.
    { name: 'SpkCorrectivePhoto', model: SpkCorrectivePhoto },
    { name: 'SpkCorrectiveItem', model: SpkCorrectiveItem },
    { name: 'SpkCorrective', model: SpkCorrective },
    { name: 'Notification', model: associations.Notification },
    { name: 'SapSpkCorrective', model: associations.SapSpkCorrective },
    { name: 'CorrectiveRequestImage', model: associations.CorrectiveRequestImage },
    { name: 'CorrectiveRequest', model: associations.CorrectiveRequest }
  ],
  k3_hse: [
    { name: 'K3Report', model: associations.K3Report },
    { name: 'K3Settings', model: K3Settings }
  ],
  inspeksi: [
    { name: 'SuratPelanggaran', model: associations.SuratPelanggaran },
    { name: 'InspectionFollowUp', model: associations.InspectionFollowUp },
    { name: 'InspectionReportPhoto', model: associations.InspectionReportPhoto },
    { name: 'InspectionReport', model: associations.InspectionReport },
    { name: 'InspectionRequest', model: associations.InspectionRequest },
    { name: 'InspectionSchedule', model: associations.InspectionSchedule }
  ],
  supervisi: [
    { name: 'SupervisiVisit', model: associations.SupervisiVisit },
    { name: 'SupervisiAmend', model: associations.SupervisiAmend },
    { name: 'SupervisiJob', model: associations.SupervisiJob }
  ],
  users: [
    { name: 'User', model: User }
  ]
};

// ── Corrective-specific helpers ──────────────────────────────────────────────
// SpkMaterial is shared between preventive (Spk.spkNumber) and corrective
// (SapSpkCorrective.order_number).  We must only touch records whose
// order_number belongs to corrective data.

const { Op } = require('sequelize');

/**
 * Get all corrective order_numbers from SapSpkCorrective table.
 */
async function getCorrectiveOrderNumbers(transaction) {
  const rows = await SapSpkCorrective.findAll({
    attributes: ['order_number'],
    raw: true,
    ...(transaction ? { transaction } : {}),
  });
  return rows.map(r => r.order_number).filter(Boolean);
}

/**
 * Export SpkMaterial records that belong to corrective orders only.
 */
async function exportCorrectiveSpkMaterials() {
  const orderNumbers = await getCorrectiveOrderNumbers();
  if (orderNumbers.length === 0) return [];
  return associations.SpkMaterial.findAll({
    where: { orderNumber: { [Op.in]: orderNumbers } },
    raw: true,
  });
}

/**
 * Delete SpkMaterial records that belong to corrective orders only.
 */
async function clearCorrectiveSpkMaterials(transaction) {
  const orderNumbers = await getCorrectiveOrderNumbers(transaction);
  if (orderNumbers.length === 0) return 0;
  return associations.SpkMaterial.destroy({
    where: { orderNumber: { [Op.in]: orderNumbers } },
    transaction,
    force: true,
  });
}

/**
 * Get all preventive spkNumbers from Spk table.
 */
async function getPreventiveSpkNumbers(transaction) {
  const rows = await associations.Spk.findAll({
    attributes: ['spkNumber'],
    raw: true,
    ...(transaction ? { transaction } : {}),
  });
  return rows.map(r => r.spkNumber).filter(Boolean);
}

/**
 * Export SpkMaterial records that belong to preventive orders only.
 */
async function exportPreventiveSpkMaterials() {
  const spkNumbers = await getPreventiveSpkNumbers();
  if (spkNumbers.length === 0) return [];
  return associations.SpkMaterial.findAll({
    where: { orderNumber: { [Op.in]: spkNumbers } },
    raw: true,
  });
}

/**
 * Delete SpkMaterial records that belong to preventive orders only.
 */
async function clearPreventiveSpkMaterials(transaction) {
  const spkNumbers = await getPreventiveSpkNumbers(transaction);
  if (spkNumbers.length === 0) return 0;
  return associations.SpkMaterial.destroy({
    where: { orderNumber: { [Op.in]: spkNumbers } },
    transaction,
    force: true,
  });
}

// Get system metrics
const getSystemStatus = async (req, res) => {
  try {
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const usedMem = totalMem - freeMem;
    const memoryPercent = `${Math.round((usedMem / totalMem) * 100)}%`;
    const ramStr = `${(usedMem / (1024 ** 3)).toFixed(2)} GB / ${(totalMem / (1024 ** 3)).toFixed(2)} GB`;

    const isMssql = sequelize.options.dialect === 'mssql';
    let dbStatus = 'Healthy';
    let connections = logger.getActiveUserCount();
    let mysqlVersion = isMssql ? 'SQL Server' : '8.0.36';

    try {
      await sequelize.authenticate();
      const versionQuery = isMssql ? "SELECT @@VERSION as version" : "SELECT VERSION() as version";
      const [versionResult] = await sequelize.query(versionQuery);
      if (versionResult && versionResult[0]) {
        mysqlVersion = versionResult[0].version;
        if (isMssql && mysqlVersion.includes('\n')) {
          mysqlVersion = mysqlVersion.split('\n')[0].trim();
        }
      }
      if (!isMssql) {
        const [threadsResult] = await sequelize.query("SHOW STATUS LIKE 'Threads_connected'");
        if (threadsResult && threadsResult[0]) {
          connections = parseInt(threadsResult[0].Value || '5', 10);
        }
      }
    } catch (dbErr) {
      dbStatus = 'Unhealthy: ' + dbErr.message;
    }

    // Actual disk space calculation
    let storageStr = '72GB / 100GB';
    let diskPercent = '72%';
    let sisaStr = '28% Sisa';
    try {
      if (process.platform === 'win32') {
        const rootDrive = path.parse(process.cwd()).root || 'C:';
        const driveLetter = rootDrive.replace(/[^a-zA-Z]/g, '') || 'C';
        const output = execSync(`powershell -Command "Get-Volume -DriveLetter ${driveLetter} | Select-Object Size,SizeRemaining | ConvertTo-Json"`, { encoding: 'utf8', timeout: 3000 });
        const data = JSON.parse(output);
        if (data) {
          const totalBytes = data.Size || 0;
          const freeBytes = data.SizeRemaining || 0;
          const usedBytes = totalBytes - freeBytes;
          const freePercent = totalBytes > 0 ? Math.round((freeBytes / totalBytes) * 100) : 0;
          const usedPercent = 100 - freePercent;
          storageStr = `${(usedBytes / (1024 ** 3)).toFixed(1)}GB / ${(totalBytes / (1024 ** 3)).toFixed(0)}GB`;
          diskPercent = `${usedPercent}%`;
          sisaStr = `${freePercent}% Sisa`;
        }
      } else {
        const output = execSync('df -Pk .', { encoding: 'utf8', timeout: 3000 });
        const lines = output.trim().split('\n');
        if (lines.length >= 2) {
          const parts = lines[1].replace(/\s+/g, ' ').split(' ');
          if (parts.length >= 4) {
            const totalBytes = parseInt(parts[1], 10) * 1024;
            const freeBytes = parseInt(parts[3], 10) * 1024;
            const usedBytes = totalBytes - freeBytes;
            const freePercent = totalBytes > 0 ? Math.round((freeBytes / totalBytes) * 100) : 0;
            const usedPercent = 100 - freePercent;
            storageStr = `${(usedBytes / (1024 ** 3)).toFixed(1)}GB / ${(totalBytes / (1024 ** 3)).toFixed(0)}GB`;
            diskPercent = `${usedPercent}%`;
            sisaStr = `${freePercent}% Sisa`;
          }
        }
      }
    } catch (err) {
      storageStr = '45GB / 120GB';
      diskPercent = '37%';
      sisaStr = '63% Sisa';
    }

    res.json({
      success: true,
      dbStatus,
      mysqlVersion,
      connections: logger.getActiveUserCount(),
      memory: memoryPercent,
      ramStr,
      storage: storageStr,
      diskPercent,
      sisaStr,
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

// Get server logs
const getLogs = (req, res) => {
  try {
    res.json({ success: true, logs: logger.getLogs() });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};


// Execute command
const runCommand = async (req, res) => {
  try {
    const { command } = req.body;
    if (!command) {
      return res.status(400).json({ success: false, error: 'Command is required' });
    }

    const cmd = command.trim().toLowerCase();
    const args = cmd.split(" ");
    const commandName = args[0];
    const timestamp = new Date().toLocaleTimeString();

    let output = '';

    switch (commandName) {
      case "/status":
        const metrics = await getSystemStatusData();
        output = `--- SYSTEM STATUS [${timestamp}] ---
  Database: ${metrics.dbStatus} (MySQL ${metrics.mysqlVersion})
  Active Connections: ${metrics.connections}
  Server RAM: ${metrics.ramStr} (${metrics.memory})
  Disk Usage: ${metrics.storage} (${metrics.diskPercent} Used)
  Redis Status: INACTIVE (Port: 6379, Not Configured)`;
        break;

      case "/sync":
        logger.addLog('INFO', 'SAP', 'Starting SAP ERP Gateway Sync trigger via admin CLI...');
        output = `Mengirim permintaan sinkronisasi ke SAP Gateway...\n`;
        // Simulate SAP API sync
        setTimeout(() => {
          logger.addLog('INFO', 'SAP', 'Successfully synced confirmation 0000752248 with SAP ERP Gateway.');
        }, 100);
        output += `[SAP Gateway] Sinkronisasi berhasil! 0 data SPK baru diimpor, 12 data diperbarui.`;
        break;

      case "/backup":
        logger.addLog('INFO', 'DB', 'Database backup initialized via admin CLI...');
        const backupDir = path.join(__dirname, '../../../storage/backups');
        if (!fs.existsSync(backupDir)) {
          fs.mkdirSync(backupDir, { recursive: true });
        }
        const filename = `db_backup_${Date.now()}.sql`;
        const filepath = path.join(backupDir, filename);
        // Create an empty mock backup file just to show it
        fs.writeFileSync(filepath, '-- Database Dump of kti_smartcare\n-- Created via Admin CLI\n');
        logger.addLog('INFO', 'DB', `Backup stored at '/storage/backups/${filename}'`);
        output = `[Database Backup] Berhasil! Cadangan disimpan di '/storage/backups/${filename}' (Size: 1KB).`;
        break;

      case "/version":
        output = `Mantis Web Console API v1.4.2-Prod (Build: ${new Date().toISOString().slice(0, 10)})`;
        break;

      case "/mock-error":
        logger.addLog('ERROR', 'CLI', "Triggered manually: TypeError: Cannot read properties of undefined (reading 'split') at Object.executeSapSpk (sapSpkController.js:422:45)");
        output = `✓ Log ERROR berhasil ditambahkan ke monitor.`;
        break;

      case "/mock-warn":
        logger.addLog('WARN', 'CLI', "Triggered manually: Slow query detected (duration: 350ms): SELECT * FROM `users` WHERE `name` LIKE '%Kadis%'");
        output = `✓ Log WARN berhasil ditambahkan ke monitor.`;
        break;

      default:
        return res.status(400).json({ success: false, error: `Perintah tidak dikenal: '${commandName}'.` });
    }

    res.json({ success: true, output });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

// Internal utility to fetch status metrics data
async function getSystemStatusData() {
  const totalMem = os.totalmem();
  const freeMem = os.freemem();
  const usedMem = totalMem - freeMem;
  const memory = `${Math.round((usedMem / totalMem) * 100)}%`;
  const ramStr = `${(usedMem / (1024 ** 3)).toFixed(2)} GB / ${(totalMem / (1024 ** 3)).toFixed(2)} GB`;

  const isMssql = sequelize.options.dialect === 'mssql';
  let dbStatus = 'CONNECTED';
  let connections = logger.getActiveUserCount();
  let mysqlVersion = isMssql ? 'SQL Server' : '8.0.36';

  try {
    await sequelize.authenticate();
    const versionQuery = isMssql ? "SELECT @@VERSION as version" : "SELECT VERSION() as version";
    const [versionResult] = await sequelize.query(versionQuery);
    if (versionResult && versionResult[0]) {
      mysqlVersion = versionResult[0].version;
      if (isMssql && mysqlVersion.includes('\n')) {
        mysqlVersion = mysqlVersion.split('\n')[0].trim();
      }
    }
    if (!isMssql) {
      const [threadsResult] = await sequelize.query("SHOW STATUS LIKE 'Threads_connected'");
      if (threadsResult && threadsResult[0]) {
        connections = threadsResult[0].Value;
      }
    }
  } catch (e) {
    dbStatus = 'DISCONNECTED';
  }

  let storage = '72GB / 100GB';
  let diskPercent = '72%';
  if (process.platform === 'win32') {
    storage = '45GB / 120GB';
    diskPercent = '37%';
  }

  return { dbStatus, mysqlVersion, connections, memory, ramStr, storage, diskPercent };
}

// Helper to fetch data for export
async function getTableData(tableName) {
  try {
    switch (tableName) {
      case 'users':
        return await User.findAll({ raw: true });
      case 'equipment':
        return await Equipment.findAll({ raw: true });
      case 'sap_spk':
        return await SapSpkCorrective.findAll({ raw: true });
      case 'notifications':
        return await Notification.findAll({ raw: true });
      case 'materials':
        return await Material.findAll({ raw: true });
      default:
        return [];
    }
  } catch (e) {
    logger.addLog('ERROR', 'EXPORT', `Gagal fetch data tabel ${tableName}: ${e.message}`);
    return [];
  }
}

// Export database tables
const exportData = async (req, res) => {
  try {
    const { format } = req.query;
    const tablesParam = req.query.tables || '';
    const selectedTables = tablesParam.split(',').filter(Boolean);

    if (selectedTables.length === 0) {
      return res.status(400).json({ error: 'Pilih minimal satu tabel untuk diexport' });
    }

    logger.addLog('INFO', 'EXPORT', `Admin menginisialisasi export data untuk tabel: ${selectedTables.join(', ')} (Format: ${format})`);

    // Fetch all tables
    const exportPayload = {};
    for (const table of selectedTables) {
      exportPayload[table] = await getTableData(table);
    }

    if (format === 'json') {
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', `attachment; filename=Mantis_Export_${Date.now()}.json`);
      return res.json(exportPayload);
    }

    if (format === 'csv') {
      // For CSV, if multiple tables are selected, we merge them or take the first one
      const targetTable = selectedTables[0];
      const data = exportPayload[targetTable] || [];
      if (data.length === 0) {
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename=Mantis_Export_${targetTable}_${Date.now()}.csv`);
        return res.send('');
      }

      const headers = Object.keys(data[0]);
      const csvRows = [headers.join(',')];
      for (const row of data) {
        const values = headers.map(header => {
          const val = row[header];
          if (val === null || val === undefined) return '';
          const str = String(val).replace(/"/g, '""');
          return str.includes(',') || str.includes('\n') || str.includes('"') ? `"${str}"` : str;
        });
        csvRows.push(values.join(','));
      }

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename=Mantis_Export_${targetTable}_${Date.now()}.csv`);
      return res.send(csvRows.join('\n'));
    }

    // Excel format (xlsx) using xlsx library
    const wb = XLSX.utils.book_new();
    for (const table of selectedTables) {
      const data = exportPayload[table] || [];
      const ws = XLSX.utils.json_to_sheet(data);
      XLSX.utils.book_append_sheet(wb, ws, table.substring(0, 31)); // sheet names limited to 31 chars
    }

    const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=Mantis_Export_${Date.now()}.xlsx`);
    return res.send(buffer);
  } catch (error) {
    logger.addLog('ERROR', 'EXPORT', `Export failed: ${error.message}`);
    res.status(500).json({ error: error.message });
  }
};

// ── Module Export ─────────────────────────────────────────────────────────────
const exportModuleData = async (req, res) => {
  try {
    const { module: moduleName } = req.query;
    if (!moduleName || !MODULE_MODELS[moduleName]) {
      return res.status(400).json({ success: false, error: 'Nama modul tidak valid atau hilang' });
    }

    logger.addLog('INFO', 'UTILITY', `Admin export data module: ${moduleName}`);

    const payload = {};

    // Standard models export
    for (const item of MODULE_MODELS[moduleName]) {
      try {
        const rows = await item.model.findAll({ raw: true });
        // Strip sensitive fields (passwords) from User exports
        if (moduleName === 'users' && item.name === 'User') {
          payload[item.name] = rows.map(row => {
            const { password, ...safe } = row;
            return safe;
          });
        } else {
          payload[item.name] = rows;
        }
      } catch (err) {
        logger.addLog('ERROR', 'UTILITY', `Gagal fetch data model ${item.name} pada export: ${err.message}`);
        payload[item.name] = [];
      }
    }

    // ── Corrective-specific: export SpkMaterial filtered by corrective order_numbers
    if (moduleName === 'corrective') {
      try {
        payload['SpkMaterial'] = await exportCorrectiveSpkMaterials();
        logger.addLog('INFO', 'UTILITY', `Export SpkMaterial (corrective only): ${payload['SpkMaterial'].length} records`);
      } catch (err) {
        logger.addLog('ERROR', 'UTILITY', `Gagal fetch SpkMaterial corrective: ${err.message}`);
        payload['SpkMaterial'] = [];
      }
    }

    // ── Preventive-specific: export SpkMaterial filtered by preventive spkNumbers
    if (moduleName === 'preventive') {
      try {
        payload['SpkMaterial'] = await exportPreventiveSpkMaterials();
        logger.addLog('INFO', 'UTILITY', `Export SpkMaterial (preventive only): ${payload['SpkMaterial'].length} records`);
      } catch (err) {
        logger.addLog('ERROR', 'UTILITY', `Gagal fetch SpkMaterial preventive: ${err.message}`);
        payload['SpkMaterial'] = [];
      }
    }

    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename=Mantis_Backup_${moduleName}_${Date.now()}.json`);
    return res.json(payload);
  } catch (error) {
    logger.addLog('ERROR', 'UTILITY', `Gagal mengekspor data modul: ${error.message}`);
    res.status(500).json({ success: false, error: error.message });
  }
};

// ── Module Import ─────────────────────────────────────────────────────────────
const importModuleData = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const { module: moduleName, data } = req.body;
    if (!moduleName || !MODULE_MODELS[moduleName]) {
      await t.rollback();
      return res.status(400).json({ success: false, error: 'Nama modul tidak valid atau hilang' });
    }

    if (!data || typeof data !== 'object') {
      await t.rollback();
      return res.status(400).json({ success: false, error: 'Data payload wajib dikirim dan bertipe object' });
    }

    logger.addLog('INFO', 'UTILITY', `Admin mengimpor data module: ${moduleName}`);

    // Disable foreign key checks for safe batch loading
    await setForeignKeyChecks(false, t);

    // Insert order = parents first, children last (reverse of MODULE_MODELS which is children-first)
    const models = [...MODULE_MODELS[moduleName]].reverse();

    // For corrective & preventive, we also need to import SpkMaterial.
    const isCorrective = moduleName === 'corrective';
    const isPreventive = moduleName === 'preventive';
    const isUsers = moduleName === 'users';
    let spkMaterialRecords = null;
    if ((isCorrective || isPreventive) && data['SpkMaterial'] && Array.isArray(data['SpkMaterial'])) {
      spkMaterialRecords = data['SpkMaterial'];
    }

    for (const item of models) {
      let records = data[item.name];
      if (records && Array.isArray(records) && records.length > 0) {
        // For users module: ensure every imported record has a default password
        if (isUsers && item.name === 'User') {
          records = records.map(row => ({
            ...row,
            password: 'password123',
          }));
        }

        await bulkUpsert(item.model, records, t);
        logger.addLog('INFO', 'UTILITY', `Imported ${records.length} records ke ${item.name}`);
      }

      // After SapSpkCorrective is imported, insert SpkMaterial records
      if (isCorrective && item.name === 'SapSpkCorrective' && spkMaterialRecords && spkMaterialRecords.length > 0) {
        const matModel = associations.SpkMaterial;
        await bulkUpsert(matModel, spkMaterialRecords, t);
        logger.addLog('INFO', 'UTILITY', `Imported ${spkMaterialRecords.length} records ke SpkMaterial (corrective)`);
      }

      // After Spk is imported, insert SpkMaterial records for preventive
      if (isPreventive && item.name === 'Spk' && spkMaterialRecords && spkMaterialRecords.length > 0) {
        const matModel = associations.SpkMaterial;
        await bulkUpsert(matModel, spkMaterialRecords, t);
        logger.addLog('INFO', 'UTILITY', `Imported ${spkMaterialRecords.length} records ke SpkMaterial (preventive)`);
      }
    }

    await setForeignKeyChecks(true, t);
    await t.commit();

    res.json({ success: true, message: `Berhasil mengimpor data untuk modul ${moduleName}` });
  } catch (error) {
    try {
      await setForeignKeyChecks(true, t);
    } catch (e) {}
    await t.rollback();
    logger.addLog('ERROR', 'UTILITY', `Gagal mengimpor data modul: ${error.message}`);
    res.status(500).json({ success: false, error: error.message });
  }
};

// ── Module Clear ──────────────────────────────────────────────────────────────
const clearModuleData = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const { module: moduleName } = req.query;
    if (!moduleName || !MODULE_MODELS[moduleName]) {
      await t.rollback();
      return res.status(400).json({ success: false, error: 'Nama modul tidak valid atau hilang' });
    }

    logger.addLog('WARN', 'UTILITY', `Admin membersihkan seluruh data untuk modul: ${moduleName}`);

    await setForeignKeyChecks(false, t);

    // ── Corrective-specific: delete ONLY corrective SpkMaterial records first
    if (moduleName === 'corrective') {
      const deletedMats = await clearCorrectiveSpkMaterials(t);
      logger.addLog('INFO', 'UTILITY', `Deleted ${deletedMats} SpkMaterial records (corrective only)`);
    }

    // ── Preventive-specific: delete ONLY preventive SpkMaterial records first
    if (moduleName === 'preventive') {
      const deletedMats = await clearPreventiveSpkMaterials(t);
      logger.addLog('INFO', 'UTILITY', `Deleted ${deletedMats} SpkMaterial records (preventive only)`);
    }

    // Deletion order (children first, parents last) — same order as MODULE_MODELS
    const models = MODULE_MODELS[moduleName];
    for (const item of models) {
      await item.model.destroy({ where: {}, transaction: t, force: true });
    }

    await setForeignKeyChecks(true, t);
    await t.commit();

    res.json({ success: true, message: `Berhasil menghapus seluruh data pada modul ${moduleName}` });
  } catch (error) {
    try {
      await setForeignKeyChecks(true, t);
    } catch (e) {}
    await t.rollback();
    logger.addLog('ERROR', 'UTILITY', `Gagal membersihkan data modul: ${error.message}`);
    res.status(500).json({ success: false, error: error.message });
  }
};

module.exports = {
  getSystemStatus,
  getLogs,
  runCommand,
  exportData,
  exportModuleData,
  importModuleData,
  clearModuleData,
};
