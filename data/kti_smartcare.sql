-- ═══════════════════════════════════════════════════════════════
-- KTI SmartCare — MySQL Database Export
-- Generated: 2026-03-03T07:40:37.072Z
-- ═══════════════════════════════════════════════════════════════

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

-- ─── USERS ───────────────────────────────────────────────
DROP TABLE IF EXISTS `users`;
CREATE TABLE `users` (
  `id` VARCHAR(20) NOT NULL PRIMARY KEY,
  `username` VARCHAR(50) NOT NULL UNIQUE,
  `password` VARCHAR(255) NOT NULL,
  `name` VARCHAR(100) NOT NULL,
  `role` ENUM('teknisi','planner','supervisor','manager','admin') NOT NULL DEFAULT 'teknisi',
  `email` VARCHAR(100) DEFAULT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

INSERT INTO `users` (`id`, `username`, `password`, `name`, `role`, `email`) VALUES
  ('USR-001', 'teknisi_01', 'password123', 'Budi Santoso', 'teknisi', 'budi@kti-water.co.id'),
  ('USR-002', 'planner_01', 'password123', 'Siti Rahayu', 'planner', 'siti@kti-water.co.id'),
  ('USR-003', 'supervisor_01', 'password123', 'Ahmad Fauzi', 'supervisor', 'ahmad@kti-water.co.id'),
  ('USR-004', 'manager_01', 'password123', 'Dewi Kusuma', 'manager', 'dewi@kti-water.co.id'),
  ('USR-005', 'admin_01', 'password123', 'Admin KTI', 'admin', 'admin@kti-water.co.id');

-- ─── PLANTS ──────────────────────────────────────────────
DROP TABLE IF EXISTS `plants`;
CREATE TABLE `plants` (
  `plant_id` VARCHAR(20) NOT NULL PRIMARY KEY,
  `plant_name` VARCHAR(150) NOT NULL,
  `short_name` VARCHAR(50) DEFAULT NULL,
  `city` VARCHAR(100) DEFAULT NULL,
  `center_lat` DECIMAL(10,7) DEFAULT NULL,
  `center_lon` DECIMAL(10,7) DEFAULT NULL,
  `zoom` INT DEFAULT 17
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

INSERT INTO `plants` (`plant_id`, `plant_name`, `short_name`, `city`, `center_lat`, `center_lon`, `zoom`) VALUES
  ('KTI-01', 'PT Krakatau Tirta Industri', 'KTI WTP-1', 'Cilegon', -6.0135, 106.0219, 17);

-- ─── EQUIPMENT ───────────────────────────────────────────
DROP TABLE IF EXISTS `equipment`;
CREATE TABLE `equipment` (
  `equipment_id` VARCHAR(20) NOT NULL PRIMARY KEY,
  `equipment_name` VARCHAR(150) NOT NULL,
  `functional_location` VARCHAR(200) DEFAULT NULL,
  `category` ENUM('Mekanik','Listrik','Sipil','Otomasi') NOT NULL,
  `plant_id` VARCHAR(20) DEFAULT NULL,
  `plant_name` VARCHAR(150) DEFAULT NULL,
  `latitude` DECIMAL(10,7) DEFAULT NULL,
  `longitude` DECIMAL(10,7) DEFAULT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT `fk_equipment_plant` FOREIGN KEY (`plant_id`) REFERENCES `plants`(`plant_id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

INSERT INTO `equipment` (`equipment_id`, `equipment_name`, `functional_location`, `category`, `plant_id`, `plant_name`, `latitude`, `longitude`) VALUES
  ('EQ-001', 'Pompa Air Utama A', 'Intake Area', 'Mekanik', 'KTI-01', 'PT Krakatau Tirta Industri', -6.01235, 106.02185),
  ('EQ-002', 'Pompa Air Utama B', 'Intake Area', 'Mekanik', 'KTI-01', 'PT Krakatau Tirta Industri', -6.01245, 106.0221),
  ('EQ-003', 'Pompa Booster WTP', 'Water Treatment Plant', 'Mekanik', 'KTI-01', 'PT Krakatau Tirta Industri', -6.0131, 106.0224),
  ('EQ-004', 'Kompresor Udara Gedung', 'Utility Building', 'Mekanik', 'KTI-01', 'PT Krakatau Tirta Industri', -6.0138, 106.0215),
  ('EQ-005', 'Panel Listrik Utama', 'Control Room', 'Listrik', 'KTI-01', 'PT Krakatau Tirta Industri', -6.0135, 106.0219),
  ('EQ-006', 'Panel Distribusi Area Clarifier', 'Clarifier Area', 'Listrik', 'KTI-01', 'PT Krakatau Tirta Industri', -6.0142, 106.0222),
  ('EQ-007', 'Genset Cadangan 200 kVA', 'Genset Building', 'Listrik', 'KTI-01', 'PT Krakatau Tirta Industri', -6.0148, 106.0216),
  ('EQ-008', 'Bak Penampungan Utama', 'Reservoir Area', 'Sipil', 'KTI-01', 'PT Krakatau Tirta Industri', -6.0129, 106.0213),
  ('EQ-009', 'Saluran Drainase Utara', 'North Drainage', 'Sipil', 'KTI-01', 'PT Krakatau Tirta Industri', -6.0118, 106.022),
  ('EQ-010', 'Sensor Level Air Tank 1', 'Tank Farm', 'Otomasi', 'KTI-01', 'PT Krakatau Tirta Industri', -6.0153, 106.0225);

-- ─── SPK (Surat Perintah Kerja) ─────────────────────────
DROP TABLE IF EXISTS `spk`;
CREATE TABLE `spk` (
  `spk_number` VARCHAR(30) NOT NULL PRIMARY KEY,
  `description` VARCHAR(500) NOT NULL,
  `interval_period` VARCHAR(30) DEFAULT NULL,
  `category` ENUM('Mekanik','Listrik','Sipil','Otomasi') NOT NULL,
  `status` ENUM('pending','in_progress','completed') NOT NULL DEFAULT 'pending',
  `duration_actual` DECIMAL(6,2) DEFAULT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ─── SPK ↔ EQUIPMENT (junction) ─────────────────────────
DROP TABLE IF EXISTS `spk_equipment`;
CREATE TABLE `spk_equipment` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `spk_number` VARCHAR(30) NOT NULL,
  `equipment_id` VARCHAR(20) NOT NULL,
  `equipment_name` VARCHAR(150) DEFAULT NULL,
  `functional_location` VARCHAR(200) DEFAULT NULL,
  CONSTRAINT `fk_se_spk` FOREIGN KEY (`spk_number`) REFERENCES `spk`(`spk_number`) ON DELETE CASCADE,
  CONSTRAINT `fk_se_eq` FOREIGN KEY (`equipment_id`) REFERENCES `equipment`(`equipment_id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ─── SPK ACTIVITIES ─────────────────────────────────────
DROP TABLE IF EXISTS `spk_activities`;
CREATE TABLE `spk_activities` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `spk_number` VARCHAR(30) NOT NULL,
  `activity_number` VARCHAR(20) NOT NULL,
  `equipment_id` VARCHAR(20) DEFAULT NULL,
  `operation_text` TEXT NOT NULL,
  `result_comment` TEXT DEFAULT NULL,
  `duration_plan` DECIMAL(6,2) DEFAULT NULL,
  `duration_actual` DECIMAL(6,2) DEFAULT NULL,
  `is_verified` TINYINT(1) NOT NULL DEFAULT 0,
  CONSTRAINT `fk_sa_spk` FOREIGN KEY (`spk_number`) REFERENCES `spk`(`spk_number`) ON DELETE CASCADE,
  CONSTRAINT `fk_sa_eq` FOREIGN KEY (`equipment_id`) REFERENCES `equipment`(`equipment_id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ─── LEMBAR KERJA ───────────────────────────────────────
DROP TABLE IF EXISTS `lembar_kerja`;
CREATE TABLE `lembar_kerja` (
  `lk_number` VARCHAR(30) NOT NULL PRIMARY KEY,
  `periode_start` DATETIME DEFAULT NULL,
  `periode_end` DATETIME DEFAULT NULL,
  `category` ENUM('Mekanik','Listrik','Sipil','Otomasi') NOT NULL,
  `status` ENUM('pending','in_progress','completed') NOT NULL DEFAULT 'pending',
  `lembar_ke` INT DEFAULT 1,
  `total_lembar` INT DEFAULT 1,
  `evaluasi` TEXT DEFAULT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

DROP TABLE IF EXISTS `lembar_kerja_spk`;
CREATE TABLE `lembar_kerja_spk` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `lk_number` VARCHAR(30) NOT NULL,
  `spk_number` VARCHAR(30) NOT NULL,
  CONSTRAINT `fk_lks_lk` FOREIGN KEY (`lk_number`) REFERENCES `lembar_kerja`(`lk_number`) ON DELETE CASCADE,
  CONSTRAINT `fk_lks_spk` FOREIGN KEY (`spk_number`) REFERENCES `spk`(`spk_number`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ─── SUBMISSIONS ────────────────────────────────────────
DROP TABLE IF EXISTS `submissions`;
CREATE TABLE `submissions` (
  `id` VARCHAR(30) NOT NULL PRIMARY KEY,
  `spk_number` VARCHAR(30) NOT NULL,
  `duration_actual` DECIMAL(6,2) DEFAULT NULL,
  `evaluasi` TEXT DEFAULT NULL,
  `latitude` DECIMAL(10,7) DEFAULT NULL,
  `longitude` DECIMAL(10,7) DEFAULT NULL,
  `submitted_at` DATETIME NOT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT `fk_sub_spk` FOREIGN KEY (`spk_number`) REFERENCES `spk`(`spk_number`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

DROP TABLE IF EXISTS `submission_photos`;
CREATE TABLE `submission_photos` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `submission_id` VARCHAR(30) NOT NULL,
  `photo_path` VARCHAR(500) NOT NULL,
  CONSTRAINT `fk_sp_sub` FOREIGN KEY (`submission_id`) REFERENCES `submissions`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

DROP TABLE IF EXISTS `submission_activity_results`;
CREATE TABLE `submission_activity_results` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `submission_id` VARCHAR(30) NOT NULL,
  `activity_number` VARCHAR(20) NOT NULL,
  `result_comment` TEXT DEFAULT NULL,
  `is_normal` TINYINT(1) NOT NULL DEFAULT 1,
  `is_verified` TINYINT(1) NOT NULL DEFAULT 0,
  CONSTRAINT `fk_sar_sub` FOREIGN KEY (`submission_id`) REFERENCES `submissions`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

INSERT INTO `submissions` (`id`, `spk_number`, `duration_actual`, `evaluasi`, `latitude`, `longitude`, `submitted_at`) VALUES
  ('SUB-001', 'SPK-2026-004', 4.5, 'Semua aktivitas overhaul kompresor selesai dengan normal. Kondisi kompresor setelah servis sangat baik.', -6.1751, 106.865, '2026-02-15T10:30:00.000Z'),
  ('SUB-002', 'SPK-2026-007', 3, 'Servis genset berjalan lancar. Semua komponen dalam kondisi baik pasca servis.', -6.1755, 106.8645, '2026-02-20T14:00:00.000Z'),
  ('SUB-5BE29912', 'SPK-2026-013', 2, '', 0, 0, '2026-03-03T04:19:46.671Z'),
  ('SUB-2EA43B3C', 'SPK-2026-013', 2, '', 0, 0, '2026-03-03T04:19:48.626Z'),
  ('SUB-F7122367', 'SPK-2026-013', 2, '', 0, 0, '2026-03-03T04:19:49.487Z'),
  ('SUB-B4EFA47E', 'SPK-2026-013', 2, '', 0, 0, '2026-03-03T04:19:50.441Z'),
  ('SUB-0D24C7D5', 'SPK-2026-014', 4, '', 0, 0, '2026-03-03T05:06:32.707Z'),
  ('SUB-5499DFD4', 'SPK-2026-001', 1, '', 0, 0, '2026-03-03T05:11:40.039Z');

INSERT INTO `submission_activity_results` (`submission_id`, `activity_number`, `result_comment`, `is_normal`, `is_verified`) VALUES
  ('SUB-001', 'ACT-001', 'Filter lama sudah cukup kotor, sudah diganti baru', 1, 1),
  ('SUB-001', 'ACT-002', 'Oli warna gelap, sudah diganti dengan SAE 30', 1, 1),
  ('SUB-001', 'ACT-003', 'Semua baut dalam kondisi baik', 1, 1),
  ('SUB-001', 'ACT-004', 'Tekanan 8 bar, tidak ada kebocoran', 1, 1),
  ('SUB-002', 'ACT-001', 'Oli diganti dengan Pertamina Fastron 15W40', 1, 1),
  ('SUB-002', 'ACT-002', 'Kedua filter sudah diganti baru', 1, 1),
  ('SUB-002', 'ACT-003', 'Tegangan aki 13.2V, kondisi baik', 1, 1),
  ('SUB-002', 'ACT-004', 'Genset beroperasi normal, output 200V/50Hz', 1, 1),
  ('SUB-5BE29912', 'ACT-001', '', 1, 0),
  ('SUB-5BE29912', 'ACT-002', '', 1, 0),
  ('SUB-2EA43B3C', 'ACT-001', '', 1, 0),
  ('SUB-2EA43B3C', 'ACT-002', '', 1, 0),
  ('SUB-F7122367', 'ACT-001', '', 1, 0),
  ('SUB-F7122367', 'ACT-002', '', 1, 0),
  ('SUB-B4EFA47E', 'ACT-001', '', 1, 0),
  ('SUB-B4EFA47E', 'ACT-002', '', 1, 0),
  ('SUB-0D24C7D5', 'ACT-001', '', 1, 0),
  ('SUB-0D24C7D5', 'ACT-002', '', 1, 0),
  ('SUB-0D24C7D5', 'ACT-003', '', 1, 0),
  ('SUB-0D24C7D5', 'ACT-004', '', 1, 0),
  ('SUB-5499DFD4', 'ACT-001', '', 1, 0),
  ('SUB-5499DFD4', 'ACT-002', '', 1, 0),
  ('SUB-5499DFD4', 'ACT-003', '', 1, 0);

SET FOREIGN_KEY_CHECKS = 1;

-- ═══════════════════════════════════════════════════════════════
-- End of export
-- ═══════════════════════════════════════════════════════════════