# 🛠️ Panduan Developer Backend: Modul Inspeksi & Supervisi

README ini berfungsi sebagai panduan serah terima (handover) bagi pengembang yang akan melanjutkan pemeliharaan atau pengembangan modul **Inspeksi** dan **Supervisi** pada backend Smart WaterCare.

---

## 📁 Struktur Berkas

Semua logika utama untuk kedua modul ini terpusat di folder `src/controllers/inspection/` dan file pendukung lainnya:

```text
src/
├── controllers/
│   └── inspection/
│       ├── scheduleController.js          # Kontroler Jadwal Inspeksi (Rutin)
│       ├── reportController.js            # Kontroler Laporan Inspeksi & Approval
│       ├── followUpController.js          # Kontroler Tindak Lanjut perbaikan teknisi
│       ├── inspectionRequestController.js # Kontroler request jadwal dari user
│       ├── supervisiController.js         # Kontroler utama Modul Supervisi (Jobs, Visits)
│       ├── supervisiAccess.js             # Otorisasi & pembagian grup supervisi
│       ├── supervisiHelpers.js            # Helper jarak, konversi, & pemformatan
│       ├── supervisiNotifications.js      # Pengiriman notifikasi push supervisi
│       └── supervisiUpload.js             # Middleware unggah file (multer)
├── routes/
│   └── inspection.js                      # Rute API Inspeksi & Supervisi
└── models/
    ├── InspectionSchedule.js              # Model Tabel Jadwal Inspeksi
    ├── InspectionReport.js                # Model Tabel Laporan Inspeksi
    ├── InspectionFollowUp.js              # Model Tabel Perbaikan Teknisi
    ├── SupervisiJob.js                    # Model Tabel Proyek Supervisi
    ├── SupervisiVisit.js                  # Model Tabel Kehadiran Harian Supervisi
    └── SupervisiAmend.js                  # Model Tabel Amendemen Proyek
```

### 🖥️ Komponen Web Admin (Next.js)
Komponen antarmuka pengguna web admin untuk modul Inspeksi dan Supervisi terletak di folder `web/components/`:
*   `web/components/inspeksi/`
    *   `InspeksiDetailModal.js` — Menampilkan detail jadwal dan laporan hasil inspeksi rutin.
    *   `InspeksiExecutionModal.js` — Form eksekusi & submit hasil laporan inspeksi (bebas dari input K3).
*   `web/components/hse-inspeksi/`
    *   `HseInspeksiDetailModal.js` — Detail modal inspeksi untuk panel HSE.
    *   `HseInspeksiExecutionModal.js` — Form eksekusi modal inspeksi untuk panel HSE (bebas dari input K3).
*   `web/components/supervisi/`
    *   `SupervisiJobFormDialog.js` — Dialog pembuatan & pengaturan proyek supervisi.
    *   `SupervisiJobPanel.js` — Panel monitoring & manajemen absensi harian proyek supervisi.
*   `web/lib/utils.js` — Berisi fungsi utilitas `getMediaUrl` untuk resolusi dinamis alamat URL berkas media.

---

## 📅 1. Modul Inspeksi (Inspection)

