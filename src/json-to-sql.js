#!/usr/bin/env node
'use strict';

/**
 * JSON → MySQL SQL Converter
 *
 * Reads all JSON data files in data/ and generates a single .sql file
 * with CREATE TABLE + INSERT statements for MySQL.
 *
 * Usage:  node src/json-to-sql.js
 * Output: data/kti_smartcare.sql
 */

const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', 'data');
const OUTPUT = path.join(DATA_DIR, 'kti_smartcare.sql');

function readJSON(filename) {
    const fp = path.join(DATA_DIR, filename);
    if (!fs.existsSync(fp)) return [];
    return JSON.parse(fs.readFileSync(fp, 'utf8'));
}

// MySQL-safe string escape
function esc(val) {
    if (val === null || val === undefined) return 'NULL';
    if (typeof val === 'boolean') return val ? '1' : '0';
    if (typeof val === 'number') return String(val);
    return `'${String(val).replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/\n/g, '\\n')}'`;
}

// ═══════════════════════════════════════════════════════════════
//  SQL GENERATION
// ═══════════════════════════════════════════════════════════════

const lines = [];
function sql(s) { lines.push(s); }

sql('-- ═══════════════════════════════════════════════════════════════');
sql('-- KTI SmartCare — MySQL Database Export');
sql(`-- Generated: ${new Date().toISOString()}`);
sql('-- ═══════════════════════════════════════════════════════════════');
sql('');
sql('SET NAMES utf8mb4;');
sql('SET FOREIGN_KEY_CHECKS = 0;');
sql('');

// ── 1. USERS ────────────────────────────────────────────────────
sql('-- ─── USERS ───────────────────────────────────────────────');
sql('DROP TABLE IF EXISTS `users`;');
sql(`CREATE TABLE \`users\` (
  \`id\` VARCHAR(20) NOT NULL PRIMARY KEY,
  \`username\` VARCHAR(50) NOT NULL UNIQUE,
  \`password\` VARCHAR(255) NOT NULL,
  \`name\` VARCHAR(100) NOT NULL,
  \`role\` ENUM('teknisi','planner','supervisor','manager','admin') NOT NULL DEFAULT 'teknisi',
  \`email\` VARCHAR(100) DEFAULT NULL,
  \`created_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  \`updated_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;`);
sql('');

const users = readJSON('users.json');
if (users.length) {
    sql(`INSERT INTO \`users\` (\`id\`, \`username\`, \`password\`, \`name\`, \`role\`, \`email\`) VALUES`);
    sql(users.map(u =>
        `  (${esc(u.id)}, ${esc(u.username)}, ${esc(u.password)}, ${esc(u.name)}, ${esc(u.role)}, ${esc(u.email)})`
    ).join(',\n') + ';');
    sql('');
}

// ── 2. PLANTS ───────────────────────────────────────────────────
sql('-- ─── PLANTS ──────────────────────────────────────────────');
sql('DROP TABLE IF EXISTS `plants`;');
sql(`CREATE TABLE \`plants\` (
  \`plant_id\` VARCHAR(20) NOT NULL PRIMARY KEY,
  \`plant_name\` VARCHAR(150) NOT NULL,
  \`short_name\` VARCHAR(50) DEFAULT NULL,
  \`city\` VARCHAR(100) DEFAULT NULL,
  \`center_lat\` DECIMAL(10,7) DEFAULT NULL,
  \`center_lon\` DECIMAL(10,7) DEFAULT NULL,
  \`zoom\` INT DEFAULT 17
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;`);
sql('');

const plants = readJSON('plants.json');
if (plants.length) {
    sql(`INSERT INTO \`plants\` (\`plant_id\`, \`plant_name\`, \`short_name\`, \`city\`, \`center_lat\`, \`center_lon\`, \`zoom\`) VALUES`);
    sql(plants.map(p =>
        `  (${esc(p.plantId)}, ${esc(p.plantName)}, ${esc(p.shortName)}, ${esc(p.city)}, ${esc(p.centerLat)}, ${esc(p.centerLon)}, ${esc(p.zoom)})`
    ).join(',\n') + ';');
    sql('');
}

// ── 3. EQUIPMENT ────────────────────────────────────────────────
sql('-- ─── EQUIPMENT ───────────────────────────────────────────');
sql('DROP TABLE IF EXISTS `equipment`;');
sql(`CREATE TABLE \`equipment\` (
  \`equipment_id\` VARCHAR(20) NOT NULL PRIMARY KEY,
  \`equipment_name\` VARCHAR(150) NOT NULL,
  \`functional_location\` VARCHAR(200) DEFAULT NULL,
  \`category\` ENUM('Mekanik','Listrik','Sipil','Otomasi') NOT NULL,
  \`plant_id\` VARCHAR(20) DEFAULT NULL,
  \`plant_name\` VARCHAR(150) DEFAULT NULL,
  \`latitude\` DECIMAL(10,7) DEFAULT NULL,
  \`longitude\` DECIMAL(10,7) DEFAULT NULL,
  \`created_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  \`updated_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT \`fk_equipment_plant\` FOREIGN KEY (\`plant_id\`) REFERENCES \`plants\`(\`plant_id\`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;`);
