# Panduan Data & Autentikasi User (KTI SmartCare)

Dokumen ini berisi konteks mengenai struktur tabel `users` dari sisi Backend yang wajib dipahami oleh Frontend Agent untuk mengimplementasikan tata kelola logic autentikasi, otorisasi akses, dan filter data.

## Struktur Atribut dan Field Data User

Setiap balikan API (misal pada response sukses di endpoint `/api/auth/login`), Frontend akan mendapatkan sebuah representasi objek `user`. Struktur data ini bersumber dari Database dan berbentuk seperti berikut:

- **`id`** (String): Identifier unik primary key.
- **`nik`** (String): Nomor Induk Karyawan — **Ini digunakan sebagai ID / Username untuk keperluan Login.**
- **`name`** (String): Nama lengkap pengguna.
- **`role`** (String): Identitas **Jabatan** atau peran akses utama dalam sistem.
- **`divisi`** (String): Nama divisi tempat user tersebut berada.
- **`dinas`** (String): Nama dinas tempat user tersebut berada (Nullable).
- **`group`** (String): Grup pengelompokan pekerjaan (Nullable - Field tambahan opsional).
- **`email`** (String): Alamat email (Nullable).

*(Catatan: Field `password` pada Backend tidak akan dikembalikan ke API/Client).*

## Panduan Otorisasi Akses (Hak Akses Frontend)

Data di atas adalah kunci utama untuk merekayasa atau memutuskan UI/UX flow untuk setiap pengguna yang sedang _login_ (State User). Bila kamu (Frontend Builder) sedang membedakan tata kelola halaman:

1. **Gunakan Jabatan (`role`) sebagai Acuan Primer:**
   Gunakan field ini pertama kali untuk menentukan menu navigasi atau halaman apa saja yang boleh diakses. *(Contoh: Menyembunyikan tombol "Buat SPK" kecuali role = 'planner', dll).*

2. **Eksplorasi ke `divisi` / `dinas` / `group` sebagai Acuan Sekunder:**
   Seringkali di KTI Smartcare, ada pengguna dengan `role` yang sama (misalkan Kadis) tetapi butuh perlakuan berbeda, kamu perlu melakukan *cross-check logic* lebih lanjut. Jika field `role` dirasa kurang kuat untuk menentukan filter data, cobalah baca ke tingkat **`divisi`**. Jika masih kurang, rujuk ke **`dinas`**, dan lapis terakhir bisa merujuk pada **`group`**.
   Intinya, segala *user profile* bisa dieksplorasi dan ditarik seflesksibel mungkin dari hierarki field tersebut.

## ⚠️ Cara Singkat Melihat Konteks Role Existing (Penting Untuk Agent)

**Perhatian ke AI Frontend Agent:** Karena tidak ada dokumentasi hardcoded list of enums terkini, cara terbaik untuk mengetahui *Jabatan (role)* apa saja yang sudah terdaftar atau entitas *Dinas / Divisi* apa saja yang valid di sistem ini adalah melalui Eksekusi Data Nyata.

Di dalam halaman Admin (User Management), terdapat fitur tombol **"Export Excel"**. 
Jika kamu tidak tahu Role apa saja yang perlu kamu proses di FE:
1. **Suruh** *human user/programmer* yang berinteraksi denganmu untuk mendownload/klik file Excel tersebut dari web KTI.
2. Minta ia untuk *Paste (Copy/Paste)* isi data hasil ekspornya langsung ke dalam prompt chatmu.
3. Dengan kumpulan raw data nyata tersebut, kamu akan secara otomatis "paham sentosa" dan bisa memetakan skenario otorisasi Role di FE tanpa perlu menerka-nerka (hardcode membuta). 

Manfaatkan alur ini demi akurasi mapping Frontend ke Backend!