### Alur Bisnis
1. **Penjadwalan:** Jadwal dibuat oleh Kadis Inspeksi atau diajukan oleh user. Bisa berupa jadwal sekali jalan atau berulang (*recurring*).
2. **Pelaporan:** Inspektor mengisi laporan ([InspectionReport.js](file:///c:/KTI%20inspeksi/SAP-CLONE/src/models/InspectionReport.js)). Jika ada kerusakan (`hasKerusakan = true`), laporan wajib dikirim untuk disetujui.
3. **Approval & Follow-Up:** Kadis meninjau laporan. Jika disetujui, sistem otomatis membuat tugas perbaikan ([InspectionFollowUp.js](file:///c:/KTI%20inspeksi/SAP-CLONE/src/models/InspectionFollowUp.js)) yang ditugaskan ke Teknisi.

### Catatan Penting untuk Developer
* **Pembuatan Nomor SPK:** Nomor SPK dibuat otomatis dengan format `SPK-INSPYY-XXXX` via fungsi `getNextSpkNumber` di [scheduleController.js](file:///c:/KTI%20inspeksi/SAP-CLONE/src/controllers/inspection/scheduleController.js).

---

## 🚧 2. Modul Supervisi (Supervision)

### Alur Bisnis
1. **Pekerjaan Proyek (`SupervisiJob`):** Planner membuat pekerjaan supervisi lengkap dengan lokasi geofence (`latitude`, `longitude`, `radius` atau multi-lokasi `locations`).
2. **Absensi Harian (`SupervisiVisit`):** Eksekutor (Dinas Inspeksi) wajib submit kunjungan setiap hari proyek aktif.
3. **Evaluasi Geofence:** Saat submit kehadiran (`hadir`), koordinat GPS eksekutor divalidasi terhadap geofence. Jika di luar radius, backend menolak dengan kode status **422** (kecuali dispensasi radius aktif).
4. **Pencatatan Absen & Pelanggaran:** 
   * Draft kemarin yang lupa disubmit otomatis dikonversi menjadi `tidak_hadir`.
   * Cron harian (pukul 00:01) mendeteksi jika tidak ada submit sama sekali untuk hari kemarin dan membuat record `tidak_hadir`.
   * Jika absen `tidak_hadir` sebanyak **3 kali berturut-turut** per lokasi, sistem otomatis menandai kunjungan tersebut sebagai pelanggaran (`isPelanggaran = true`). Eksekutor wajib mengisi `alasanTidakHadir`.
5. **Auto-Complete:** Proyek yang berakhir otomatis berubah menjadi `completed` jika semua pelanggaran telah diisi alasannya.

### Catatan Penting untuk Developer
* **Zona Waktu:** Waktu kunjungan (`visitDate`) menggunakan tanggal server (Zona Asia/Jakarta) untuk menghindari manipulasi waktu pada ponsel pengguna.
* **Geofencing:** Perhitungan jarak geofence menggunakan rumus Haversine di [supervisiHelpers.js](file:///c:/KTI%20inspeksi/SAP-CLONE/src/controllers/inspection/supervisiHelpers.js).
* **Multi-Lokasi:** Kunjungan harian dijamin unik per hari, per job, dan per lokasi melalui indeks unik database `supervisi_visits_job_date_location_unique`.

---

## 🛡️ 3. Otorisasi & Keamanan
Akses dikontrol di [supervisiAccess.js](file:///c:/KTI%20inspeksi/SAP-CLONE/src/controllers/inspection/supervisiAccess.js) dan [accessProfile.js](file:///c:/KTI%20inspeksi/SAP-CLONE/src/services/accessProfile.js):
* Jangan pernah melewatkan fungsi otorisasi seperti `isSupervisiExecutor`, `isSupervisiScheduler`, atau `canAccessSupervisiJob` pada penulisan endpoint baru.
* Pengguna Web Admin (Planner) diberikan akses monitor read-only melalui izin permissions khusus web.

---

## 🐳 4. Penyimpanan Gambar & Dokumen
* Berkas fisik gambar diunggah ke folder `/uploads/supervisi` menggunakan multer.
* Di database, data disimpan dalam bentuk **Relative Path** (contoh: `/uploads/supervisi/sv_123.jpg`). 
* **Migrasi Server:** Jika migrasi ke server lain, database **aman** (tidak akan link-broken karena tidak menyimpan domain/IP lama). Pengembang hanya perlu menyalin folder fisik `/uploads` dari server lama ke server baru.

---

## 🚫 5. Catatan Pemindahan K3 (Safety) ke Modul Standalone
* **Logika K3 telah dipindahkan sepenuhnya** ke modul mandiri `src/controllers/k3_safety/` dan model-model terkait (`K3Report.js`, `K3Settings.js`).
* **Modul Inspeksi & Supervisi bersih dari K3:**
  * Model database `SuratPelanggaran` dan pengontrol `suratPelanggaranController` telah dihapus sepenuhnya.
  * Tipe jadwal `'k3'` di `InspectionSchedule` telah dihapus (hanya mendukung `'rutin'` dan `'supervisi'`).
  * Field-field seperti `kategoriK3` dan `kriteria` telah dihapus dari skema model backend (`InspectionSchedule`, `InspectionReport`, dan `InspectionFollowUp`).
  * Antarmuka Web (seperti modal pelaksanaan inspeksi `InspeksiExecutionModal` dan `HseInspeksiExecutionModal`) sudah dibersihkan dari state, input form, validasi, dan payload field `kategoriK3`.