sql('');

const equipment = readJSON('equipment.json');
if (equipment.length) {
    sql(`INSERT INTO \`equipment\` (\`equipment_id\`, \`equipment_name\`, \`functional_location\`, \`category\`, \`plant_id\`, \`plant_name\`, \`latitude\`, \`longitude\`) VALUES`);
    sql(equipment.map(e =>
        `  (${esc(e.equipmentId)}, ${esc(e.equipmentName)}, ${esc(e.functionalLocation)}, ${esc(e.category)}, ${esc(e.plantId || null)}, ${esc(e.plantName || null)}, ${esc(e.latitude)}, ${esc(e.longitude)})`
    ).join(',\n') + ';');
    sql('');
}

// ── 4. SPK ──────────────────────────────────────────────────────
sql('-- ─── SPK (Surat Perintah Kerja) ─────────────────────────');
sql('DROP TABLE IF EXISTS `spk`;');
sql(`CREATE TABLE \`spk\` (
  \`spk_number\` VARCHAR(30) NOT NULL PRIMARY KEY,
  \`description\` VARCHAR(500) NOT NULL,
  \`interval_period\` VARCHAR(30) DEFAULT NULL,
  \`category\` ENUM('Mekanik','Listrik','Sipil','Otomasi') NOT NULL,
  \`status\` ENUM('pending','in_progress','completed') NOT NULL DEFAULT 'pending',
  \`duration_actual\` DECIMAL(6,2) DEFAULT NULL,
  \`created_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  \`updated_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;`);
sql('');

// ── 5. SPK_EQUIPMENT (junction table) ───────────────────────────
sql('-- ─── SPK ↔ EQUIPMENT (junction) ─────────────────────────');
sql('DROP TABLE IF EXISTS `spk_equipment`;');
sql(`CREATE TABLE \`spk_equipment\` (
  \`id\` INT AUTO_INCREMENT PRIMARY KEY,
  \`spk_number\` VARCHAR(30) NOT NULL,
  \`equipment_id\` VARCHAR(20) NOT NULL,
  \`equipment_name\` VARCHAR(150) DEFAULT NULL,
  \`functional_location\` VARCHAR(200) DEFAULT NULL,
  CONSTRAINT \`fk_se_spk\` FOREIGN KEY (\`spk_number\`) REFERENCES \`spk\`(\`spk_number\`) ON DELETE CASCADE,
  CONSTRAINT \`fk_se_eq\` FOREIGN KEY (\`equipment_id\`) REFERENCES \`equipment\`(\`equipment_id\`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;`);
sql('');

// ── 6. SPK_ACTIVITIES ───────────────────────────────────────────
sql('-- ─── SPK ACTIVITIES ─────────────────────────────────────');
sql('DROP TABLE IF EXISTS `spk_activities`;');
sql(`CREATE TABLE \`spk_activities\` (
  \`id\` INT AUTO_INCREMENT PRIMARY KEY,
  \`spk_number\` VARCHAR(30) NOT NULL,
  \`activity_number\` VARCHAR(20) NOT NULL,
  \`equipment_id\` VARCHAR(20) DEFAULT NULL,
  \`operation_text\` TEXT NOT NULL,
  \`result_comment\` TEXT DEFAULT NULL,
  \`duration_plan\` DECIMAL(6,2) DEFAULT NULL,
  \`duration_actual\` DECIMAL(6,2) DEFAULT NULL,
  \`is_verified\` TINYINT(1) NOT NULL DEFAULT 0,
  CONSTRAINT \`fk_sa_spk\` FOREIGN KEY (\`spk_number\`) REFERENCES \`spk\`(\`spk_number\`) ON DELETE CASCADE,
  CONSTRAINT \`fk_sa_eq\` FOREIGN KEY (\`equipment_id\`) REFERENCES \`equipment\`(\`equipment_id\`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;`);
sql('');

