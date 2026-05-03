# KTI SmartCare — SAP Mock System

Sistem Backend SAP Mock untuk aplikasi **KTI SmartCare**. Sistem ini menyediakan REST API untuk aplikasi mobile (Flutter) dan Web Admin UI untuk manajemen data pemeliharaan (Preventive & Corrective Maintenance).

---

## 🛠 Arsitektur Sistem

*   **Runtime:** Node.js v20+
*   **Database:** Microsoft SQL Server 2017 Express (di Windows Host)
*   **Containerization:** Docker Desktop (Backend dijalankan di dalam container)
*   **Dialek Database:** MSSQL (Tedious driver)

---

## 📋 Prasyarat (Prerequisites)

Sebelum memulai, pastikan perangkat server/lokal Anda sudah terinstall:
1.  **Windows OS** (Direkomendasikan Windows Server atau Windows 10/11).
2.  **SQL Server 2017 Express Edition** (atau versi lebih baru).
3.  **SQL Server Management Studio (SSMS)**.
4.  **Docker Desktop** (untuk menjalankan backend).
5.  **Node.js v20.x** (Hanya diperlukan jika ingin menjalankan seeding/test secara lokal).

---

## ⚙️ Langkah 1: Konfigurasi SQL Server

Backend ini menggunakan SQL Server yang berjalan di Windows Host. Anda perlu melakukan konfigurasi berikut agar Docker dapat terhubung ke database.

### 1. Aktifkan TCP/IP
*   Buka **SQL Server Configuration Manager**.
*   Pilih **SQL Server Network Configuration** > **Protocols for SQLEXPRESS**.
*   Klik kanan pada **TCP/IP** dan pilih **Enable**.
*   Klik kanan pada **TCP/IP** > **Properties** > Tab **IP Addresses**.
*   Scroll ke paling bawah (IPAll), pastikan **TCP Port** diisi `1433`.
*   **Restart** layanan SQL Server via Windows Services (`services.msc`).

### 2. Aktifkan Mixed Mode Authentication
*   Buka **SSMS** dan login (Windows Authentication).
*   Klik kanan pada Server Name (paling atas) > **Properties**.
*   Pilih menu **Security**.
*   Pilih **SQL Server and Windows Authentication mode**.
*   Klik **OK**.

### 3. Aktifkan User 'sa'
*   Di SSMS, buka folder **Security** > **Logins**.
*   Klik kanan pada user **sa** > **Properties**.
*   Di tab **General**, set password (contoh: `admin123`).
*   Di tab **Status**, set **Login** ke **Enabled**.
*   Klik **OK**.

### 4. Buat Database
*   Klik kanan pada folder **Databases** > **New Database**.
*   Beri nama: `mantis_kti`.
*   Klik **OK**.

### 5. Konfigurasi Windows Firewall
*   Buka **Windows Defender Firewall with Advanced Security**.
*   Pilih **Inbound Rules** > **New Rule**.
*   Pilih **Port** > **TCP** > Specific local ports: `1433`.
*   Pilih **Allow the connection**.
*   Beri nama rule (contoh: `SQL Server 1433`).

---

## 🚀 Langkah 2: Setup & Jalankan Backend

### 1. Persiapan File Environment
Copy file `.env.example` menjadi `.env`:
```bash
cp .env.example .env
```
Sesuaikan isi `.env` dengan kredensial SQL Server Anda:
```env
# Gunakan host.docker.internal agar container bisa akses SQL Server di Windows Host
URI=mssql://sa:admin123@host.docker.internal:1433/mantis_kti
JWT_SECRET=kti_secret_key_2024
PORT=3000
```

### 2. Jalankan via Docker
Buka terminal/CMD di folder project, lalu jalankan:
```bash
docker compose up -d --build
```

Backend sekarang berjalan di:
*   **API URL:** `http://localhost:3000/api`
*   **Web Admin:** `http://localhost:3000`

---

## 🗄 Langkah 3: Database Seeding (Isi Data Awal)

Setelah container berjalan, Anda perlu mengisi database dengan data awal (master data).

```bash
# Masuk ke container backend
docker exec -it sap-mock-server sh

# Jalankan script seed
npm run seed             # Master data (Users, Plants, Equipment)
npm run preventive-seed  # Data jadwal pemeliharaan (Preventive)
```

---

## 🔑 Kredensial Login (Testing)

| Role | Username (NIK) | Password |
|---|---|---|
| **Admin** | `100001` | `admin123` |
| **Teknisi** | `100002` | `admin123` |
| **Kasie** | `100003` | `admin123` |

---

## 🛠 Perintah Penting lainnya

*   **Melihat Log:** `docker logs -f sap-mock-server`
*   **Menghentikan Sistem:** `docker compose down`
*   **Reset Data Inspeksi:** `npm run clear-inspeksi` (jalankan di dalam container)

---

## 🧪 Testing

Jika ingin menjalankan unit test secara lokal:
```bash
npm install
npm test
```

---

## 📝 Catatan untuk Pengembang
Jika ada perubahan schema pada model Sequelize, SQL Server 2017 memerlukan perhatian khusus pada tipe data JSON (yang dimigrasikan ke TEXT) dan ENUM (yang dimigrasikan ke VARCHAR dengan validasi aplikasi). Pastikan selalu mengecek `src/config/sqlServerHelpers.js` jika ingin melakukan manipulasi database secara raw.
