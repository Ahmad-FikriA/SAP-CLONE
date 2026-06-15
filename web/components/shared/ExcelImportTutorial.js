'use client';

import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { HelpCircle, FileSpreadsheet, Copy, Check, Info, Table } from 'lucide-react';
import { toast } from 'sonner';

const TUTORIAL_DATA = {
  'equipment': {
    title: "Panduan Import Equipment",
    description: "Gunakan panduan ini untuk memasukkan daftar aset peralatan baru dari SAP ke sistem secara massal.",
    steps: [
      "Jalankan transaksi SAP IE08 atau IH08 untuk menampilkan daftar equipment yang diinginkan.",
      "Ekspor laporan hasil pencarian dari SAP ke format spreadsheet (Excel .xlsx).",
      "Pastikan file Excel memiliki baris header kolom pada baris pertama yang sesuai.",
      "Upload file Excel tersebut. Sistem secara otomatis melakukan Upsert (menambah data baru / memperbarui data lama berdasarkan Equipment ID)."
    ],
    headers: [
      { name: "Equipment ID", required: true, aliases: "equipment_id, equipment, equip_id", desc: "ID numeric SAP unik untuk peralatan (contoh: 2210000438)." },
      { name: "Equipment Name", required: true, aliases: "equipment_name, name, description", desc: "Nama lengkap atau keterangan deskripsi peralatan." },
      { name: "Category", required: false, aliases: "category, kategori", desc: "Disiplin kerja alat: Mekanik, Listrik, Sipil, atau Otomasi." },
      { name: "Functional Location ID", required: false, aliases: "func_loc_id, funcloc", desc: "Kode lokasi fungsional SAP (contoh: A-A1-01-005-004)." },
      { name: "Functional Location", required: false, aliases: "functional_location, location", desc: "Nama/deskripsi lokasi fungsional." },
      { name: "Plant ID", required: false, aliases: "plant_id, plant", desc: "Kode ID Plant area (contoh: I-22L001)." },
      { name: "Plant Name", required: false, aliases: "plant_name, plantdesc", desc: "Deskripsi nama Plant lokasi kerja." }
    ],
    sampleCSV: "Equipment ID,Equipment Name,Category,Functional Location ID,Functional Location,Plant ID,Plant Name\n2210000438,Pompa Intake Cidanau 1M1,Mekanik,A-A1-01-005-004,Pompa Intake Cidanau,I-22L001,PS I Cidanau\n2210000640,Panel Katodik Cidanau I,Listrik,A-A1-01-005-006,Panel Katodik,I-22L001,PS I Cidanau\n2210000605,Sensor AWLR,Otomasi,A-A1-01-001-001,Sensor AWLR Cidanau,I-22L001,PS I Cidanau",
    sampleRows: [
      ["Equipment ID", "Equipment Name", "Category", "Functional Location ID", "Functional Location", "Plant ID", "Plant Name"],
      ["2210000438", "Pompa Intake Cidanau 1M1", "Mekanik", "A-A1-01-005-004", "Pompa Intake Cidanau", "I-22L001", "PS I Cidanau"],
      ["2210000640", "Panel Katodik Cidanau I", "Listrik", "A-A1-01-005-006", "Panel Katodik", "I-22L001", "PS I Cidanau"],
      ["2210000605", "Sensor AWLR", "Otomasi", "A-A1-01-001-001", "Sensor AWLR Cidanau", "I-22L001", "PS I Cidanau"]
    ]
  },
  'task-list': {
    title: "Panduan Import Task List (Instruksi Kerja)",
    description: "Gunakan panduan ini untuk mengunggah instruksi kerja (Job Plan) secara massal.",
    steps: [
      "Buat file spreadsheet baru (.xlsx) dengan struktur baris datar (Flat Rows).",
      "Satu baris mewakili satu baris aktivitas langkah instruksi kerja.",
      "Untuk aktivitas yang tergolong dalam satu Task List, pastikan isi kolom Task List ID dan Nama ditulis sama persis di setiap baris aktivitas tersebut.",
      "Unggah file Excel pada halaman Mappings > tab Task Lists. Sistem akan memperbarui data task list yang ada dan menimpa aktivitas lamanya."
    ],
    headers: [
      { name: "Task List ID", required: true, aliases: "task_list_id, tasklist, id", desc: "Kode unik pengenal task list instruksi kerja (contoh: KTI_0026)." },
      { name: "Task List Name", required: true, aliases: "task_list_name, name, description", desc: "Nama atau keterangan instruksi kerja." },
      { name: "Category", required: true, aliases: "category, cat, kategori", desc: "Disiplin instruksi kerja: Mekanik, Listrik, Sipil, atau Otomasi." },
      { name: "Operation Text", required: true, aliases: "operation_text, operation, activity, text", desc: "Teks langkah instruksi kerja yang harus dilakukan." },
      { name: "Work Center", required: false, aliases: "work_center, workctr, wc", desc: "Kode regu / pos kerja pelaksana (contoh: M1-N01)." },
      { name: "Step Number", required: false, aliases: "step_number, step, no", desc: "Nomor urutan langkah aktivitas kerja (opsional, jika kosong diisi otomatis)." }
    ],
    sampleCSV: "Task List ID,Task List Name,Category,Operation Text,Work Center,Step Number\nKTI_0026,Perawatan 4 Mingguan Pompa Sentrifugal,Mekanik,Periksa kondisi fisik pompa,M1-N01,1\nKTI_0026,Perawatan 4 Mingguan Pompa Sentrifugal,Mekanik,Cek tekanan inlet dan outlet,M1-N01,2\nKTI_0026,Perawatan 4 Mingguan Pompa Sentrifugal,Mekanik,Lumasi bearing pompa,M1-N01,3",
    sampleRows: [
      ["Task List ID", "Task List Name", "Category", "Operation Text", "Work Center", "Step Number"],
      ["KTI_0026", "Perawatan 4 Mingguan Pompa Sentrifugal", "Mekanik", "Periksa kondisi fisik pompa", "M1-N01", "1"],
      ["KTI_0026", "Perawatan 4 Mingguan Pompa Sentrifugal", "Mekanik", "Cek tekanan inlet dan outlet", "M1-N01", "2"],
      ["KTI_0026", "Perawatan 4 Mingguan Pompa Sentrifugal", "Mekanik", "Lumasi bearing pompa", "M1-N01", "3"]
    ]
  },
  'preventive-spk': {
    title: "Panduan Import SPK Preventive",
    description: "Gunakan panduan ini untuk memproses impor work order (SPK) preventive maintenance dari SAP IW38.",
    steps: [
      "Jalankan transaksi IW38 atau IW39 di SAP GUI untuk memfilter daftar SPK Preventive.",
      "Ekspor daftar SPK tersebut ke format spreadsheet (Excel .xlsx).",
      "Upload file Excel tersebut. Sistem akan memuat list SPK dan melakukan pencocokan awal (preview).",
      "Periksa status resolusi interval (badge hijau = otomatis, biru = disarankan). Jika terdapat status ambigu atau tidak diketahui, pilih interval yang sesuai melalui dropdown.",
      "Klik tombol 'Konfirmasi Import' untuk menyimpan SPK dan secara otomatis mendistribusikannya ke teknisi bersangkutan."
    ],
    headers: [
      { name: "Order", required: true, aliases: "order", desc: "Nomor SPK SAP 10 digit (contoh: 8000123456)." },
      { name: "Description", required: true, aliases: "description", desc: "Keterangan deskripsi penugasan SPK." },
      { name: "Bas. start date", required: true, aliases: "bas. start date, bas start date", desc: "Tanggal mulai rencana SPK (Format: DD.MM.YYYY atau serial tanggal Excel)." },
      { name: "Planner Group", required: true, aliases: "planner group", desc: "Kode planner group SAP (221=Mekanik, 222=Listrik, 223=Sipil, 224=Otomasi)." },
      { name: "Equipment", required: false, aliases: "equipment", desc: "ID numeric Equipment SAP (untuk kategori non-Sipil)." },
      { name: "Functional Loc.", required: false, aliases: "functional loc., functional location", desc: "ID Lokasi Fungsional SAP (untuk kategori Sipil/Lokasi)." },
      { name: "Location", required: false, aliases: "location", desc: "Kode plant site lokasi SAP (contoh: P-22L008)." },
      { name: "Activity", required: false, aliases: "activity", desc: "Nomor urut langkah aktivitas penugasan." },
      { name: "Op. short text", required: false, aliases: "op. short text, short text", desc: "Teks langkah instruksi penugasan." },
      { name: "Duration Plan", required: false, aliases: "duration plan, dur. plan, dur plan", desc: "Estimasi durasi rencana pengerjaan dalam menit (angka)." }
    ],
    sampleCSV: "Order,Description,Bas. start date,Planner Group,Equipment,Functional Loc.,Location,Activity,Op. short text,Duration Plan\n8001002030,PM Mekanik W15 - Pompa Intake Cidanau,13.04.2026,221,2210000438,A-A1-01-005-004,P-22L008,0010,Cek vibrasi dan suhu pompa,30\n8001002030,PM Mekanik W15 - Pompa Intake Cidanau,13.04.2026,221,2210000438,A-A1-01-005-004,P-22L008,0020,Cek kebocoran seal pompa,20",
    sampleRows: [
      ["Order", "Description", "Bas. start date", "Planner Group", "Equipment", "Functional Loc.", "Location", "Activity", "Op. short text", "Duration Plan"],
      ["8001002030", "PM Mekanik W15 - Pompa Intake Cidanau", "13.04.2026", "221", "2210000438", "A-A1-01-005-004", "P-22L008", "0010", "Cek vibrasi dan suhu pompa", "30"],
      ["8001002030", "PM Mekanik W15 - Pompa Intake Cidanau", "13.04.2026", "221", "2210000438", "A-A1-01-005-004", "P-22L008", "0020", "Cek kebocoran seal pompa", "20"]
    ]
  },
  'users': {
    title: "Panduan Import Users & Karyawan",
    description: "Gunakan panduan ini untuk mengunggah akun karyawan secara massal ke dalam sistem.",
    steps: [
      "Buat file spreadsheet Excel (.xlsx) dengan data pengguna.",
      "Pastikan kolom NIK dan Nama terisi lengkap.",
      "Upload file. Sistem akan secara otomatis mendeteksi NIK yang sudah terdaftar di database untuk dilewati, dan mendaftarkan akun baru dengan password default 'password123'."
    ],
    headers: [
      { name: "NIK", required: true, aliases: "nik", desc: "Nomor Induk Karyawan untuk login ID (contoh: 220104)." },
      { name: "Nama", required: true, aliases: "nama, name", desc: "Nama lengkap karyawan." },
      { name: "Jabatan", required: false, aliases: "jabatan, role", desc: "Peran akses: teknisi, planner, supervisor, manager, admin." },
      { name: "Seksi", required: false, aliases: "seksi, group", desc: "Disiplin seksi/grup kerja (contoh: Mekanik, Elektrik, Sipil)." },
      { name: "Dinas", required: false, aliases: "dinas", desc: "Unit kerja kedinasan." },
      { name: "Divisi", required: false, aliases: "divisi, division, department", desc: "Divisi kerja perusahaan." }
    ],
    sampleCSV: "NIK,Nama,Jabatan,Seksi,Dinas,Divisi\n221098,Budi Santoso,teknisi,Mekanik,Pemeliharaan,Distribusi Air\n221099,Siti Aminah,planner,Elektrik,Perencanaan,Pemeliharaan Listrik",
    sampleRows: [
      ["NIK", "Nama", "Jabatan", "Seksi", "Dinas", "Divisi"],
      ["221098", "Budi Santoso", "teknisi", "Mekanik", "Pemeliharaan", "Distribusi Air"],
      ["221099", "Siti Aminah", "planner", "Elektrik", "Perencanaan", "Pemeliharaan Listrik"]
    ]
  },
  'materials': {
    title: "Panduan Import Stock Material",
    description: "Gunakan panduan ini untuk menyelaraskan inventori material dan spare part gudang dari laporan SAP MM60.",
    steps: [
      "Jalankan transaksi SAP MM60 atau laporan persediaan stock plant di SAP.",
      "Ekspor laporan tersebut ke format spreadsheet (Excel .xlsx).",
      "Upload file Excel tersebut. Sistem akan memperbarui jumlah stok bebas (unrestricted stock) dan harga rata-rata secara massal."
    ],
    headers: [
      { name: "Material", required: true, aliases: "Material", desc: "Kode unik material SAP (contoh: 10005421)." },
      { name: "Material Description", required: true, aliases: "Material Description", desc: "Nama deskripsi barang / spare part." },
      { name: "Plant", required: true, aliases: "Plant", desc: "Kode plant gudang penyimpanan (contoh: 22L0)." },
      { name: "Storage Location", required: true, aliases: "Storage Location", desc: "Kode lokasi gudang (contoh: G001)." },
      { name: "Base Unit of Measure", required: false, aliases: "Base Unit of Measure", desc: "Satuan barang (contoh: PCS, KG, MTR, SET)." },
      { name: "Unrestricted", required: false, aliases: "Unrestricted", desc: "Jumlah kuantitas stok yang tersedia (bebas digunakan)." },
      { name: "Value Unrestricted", required: false, aliases: "Value Unrestricted", desc: "Nilai nominal total dari stok bebas." }
    ],
    sampleCSV: "Material,Material Description,Plant,Storage Location,Base Unit of Measure,Unrestricted,Value Unrestricted\n10005421,Grease Shell Alvania 2,22L0,G001,KG,50,1500000\n10005422,Bearing SKF 6204-2RSH,22L0,G001,PCS,12,600000",
    sampleRows: [
      ["Material", "Material Description", "Plant", "Storage Location", "Base Unit of Measure", "Unrestricted", "Value Unrestricted"],
      ["10005421", "Grease Shell Alvania 2", "22L0", "G001", "KG", "50", "1500000"],
      ["10005422", "Bearing SKF 6204-2RSH", "22L0", "G001", "PCS", "12", "600000"]
    ]
  },
  'corrective-spk': {
    title: "Panduan Import SPK Corrective & History",
    description: "Gunakan panduan ini untuk mengimpor work order (SPK) corrective maintenance dari SAP IW38/IW39/IW49.",
    steps: [
      "Jalankan transaksi IW38, IW39, atau IW49 di SAP GUI untuk menyaring daftar SPK Corrective.",
      "Ekspor daftar SPK tersebut ke format spreadsheet (Excel .xlsx).",
      "Upload file Excel tersebut pada halaman Corrective.",
      "Untuk 'Import SAP' (tugas baru): Sistem akan menampilkan preview data SPK baru. Periksa kesesuaian data lalu klik 'Simpan Data' untuk memproses dan mendistribusikan ke regu kerja.",
      "Untuk 'Import History' (laporan selesai): Data akan diimpor langsung ke riwayat penugasan dengan status 'Selesai' (TECO)."
    ],
    headers: [
      { name: "Order", required: true, aliases: "order", desc: "Nomor SPK SAP 10 digit unik (contoh: 8002001040)." },
      { name: "Description", required: false, aliases: "description", desc: "Deskripsi singkat penugasan/kerusakan alat." },
      { name: "System Status", required: false, aliases: "sys, status, system status", desc: "Status sistem SAP (e.g. CRTE, APPR, TECO). Jika mengandung TECO, otomatis diimpor sebagai Selesai." },
      { name: "Work Center", required: false, aliases: "work center, workcenter, oper.work center", desc: "Kode regu kerja pelaksana (contoh: M1-N01, E1-N01)." },
      { name: "Activity", required: false, aliases: "activity", desc: "Nomor urut langkah aktivitas penugasan." },
      { name: "Short Text", required: false, aliases: "short text, op. short text", desc: "Detail uraian pekerjaan per baris aktivitas." },
      { name: "Normal Duration", required: false, aliases: "normal dur, norm dur, normal duration", desc: "Estimasi waktu pengerjaan normal per orang." },
      { name: "Duration Plan", required: false, aliases: "duration plan, dur plan, dur. plan", desc: "Rencana alokasi waktu durasi pengerjaan." },
      { name: "Duration Actual", required: false, aliases: "duration actual, dur act, dur. act", desc: "Realisasi jam kerja aktual (diperlukan untuk data history)." },
      { name: "Basic Start Date", required: false, aliases: "work start, bas. start date, basic start, bas.start", desc: "Tanggal mulai rencana SPK (Format: DD.MM.YYYY atau serial Excel)." },
      { name: "Basic Finish Date", required: false, aliases: "work finish, basic fin. date, basic fin, basic finish, bas.finish", desc: "Tanggal selesai rencana SPK." },
      { name: "Equipment", required: false, aliases: "equipment", desc: "Nama atau kode equipment terkait dari SAP." },
      { name: "Functional Location", required: false, aliases: "functional loc, functional location", desc: "Kode Lokasi Fungsional alat (contoh: A-A1-01-005-004)." },
      { name: "Location", required: false, aliases: "location", desc: "Kode plant lokasi SAP (contoh: P-22L008)." }
    ],
    sampleCSV: "Order,Description,System Status,Work Center,Activity,Short Text,Basic Start Date,Basic Finish Date,Equipment,Functional Loc.,Location\n8002001040,Perbaikan Kebocoran Pipa G1,CRTE,M1-N01,0010,Las ulang sambungan flange pipa,15.04.2026,16.04.2026,2210000438,A-A1-01-005-004,P-22L008\n8002001045,Ganti Magnetic Contactor Blower,TECO,E1-N01,0010,Bongkar pasang contactor magnetik baru,15.04.2026,15.04.2026,2210000640,A-A1-01-005-006,P-22L008",
    sampleRows: [
      ["Order", "Description", "System Status", "Work Center", "Activity", "Short Text", "Basic Start Date", "Basic Finish Date", "Equipment", "Functional Loc.", "Location"],
      ["8002001040", "Perbaikan Kebocoran Pipa G1", "CRTE", "M1-N01", "0010", "Las ulang sambungan flange pipa", "15.04.2026", "16.04.2026", "2210000438", "A-A1-01-005-004", "P-22L008"],
      ["8002001045", "Ganti Magnetic Contactor Blower", "TECO", "E1-N01", "0010", "Bongkar pasang contactor magnetik baru", "15.04.2026", "15.04.2026", "2210000640", "A-A1-01-005-006", "P-22L008"]
    ]
  }
};