const spkData = readJSON('spk.json');
if (spkData.length) {
    // SPK main records
    sql(`INSERT INTO \`spk\` (\`spk_number\`, \`description\`, \`interval_period\`, \`category\`, \`status\`, \`duration_actual\`) VALUES`);
    sql(spkData.map(s =>
        `  (${esc(s.spkNumber)}, ${esc(s.description)}, ${esc(s.interval)}, ${esc(s.category)}, ${esc(s.status)}, ${esc(s.durationActual)})`
    ).join(',\n') + ';');
    sql('');

    // SPK ↔ Equipment junction
    const seRows = [];
    spkData.forEach(s => {
        (s.equipmentModels || []).forEach(e => {
            seRows.push(`  (${esc(s.spkNumber)}, ${esc(e.equipmentId)}, ${esc(e.equipmentName)}, ${esc(e.functionalLocation)})`);
        });
    });
    if (seRows.length) {
        sql(`INSERT INTO \`spk_equipment\` (\`spk_number\`, \`equipment_id\`, \`equipment_name\`, \`functional_location\`) VALUES`);
        sql(seRows.join(',\n') + ';');
        sql('');
    }

    // SPK Activities
    const saRows = [];
    spkData.forEach(s => {
        (s.activitiesModel || []).forEach(a => {
            saRows.push(`  (${esc(s.spkNumber)}, ${esc(a.activityNumber)}, ${esc(a.equipmentId || null)}, ${esc(a.operationText)}, ${esc(a.resultComment)}, ${esc(a.durationPlan)}, ${esc(a.durationActual)}, ${esc(a.isVerified)})`);
        });
    });
    if (saRows.length) {
        sql(`INSERT INTO \`spk_activities\` (\`spk_number\`, \`activity_number\`, \`equipment_id\`, \`operation_text\`, \`result_comment\`, \`duration_plan\`, \`duration_actual\`, \`is_verified\`) VALUES`);
        sql(saRows.join(',\n') + ';');
        sql('');
    }
}

// ── 7. LEMBAR KERJA ─────────────────────────────────────────────
sql('-- ─── LEMBAR KERJA ───────────────────────────────────────');
sql('DROP TABLE IF EXISTS `lembar_kerja`;');
sql(`CREATE TABLE \`lembar_kerja\` (
  \`lk_number\` VARCHAR(30) NOT NULL PRIMARY KEY,
  \`periode_start\` DATETIME DEFAULT NULL,
  \`periode_end\` DATETIME DEFAULT NULL,
  \`category\` ENUM('Mekanik','Listrik','Sipil','Otomasi') NOT NULL,
  \`status\` ENUM('pending','in_progress','completed') NOT NULL DEFAULT 'pending',
  \`lembar_ke\` INT DEFAULT 1,
  \`total_lembar\` INT DEFAULT 1,
  \`evaluasi\` TEXT DEFAULT NULL,
  \`created_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  \`updated_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;`);
sql('');

// ── 8. LEMBAR KERJA ↔ SPK (junction) ────────────────────────────
sql('DROP TABLE IF EXISTS `lembar_kerja_spk`;');
sql(`CREATE TABLE \`lembar_kerja_spk\` (
  \`id\` INT AUTO_INCREMENT PRIMARY KEY,
  \`lk_number\` VARCHAR(30) NOT NULL,
  \`spk_number\` VARCHAR(30) NOT NULL,
  CONSTRAINT \`fk_lks_lk\` FOREIGN KEY (\`lk_number\`) REFERENCES \`lembar_kerja\`(\`lk_number\`) ON DELETE CASCADE,
  CONSTRAINT \`fk_lks_spk\` FOREIGN KEY (\`spk_number\`) REFERENCES \`spk\`(\`spk_number\`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;`);
sql('');

const lkData = readJSON('lembar_kerja.json');
if (lkData.length) {
    sql(`INSERT INTO \`lembar_kerja\` (\`lk_number\`, \`periode_start\`, \`periode_end\`, \`category\`, \`status\`, \`lembar_ke\`, \`total_lembar\`, \`evaluasi\`) VALUES`);
    sql(lkData.map(l =>
        `  (${esc(l.lkNumber)}, ${esc(l.periodeStart)}, ${esc(l.periodeEnd)}, ${esc(l.category)}, ${esc(l.status)}, ${esc(l.lembarKe)}, ${esc(l.totalLembar)}, ${esc(l.evaluasi)})`
    ).join(',\n') + ';');
    sql('');

    const lksRows = [];
    lkData.forEach(l => {
        (l.spkModels || []).forEach(spkNum => {
            lksRows.push(`  (${esc(l.lkNumber)}, ${esc(spkNum)})`);
        });
    });
    if (lksRows.length) {
        sql(`INSERT INTO \`lembar_kerja_spk\` (\`lk_number\`, \`spk_number\`) VALUES`);
        sql(lksRows.join(',\n') + ';');
        sql('');
    }
}

// ── 9. SUBMISSIONS ──────────────────────────────────────────────
sql('-- ─── SUBMISSIONS ────────────────────────────────────────');
sql('DROP TABLE IF EXISTS `submissions`;');
sql(`CREATE TABLE \`submissions\` (
  \`id\` VARCHAR(30) NOT NULL PRIMARY KEY,
  \`spk_number\` VARCHAR(30) NOT NULL,
  \`duration_actual\` DECIMAL(6,2) DEFAULT NULL,
  \`evaluasi\` TEXT DEFAULT NULL,
  \`latitude\` DECIMAL(10,7) DEFAULT NULL,
  \`longitude\` DECIMAL(10,7) DEFAULT NULL,
  \`submitted_at\` DATETIME NOT NULL,
  \`created_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT \`fk_sub_spk\` FOREIGN KEY (\`spk_number\`) REFERENCES \`spk\`(\`spk_number\`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;`);
sql('');

// ── 10. SUBMISSION PHOTOS ───────────────────────────────────────
sql('DROP TABLE IF EXISTS `submission_photos`;');
sql(`CREATE TABLE \`submission_photos\` (
  \`id\` INT AUTO_INCREMENT PRIMARY KEY,
  \`submission_id\` VARCHAR(30) NOT NULL,
  \`photo_path\` VARCHAR(500) NOT NULL,
  CONSTRAINT \`fk_sp_sub\` FOREIGN KEY (\`submission_id\`) REFERENCES \`submissions\`(\`id\`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;`);
sql('');

// ── 11. SUBMISSION ACTIVITY RESULTS ─────────────────────────────
sql('DROP TABLE IF EXISTS `submission_activity_results`;');
sql(`CREATE TABLE \`submission_activity_results\` (
  \`id\` INT AUTO_INCREMENT PRIMARY KEY,
  \`submission_id\` VARCHAR(30) NOT NULL,
  \`activity_number\` VARCHAR(20) NOT NULL,
  \`result_comment\` TEXT DEFAULT NULL,
  \`is_normal\` TINYINT(1) NOT NULL DEFAULT 1,
  \`is_verified\` TINYINT(1) NOT NULL DEFAULT 0,
  CONSTRAINT \`fk_sar_sub\` FOREIGN KEY (\`submission_id\`) REFERENCES \`submissions\`(\`id\`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;`);
sql('');

const subData = readJSON('submissions.json');
if (subData.length) {
    sql(`INSERT INTO \`submissions\` (\`id\`, \`spk_number\`, \`duration_actual\`, \`evaluasi\`, \`latitude\`, \`longitude\`, \`submitted_at\`) VALUES`);
    sql(subData.map(s =>
        `  (${esc(s.id)}, ${esc(s.spkNumber)}, ${esc(s.durationActual)}, ${esc(s.evaluasi)}, ${esc(s.latitude)}, ${esc(s.longitude)}, ${esc(s.submittedAt)})`
    ).join(',\n') + ';');
    sql('');

    // Photos
    const photoRows = [];
    subData.forEach(s => {
        (s.photoPaths || []).forEach(p => {
            photoRows.push(`  (${esc(s.id)}, ${esc(p)})`);
        });
    });
    if (photoRows.length) {
        sql(`INSERT INTO \`submission_photos\` (\`submission_id\`, \`photo_path\`) VALUES`);
        sql(photoRows.join(',\n') + ';');
        sql('');
    }

    // Activity results
    const arRows = [];
    subData.forEach(s => {
        (s.activityResultsModel || []).forEach(a => {
            arRows.push(`  (${esc(s.id)}, ${esc(a.activityNumber)}, ${esc(a.resultComment)}, ${esc(a.isNormal)}, ${esc(a.isVerified)})`);
        });
    });
    if (arRows.length) {
        sql(`INSERT INTO \`submission_activity_results\` (\`submission_id\`, \`activity_number\`, \`result_comment\`, \`is_normal\`, \`is_verified\`) VALUES`);
        sql(arRows.join(',\n') + ';');
        sql('');
    }
}

// ── Finalize ────────────────────────────────────────────────────
sql('SET FOREIGN_KEY_CHECKS = 1;');
sql('');
sql('-- ═══════════════════════════════════════════════════════════════');
sql('-- End of export');
sql('-- ═══════════════════════════════════════════════════════════════');

// ── Write file ──────────────────────────────────────────────────
fs.writeFileSync(OUTPUT, lines.join('\n'), 'utf8');

// Stats
const tableCount = lines.filter(l => l.startsWith('CREATE TABLE')).length;
const insertCount = lines.filter(l => l.startsWith('INSERT INTO')).length;
console.log(`\n  JSON → MySQL SQL Converter`);
console.log(`  ──────────────────────────`);
console.log(`  ✓ ${tableCount} tables created`);
console.log(`  ✓ ${insertCount} INSERT statements`);
console.log(`  ✓ Output: data/kti_smartcare.sql`);
console.log(`  ✓ Size: ${(fs.statSync(OUTPUT).size / 1024).toFixed(1)} KB\n`);