const getColLetter = (idx) => {
  return String.fromCharCode(65 + idx);
};

export function ExcelImportTutorial({ type, className = "" }) {
  const [open, setOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('procedure');
  const [copied, setCopied] = useState(false);
  const [showCsvRaw, setShowCsvRaw] = useState(false);

  const data = TUTORIAL_DATA[type];
  if (!data) return null;

  const handleCopy = () => {
    navigator.clipboard.writeText(data.sampleCSV);
    setCopied(true);
    toast.success("Contoh CSV berhasil disalin!");
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => setOpen(true)}
        className={`gap-1.5 border-blue-200 text-blue-700 hover:bg-blue-50/50 hover:text-blue-800 ${className}`}
      >
        <HelpCircle size={14} className="animate-pulse" />
        Panduan Import
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-6xl max-h-[85vh] flex flex-col p-0 gap-0 overflow-hidden bg-white">
          {/* Header */}
          <DialogHeader className="p-6 pb-4 border-b border-gray-100 bg-slate-50/50">
            <div className="flex items-center gap-2 text-blue-700">
              <FileSpreadsheet size={20} />
              <DialogTitle className="text-lg font-bold text-slate-800">{data.title}</DialogTitle>
            </div>
            <p className="text-xs text-gray-500 mt-1">{data.description}</p>
          </DialogHeader>

          {/* Navigation Tabs */}
          <div className="flex border-b border-gray-100 px-6 bg-slate-50/50 shrink-0">
            {[
              { id: 'procedure', label: 'Alur & Prosedur' },
              { id: 'headers', label: 'Kolom & Header Excel' },
              { id: 'sample', label: 'Contoh Tampilan Excel' }
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`py-2.5 px-4 text-xs font-semibold border-b-2 transition-all outline-none ${activeTab === tab.id
                    ? 'border-blue-600 text-blue-700'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                  }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Tab Content Area */}
          <div className="flex-1 overflow-y-auto p-6 space-y-4">
            {activeTab === 'procedure' && (
              <div className="space-y-4">
                <div className="flex items-center gap-2 text-xs font-bold text-slate-700 uppercase tracking-wide">
                  <Info size={14} className="text-blue-600" />
                  Langkah-Langkah Ekstraksi & Import
                </div>
                <div className="relative border-l border-blue-100 pl-4 ml-2.5 space-y-5">
                  {data.steps.map((step, idx) => (
                    <div key={idx} className="relative">
                      <div className="absolute -left-[26px] top-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-blue-100 text-[10px] font-bold text-blue-700 border-2 border-white">
                        {idx + 1}
                      </div>
                      <p className="text-xs text-gray-600 leading-relaxed font-medium">{step}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {activeTab === 'headers' && (
              <div className="space-y-3">
                <p className="text-xs text-gray-600 bg-amber-50 border border-amber-200/50 rounded-lg p-2.5 leading-relaxed">
                  💡 <strong>Tips Pencocokan Kolom:</strong> Sistem mencocokkan header secara otomatis. Urutan kolom bebas (tidak harus berurutan). Nama header tidak sensitif terhadap huruf besar/kecil (case-insensitive) serta mengabaikan spasi, garis bawah (_), atau tanda hubung (-).
                </p>
                <div className="border border-gray-200 rounded-lg overflow-hidden">
                  <div className="max-h-[300px] overflow-y-auto">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead className="bg-slate-50 border-b border-gray-200 sticky top-0">
                        <tr>
                          <th className="p-2.5 font-bold text-gray-700">Nama Kolom</th>
                          <th className="p-2.5 font-bold text-gray-700 w-20">Status</th>
                          <th className="p-2.5 font-bold text-gray-700">Variasi Header</th>
                          <th className="p-2.5 font-bold text-gray-700">Keterangan</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {data.headers.map((h, idx) => (
                          <tr key={idx} className="hover:bg-slate-50/50">
                            <td className="p-2.5 font-bold text-slate-800 font-mono text-[10px]">{h.name}</td>
                            <td className="p-2.5">
                              {h.required ? (
                                <span className="px-1.5 py-0.5 rounded bg-red-50 border border-red-100 text-red-600 text-[9px] font-bold">
                                  Wajib
                                </span>
                              ) : (
                                <span className="px-1.5 py-0.5 rounded bg-gray-50 border border-gray-100 text-gray-500 text-[9px] font-semibold">
                                  Opsional
                                </span>
                              )}
                            </td>
                            <td className="p-2.5 text-gray-600 font-mono text-[10px] whitespace-pre-wrap">{h.aliases}</td>
                            <td className="p-2.5 text-gray-500 leading-normal">{h.desc}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'sample' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-gray-500 font-medium">Contoh baris spreadsheet (.xlsx) di Excel</span>
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={() => setShowCsvRaw(prev => !prev)}
                      className="h-7 text-xs gap-1 hover:bg-slate-100 shrink-0"
                    >
                      <Table size={12} />
                      {showCsvRaw ? "Lihat Excel Grid" : "Lihat CSV Raw"}
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={handleCopy}
                      className="h-7 text-xs gap-1 border-blue-200 text-blue-700 hover:bg-blue-50/50 shrink-0"
                    >
                      {copied ? <Check size={12} className="text-green-600" /> : <Copy size={12} />}
                      {copied ? "Tersalin" : "Salin Contoh Data"}
                    </Button>
                  </div>
                </div>

                {showCsvRaw ? (
                  /* CSV Raw code display */
                  <div className="bg-slate-900 border border-slate-800 rounded-lg p-4 overflow-x-auto">
                    <pre className="text-[10px] font-mono text-slate-200 leading-relaxed whitespace-pre">
                      {data.sampleCSV}
                    </pre>
                  </div>
                ) : (
                  /* Premium simulated Excel sheet grid */
                  <div className="border border-slate-200 rounded-xl overflow-hidden shadow-sm bg-[#f3f3f3] p-1 select-none">
                    {/* Excel top header toolbar area */}
                    <div className="flex items-center gap-1.5 px-3 py-1.5 bg-white border-b border-slate-200 text-[10.5px] font-semibold text-slate-500 font-sans">
                      <div className="w-2.5 h-2.5 rounded bg-green-700 mr-1 shrink-0" />
                      <span>Excel Simulator Preview</span>
                    </div>

                    <div className="overflow-x-auto bg-white border-t border-slate-200">
                      <table className="min-w-full text-[11px] font-sans border-collapse">
                        <thead>
                          {/* Alphabetic column letters (A, B, C, D...) */}
                          <tr className="bg-slate-100 border-b border-slate-200">
                            <th className="w-8 border-r border-slate-200 text-center font-normal text-slate-400 select-none bg-slate-100/70 p-1.5"></th>
                            {data.sampleRows[0].map((_, colIdx) => (
                              <th key={colIdx} className="border-r border-slate-200 text-center font-semibold text-slate-500 min-w-[90px] bg-slate-100 p-1.5 uppercase font-mono">
                                {getColLetter(colIdx)}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {data.sampleRows.map((row, rowIdx) => {
                            const isHeader = rowIdx === 0;
                            return (
                              <tr key={rowIdx} className="border-b border-slate-150 hover:bg-slate-50/50">
                                {/* Row number column */}
                                <td className="border-r border-slate-200 text-center text-slate-400 bg-slate-100/70 font-mono p-1.5 select-none font-medium">
                                  {rowIdx + 1}
                                </td>
                                {/* Excel Cell values */}
                                {row.map((cellValue, colIdx) => (
                                  <td
                                    key={colIdx}
                                    className={`border-r border-slate-200 px-2.5 py-1.5 leading-tight truncate max-w-[200px] ${isHeader
                                        ? 'bg-slate-50/80 font-bold text-slate-800 text-[10px] text-center border-b-2 border-b-slate-300'
                                        : 'font-mono text-slate-600 text-[10.5px]'
                                      }`}
                                    title={cellValue}
                                  >
                                    {cellValue}
                                  </td>
                                ))}
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
                <p className="text-[10px] text-gray-400">
                  * Anda dapat menyalin data contoh di atas dan menyimpannya sebagai file `.csv` atau langsung mem-paste ke Excel.
                </p>
              </div>
            )}
          </div>

          {/* Footer - fixed responsiveness with m-0 overriding dialog component defaults */}
          <DialogFooter className="m-0 p-4 border-t border-gray-100 bg-slate-50/50 shrink-0 flex justify-end gap-2">
            <DialogClose asChild>
              <Button type="button" variant="outline" size="sm">
                Tutup Panduan
              </Button>
            </DialogClose>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
