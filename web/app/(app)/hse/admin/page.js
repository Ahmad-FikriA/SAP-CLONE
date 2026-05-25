'use client';

import { useState, useCallback, useEffect } from 'react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { apiGet, apiPut } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Settings,
  Users,
  Clock,
  Undo2,
  ListChecks,
  Save,
  ShieldCheck,
  AlertTriangle,
  Timer,
  ChevronDown,
  ChevronUp,
  Plus,
  Trash2,
  GripVertical,
  Eye,
  Copy,
  ToggleLeft,
  Type,
  AlignLeft,
  CheckSquare,
  CircleDot,
  Hash,
  HelpCircle,
  ArrowLeft,
  Pencil,
  X,
} from 'lucide-react';

// ═══════════════════════════════════════════════════════════════════════════════
// TAB DEFINITIONS
// ═══════════════════════════════════════════════════════════════════════════════
const TABS = [
  { key: 'settings', label: 'Pengaturan Umum', icon: Settings },
  { key: 'jam-aman', label: 'Jam Kerja Aman', icon: Timer },
  { key: 'revert', label: 'Mundurkan Tahapan', icon: Undo2 },
  { key: 'form-builder', label: 'Form Investigasi', icon: ListChecks },
];

// ═══════════════════════════════════════════════════════════════════════════════
// DUMMY DATA
// ═══════════════════════════════════════════════════════════════════════════════
const DUMMY_INVESTIGATION_REPORTS = [
  {
    id: 'rpt-001',
    reportNumber: 'K3-20260520-0001',
    kategori: 'Lost Time Injury',
    deskripsi: 'Pekerja terjatuh dari scaffolding di area pabrik 2',
    status: 'menunggu_verifikasi_investigasi',
    jenisTindakan: 'investigasi',
    investigasiCategory: 'Kecelakaan',
    pelapor: { name: 'Ahmad Fauzi' },
    createdAt: '2026-05-18T08:30:00Z',
  },
  {
    id: 'rpt-002',
    reportNumber: 'K3-20260519-0003',
    kategori: 'Medical Treatment',
    deskripsi: 'Iritasi kulit akibat paparan bahan kimia tanpa APD',
    status: 'investigasi_ditolak_kadis_hse',
    jenisTindakan: 'investigasi',
    investigasiCategory: 'Penyakit Akibat Kerja',
    pelapor: { name: 'Budi Santoso' },
    createdAt: '2026-05-19T10:15:00Z',
  },
  {
    id: 'rpt-003',
    reportNumber: 'K3-20260517-0002',
    kategori: 'Near Miss',
    deskripsi: 'Korsleting panel listrik utama area boiler',
    status: 'menunggu_validasi_kadiv',
    jenisTindakan: 'investigasi',
    investigasiCategory: 'Kebakaran',
    pelapor: { name: 'Cecep Hidayat' },
    createdAt: '2026-05-17T14:00:00Z',
  },
  {
    id: 'rpt-004',
    reportNumber: 'K3-20260515-0001',
    kategori: 'First Aid Case',
    deskripsi: 'Luka gores akibat pecahan kaca di workshop mesin',
    status: 'investigasi_ditolak_kadiv',
    jenisTindakan: 'investigasi',
    investigasiCategory: 'Kecelakaan',
    pelapor: { name: 'Dedi Mulyadi' },
    createdAt: '2026-05-15T09:45:00Z',
  },
];

const INVESTIGATION_STATUS_MAP = {
  menunggu_verifikasi_investigasi: {
    label: 'Verifikasi Investigasi',
    color: 'bg-indigo-100 text-indigo-700',
  },
  investigasi_ditolak_kadis_hse: {
    label: 'Ditolak Kadis HSE',
    color: 'bg-rose-100 text-rose-700',
  },
  menunggu_validasi_kadiv: {
    label: 'Validasi Kadiv',
    color: 'bg-purple-100 text-purple-700',
  },
  investigasi_ditolak_kadiv: {
    label: 'Ditolak Kadiv',
    color: 'bg-rose-100 text-rose-700',
  },
};

// ═══════════════════════════════════════════════════════════════════════════════
// QUESTION TYPE CONFIG
// ═══════════════════════════════════════════════════════════════════════════════
const QUESTION_TYPES = [
  { key: 'short_text', label: 'Jawaban Singkat', icon: Type },
  { key: 'long_text', label: 'Jawaban Panjang', icon: AlignLeft },
  { key: 'multiple_choice', label: 'Pilihan Ganda', icon: CircleDot },
  { key: 'checkbox', label: 'Checkbox', icon: CheckSquare },
  { key: 'yes_no', label: 'Ya / Tidak', icon: ToggleLeft },
  { key: 'number', label: 'Angka', icon: Hash },
];

const INVESTIGATION_CATEGORIES = [
  { key: 'kecelakaan', label: 'Kecelakaan' },
  { key: 'penyakit_kerja', label: 'Penyakit Akibat Kerja' },
  { key: 'kebakaran', label: 'Kebakaran' },
];

// Pre-populated dummy questions
const INITIAL_FORM_DATA = {
  kecelakaan: [
    { id: 'q1', label: 'Apa jenis kecelakaan yang terjadi?', type: 'multiple_choice', required: true, options: ['Terjatuh', 'Tertimpa', 'Terjepit', 'Tertabrak', 'Lainnya'] },
    { id: 'q2', label: 'Jelaskan kronologi kejadian secara singkat', type: 'long_text', required: true, options: [] },
    { id: 'q3', label: 'Apakah korban menggunakan APD saat kejadian?', type: 'yes_no', required: true, options: [] },
    { id: 'q4', label: 'Jumlah korban', type: 'number', required: true, options: [] },
    { id: 'q5', label: 'APD yang digunakan saat kejadian', type: 'checkbox', required: false, options: ['Helm', 'Sepatu Safety', 'Sarung Tangan', 'Kacamata', 'Rompi'] },
  ],
  penyakit_kerja: [
    { id: 'q1', label: 'Jenis penyakit yang didiagnosis', type: 'short_text', required: true, options: [] },
    { id: 'q2', label: 'Berapa lama pekerja terpapar bahan/kondisi berbahaya?', type: 'short_text', required: true, options: [] },
    { id: 'q3', label: 'Apakah pekerja pernah menjalani medical check-up sebelumnya?', type: 'yes_no', required: true, options: [] },
    { id: 'q4', label: 'Faktor penyebab utama', type: 'multiple_choice', required: true, options: ['Bahan Kimia', 'Debu', 'Kebisingan', 'Ergonomi', 'Radiasi', 'Lainnya'] },
  ],
  kebakaran: [
    { id: 'q1', label: 'Lokasi titik api pertama kali terdeteksi', type: 'short_text', required: true, options: [] },
    { id: 'q2', label: 'Sumber api / penyebab kebakaran', type: 'multiple_choice', required: true, options: ['Korsleting Listrik', 'Bahan Kimia', 'Gesekan Mekanis', 'Rokok/Api Terbuka', 'Lainnya'] },
    { id: 'q3', label: 'Apakah sistem APAR/sprinkler berfungsi saat kejadian?', type: 'yes_no', required: true, options: [] },
    { id: 'q4', label: 'Estimasi kerugian material', type: 'short_text', required: false, options: [] },
    { id: 'q5', label: 'Kronologi detail kebakaran', type: 'long_text', required: true, options: [] },
  ],
};

// ═══════════════════════════════════════════════════════════════════════════════
// TAB 1: PENGATURAN UMUM
// ═══════════════════════════════════════════════════════════════════════════════
function SettingsTab({ settings, fetchSettings }) {
  const [totalKaryawan, setTotalKaryawan] = useState(settings?.totalKaryawan || 280);
  const [jamPerHari, setJamPerHari] = useState(settings?.jamKerjaPerHari || 8);
  const [hariPerBulan, setHariPerBulan] = useState(settings?.hariKerjaPerBulan || 20);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (settings) {
      setTotalKaryawan(settings.totalKaryawan || 280);
      setJamPerHari(settings.jamKerjaPerHari || 8);
      setHariPerBulan(settings.hariKerjaPerBulan || 20);
    }
  }, [settings]);

  const jamPerBulan = jamPerHari * hariPerBulan;
  const totalJamKerjaTahun = totalKaryawan * jamPerBulan * 12;

  const handleSave = async () => {
    setSaving(true);
    try {
      await apiPut('/k3-settings', {
        totalKaryawan,
        jamKerjaPerHari: jamPerHari,
        hariKerjaPerBulan: hariPerBulan
      });
      await fetchSettings();
      toast.success('Pengaturan berhasil disimpan');
    } catch (e) {
      toast.error('Gagal menyimpan: ' + e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Summary Card */}
      <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-2xl p-6 text-white shadow-xl">
        <div className="flex items-center gap-2 mb-4">
          <Users size={18} className="text-blue-400" />
          <h3 className="font-semibold text-sm uppercase tracking-wider text-blue-300">
            Ringkasan Konfigurasi
          </h3>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            { label: 'Total Karyawan', value: totalKaryawan.toLocaleString(), suffix: 'orang' },
            { label: 'Jam Kerja/Hari', value: jamPerHari, suffix: 'jam' },
            { label: 'Hari Kerja/Bulan', value: hariPerBulan, suffix: 'hari' },
            { label: 'Total Jam Kerja/Tahun', value: totalJamKerjaTahun.toLocaleString(), suffix: 'jam' },
          ].map((item) => (
            <div key={item.label} className="bg-white/10 rounded-xl p-3.5 backdrop-blur-sm">
              <p className="text-[11px] text-white/60 font-medium uppercase tracking-wide">{item.label}</p>
              <p className="text-xl font-bold mt-1">
                {item.value}
                <span className="text-xs font-normal text-white/50 ml-1">{item.suffix}</span>
              </p>
            </div>
          ))}
        </div>
        <p className="text-xs text-white/40 mt-4">
          Total Jam Kerja/Tahun = {totalKaryawan} karyawan × {jamPerBulan} jam/bulan × 12 bulan = <strong className="text-white/70">{totalJamKerjaTahun.toLocaleString()} jam</strong>
        </p>
      </div>

      {/* Form */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm">
        <div className="px-6 py-4 border-b border-slate-100">
          <h3 className="text-sm font-semibold text-slate-800">Konfigurasi Jam Kerja & Karyawan</h3>
          <p className="text-xs text-slate-400 mt-0.5">
            Nilai ini digunakan sebagai variabel rumus metrik K3 (NMRR, SOR, TRIR, LTIFR) di dashboard.
          </p>
        </div>
        <div className="p-6 space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700 flex items-center gap-1.5">
                <Users size={14} className="text-slate-400" />
                Jumlah Karyawan
              </label>
              <Input
                type="number"
                value={totalKaryawan}
                onChange={(e) => setTotalKaryawan(Number(e.target.value) || 0)}
                min={1}
                className="h-11 text-lg font-semibold"
              />
              <p className="text-[11px] text-slate-400">Termasuk karyawan tetap & outsourcing</p>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700 flex items-center gap-1.5">
                <Clock size={14} className="text-slate-400" />
                Jam Kerja per Hari
              </label>
              <Input
                type="number"
                value={jamPerHari}
                onChange={(e) => setJamPerHari(Number(e.target.value) || 0)}
                min={1}
                max={24}
                className="h-11 text-lg font-semibold"
              />
              <p className="text-[11px] text-slate-400">Standar: 8 jam/hari</p>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700 flex items-center gap-1.5">
                <Clock size={14} className="text-slate-400" />
                Hari Kerja per Bulan
              </label>
              <Input
                type="number"
                value={hariPerBulan}
                onChange={(e) => setHariPerBulan(Number(e.target.value) || 0)}
                min={1}
                max={31}
                className="h-11 text-lg font-semibold"
              />
              <p className="text-[11px] text-slate-400">Bisa disesuaikan (shift, weekends)</p>
            </div>
          </div>

          {/* Info Box */}
          <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-xl p-4">
            <AlertTriangle size={16} className="text-amber-500 mt-0.5 shrink-0" />
            <div className="text-xs text-amber-700 space-y-1">
              <p className="font-semibold">Catatan Penting</p>
              <p>Perubahan nilai ini akan langsung mempengaruhi perhitungan metrik K3 di dashboard HSE Command Center (NMRR, SOR, TRIR, LTIFR).</p>
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <Button onClick={handleSave} disabled={saving} className="gap-2 px-6 h-10">
              <Save size={15} />
              {saving ? 'Menyimpan...' : 'Simpan Pengaturan'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// TAB 2: JAM KERJA TANPA KECELAKAAN
// ═══════════════════════════════════════════════════════════════════════════════
function SafeHoursTab({ settings, fetchSettings }) {
  const safeHours = settings?.jamKerjaTanpaKecelakaan || 0;
  const [editValue, setEditValue] = useState(String(safeHours));
  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!isEditing) setEditValue(String(safeHours));
  }, [safeHours, isEditing]);

  const handleSave = async () => {
    const num = parseInt(editValue, 10);
    if (isNaN(num) || num < 0) {
      toast.error('Masukkan angka yang valid');
      return;
    }
    setSaving(true);
    try {
      await apiPut('/k3-settings', { jamKerjaTanpaKecelakaan: num });
      await fetchSettings();
      setIsEditing(false);
      toast.success('Jam kerja aman berhasil diperbarui');
    } catch (e) {
      toast.error('Gagal menyimpan: ' + e.message);
    } finally {
      setSaving(false);
    }
  };

  const days = Math.floor(safeHours / 24);
  const months = Math.floor(days / 30);
  const years = (days / 365).toFixed(1);

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Hero Display */}
      <div className="relative overflow-hidden bg-gradient-to-br from-emerald-600 via-emerald-700 to-teal-800 rounded-2xl p-8 md:p-12 text-white shadow-2xl">
        {/* Background decoration */}
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -translate-y-1/3 translate-x-1/3" />
        <div className="absolute bottom-0 left-0 w-48 h-48 bg-white/5 rounded-full translate-y-1/3 -translate-x-1/4" />

        <div className="relative z-10 text-center">
          <div className="flex items-center justify-center gap-2 mb-4">
            <ShieldCheck size={24} className="text-emerald-200" />
            <span className="text-sm font-semibold uppercase tracking-widest text-emerald-200">
              Jam Kerja Tanpa Kecelakaan
            </span>
          </div>

          <div className="text-6xl md:text-8xl font-black tracking-tight mb-3 tabular-nums">
            {safeHours.toLocaleString('id-ID')}
          </div>
          <p className="text-lg text-emerald-100 font-medium">Jam</p>

          <div className="flex items-center justify-center gap-4 sm:gap-8 mt-6 text-sm">
            {[
              { label: 'Hari', value: days.toLocaleString() },
              { label: 'Bulan', value: months.toLocaleString() },
              { label: 'Tahun', value: years },
            ].map((item) => (
              <div key={item.label} className="bg-white/10 backdrop-blur-sm rounded-xl px-4 py-2.5">
                <p className="text-2xl font-bold">{item.value}</p>
                <p className="text-[11px] text-emerald-200 uppercase tracking-wide font-medium">{item.label}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Edit Section */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm">
        <div className="px-6 py-4 border-b border-slate-100">
          <h3 className="text-sm font-semibold text-slate-800">Perbarui Jam Kerja Aman</h3>
          <p className="text-xs text-slate-400 mt-0.5">
            Masukkan total jam kerja tanpa kecelakaan secara manual. Nilai ini akan ditampilkan di display publik.
          </p>
        </div>
        <div className="p-6">
          {isEditing ? (
            <div className="flex items-end gap-3">
              <div className="flex-1 space-y-2">
                <label className="text-sm font-medium text-slate-700">Total Jam Kerja Aman</label>
                <Input
                  type="number"
                  value={editValue}
                  onChange={(e) => setEditValue(e.target.value)}
                  min={0}
                  className="h-12 text-2xl font-bold text-center"
                  autoFocus
                />
              </div>
              <div className="flex gap-2 pb-0.5">
                <Button onClick={handleSave} disabled={saving} className="gap-1.5 h-12 px-6">
                  <Save size={15} />
                  {saving ? 'Menyimpan...' : 'Simpan'}
                </Button>
                <Button variant="outline" onClick={() => { setIsEditing(false); setEditValue(String(safeHours)); }} className="h-12">
                  Batal
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500">Nilai saat ini</p>
                <p className="text-3xl font-bold text-slate-900 tabular-nums">{safeHours.toLocaleString('id-ID')} <span className="text-base font-normal text-slate-400">jam</span></p>
              </div>
              <Button variant="outline" onClick={() => { setIsEditing(true); setEditValue(String(safeHours)); }} className="gap-2 h-10">
                <Pencil size={14} />
                Ubah Nilai
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// TAB 3: MUNDURKAN TAHAPAN
// ═══════════════════════════════════════════════════════════════════════════════
function RevertStepTab() {
  const [reports, setReports] = useState([]);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [selectedReport, setSelectedReport] = useState(null);
  const [reverting, setReverting] = useState(false);
  const [loading, setLoading] = useState(true);

  const fetchReports = useCallback(async () => {
    try {
      const res = await apiGet('/k3-safety');
      setReports(res.data || []);
    } catch (e) {
      toast.error('Gagal mengambil laporan K3: ' + e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchReports();
  }, [fetchReports]);

  const handleRevert = async () => {
    if (!selectedReport) return;
    setReverting(true);
    try {
      await apiPut(`/k3-safety/${selectedReport.id}/revert-step`, {});
      toast.success('Status berhasil dimundurkan ke "Menunggu Tindakan HSE"');
      setConfirmOpen(false);
      setSelectedReport(null);
      await fetchReports();
    } catch (e) {
      toast.error('Gagal memundurkan status: ' + e.message);
    } finally {
      setReverting(false);
    }
  };

  const activeReports = reports.filter((r) =>
    ['menunggu_verifikasi_investigasi', 'investigasi_ditolak_kadis_hse', 'menunggu_validasi_kadiv', 'investigasi_ditolak_kadiv'].includes(r.status)
  );

  const revertedReports = reports.filter((r) => r.status === 'menunggu_tindakan_hse');

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Info */}
      <div className="flex items-start gap-3 bg-blue-50 border border-blue-200 rounded-xl p-4">
        <HelpCircle size={16} className="text-blue-500 mt-0.5 shrink-0" />
        <div className="text-xs text-blue-700 space-y-1">
          <p className="font-semibold">Apa itu Mundurkan Tahapan?</p>
          <p>Fitur ini digunakan untuk membatalkan keputusan investigasi dan mengembalikan laporan ke tahap &ldquo;Menunggu Tindakan HSE&rdquo;, sehingga petugas bisa memilih ulang jenis tindakan (misalnya, dari investigasi menjadi perbaikan langsung).</p>
        </div>
      </div>

      {/* Reports in investigation pipeline */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-slate-800">Laporan Dalam Jalur Investigasi</h3>
            <p className="text-xs text-slate-400 mt-0.5">
              {activeReports.length} laporan yang bisa dimundurkan
            </p>
          </div>
          <Badge variant="secondary" className="text-xs">
            {activeReports.length} Laporan
          </Badge>
        </div>

        {activeReports.length === 0 ? (
          <div className="px-6 py-12 text-center text-slate-400">
            <ShieldCheck size={36} className="mx-auto mb-3 opacity-30" />
            <p className="text-sm font-medium">Tidak ada laporan dalam jalur investigasi</p>
            <p className="text-xs mt-1">Semua laporan telah dimundurkan atau belum ada investigasi aktif.</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {activeReports.map((report) => {
              const statusInfo = INVESTIGATION_STATUS_MAP[report.status] || { label: report.status, color: 'bg-slate-100 text-slate-600' };
              return (
                <div key={report.id} className="px-6 py-4 hover:bg-slate-50 transition-colors">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <span className="text-xs font-mono font-semibold text-slate-500">{report.reportNumber}</span>
                        <Badge variant="outline" className="text-[10px]">{report.kategori}</Badge>
                        <span className={cn('px-2 py-0.5 rounded-full text-[10px] font-semibold', statusInfo.color)}>
                          {statusInfo.label}
                        </span>
                      </div>
                      <p className="text-sm text-slate-700 line-clamp-1">{report.deskripsi}</p>
                      <div className="flex items-center gap-3 mt-1.5 text-xs text-slate-400">
                        <span>Pelapor: <strong className="text-slate-600">{report.pelapor.name}</strong></span>
                        <span>·</span>
                        <span>Tipe: <strong className="text-slate-600">{report.investigasiCategory}</strong></span>
                        <span>·</span>
                        <span>{new Date(report.createdAt).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                      </div>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-1.5 text-amber-700 border-amber-300 hover:bg-amber-50 shrink-0"
                      onClick={() => { setSelectedReport(report); setConfirmOpen(true); }}
                    >
                      <Undo2 size={13} />
                      Mundurkan
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Already reverted */}
      {revertedReports.length > 0 && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100">
            <h3 className="text-sm font-semibold text-emerald-700">✓ Laporan yang Sudah Dimundurkan</h3>
          </div>
          <div className="divide-y divide-slate-100">
            {revertedReports.map((report) => (
              <div key={report.id} className="px-6 py-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono text-slate-400">{report.reportNumber}</span>
                  <span className="text-sm text-slate-600">{report.deskripsi}</span>
                </div>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-100 text-emerald-700">
                  Menunggu Tindakan HSE
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Confirmation Dialog */}
      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Undo2 size={18} className="text-amber-600" />
              Konfirmasi Mundurkan Tahapan
            </DialogTitle>
            <DialogDescription asChild>
              <div className="space-y-3 pt-2">
                <p className="text-sm text-slate-600">
                  Anda akan mengembalikan laporan ini ke tahap <strong>&quot;Menunggu Tindakan HSE&quot;</strong>. Data investigasi yang sudah diisi akan direset.
                </p>
                {selectedReport && (
                  <div className="bg-slate-50 rounded-lg p-3 text-sm space-y-1">
                    <p><span className="text-slate-400">No:</span> <strong>{selectedReport.reportNumber}</strong></p>
                    <p><span className="text-slate-400">Kategori:</span> {selectedReport.kategori}</p>
                    <p><span className="text-slate-400">Status saat ini:</span> {INVESTIGATION_STATUS_MAP[selectedReport.status]?.label}</p>
                  </div>
                )}
                <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-lg p-3">
                  <AlertTriangle size={14} className="text-amber-500 mt-0.5 shrink-0" />
                  <p className="text-xs text-amber-700">Tindakan ini tidak dapat dibatalkan. Petugas HSE harus memilih ulang jenis tindakan.</p>
                </div>
              </div>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setConfirmOpen(false)} disabled={reverting}>
              Batal
            </Button>
            <Button onClick={handleRevert} disabled={reverting} className="bg-amber-600 hover:bg-amber-700 gap-1.5">
              <Undo2 size={14} />
              {reverting ? 'Memproses...' : 'Ya, Mundurkan'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// TAB 4: FORM BUILDER INVESTIGASI
// ═══════════════════════════════════════════════════════════════════════════════
function FormBuilderTab() {
  const [activeCategory, setActiveCategory] = useState('kecelakaan');
  const [formData, setFormData] = useState(JSON.parse(JSON.stringify(INITIAL_FORM_DATA)));
  const [previewOpen, setPreviewOpen] = useState(false);
  const [editingQuestion, setEditingQuestion] = useState(null);

  const questions = formData[activeCategory] || [];

  const addQuestion = () => {
    const newQ = {
      id: `q_${Date.now()}`,
      label: '',
      type: 'short_text',
      required: false,
      options: [],
    };
    setFormData((prev) => ({
      ...prev,
      [activeCategory]: [...prev[activeCategory], newQ],
    }));
    setEditingQuestion(newQ.id);
  };

  const updateQuestion = (qId, updates) => {
    setFormData((prev) => ({
      ...prev,
      [activeCategory]: prev[activeCategory].map((q) =>
        q.id === qId ? { ...q, ...updates } : q
      ),
    }));
  };

  const deleteQuestion = (qId) => {
    setFormData((prev) => ({
      ...prev,
      [activeCategory]: prev[activeCategory].filter((q) => q.id !== qId),
    }));
    if (editingQuestion === qId) setEditingQuestion(null);
  };

  const duplicateQuestion = (q) => {
    const dup = { ...q, id: `q_${Date.now()}`, label: q.label + ' (Copy)' };
    setFormData((prev) => ({
      ...prev,
      [activeCategory]: [...prev[activeCategory], dup],
    }));
  };

  const moveQuestion = (idx, direction) => {
    const newIdx = idx + direction;
    if (newIdx < 0 || newIdx >= questions.length) return;
    setFormData((prev) => {
      const arr = [...prev[activeCategory]];
      [arr[idx], arr[newIdx]] = [arr[newIdx], arr[idx]];
      return { ...prev, [activeCategory]: arr };
    });
  };

  const addOption = (qId) => {
    const q = questions.find((x) => x.id === qId);
    if (!q) return;
    updateQuestion(qId, { options: [...q.options, `Opsi ${q.options.length + 1}`] });
  };

  const updateOption = (qId, optIdx, value) => {
    const q = questions.find((x) => x.id === qId);
    if (!q) return;
    const opts = [...q.options];
    opts[optIdx] = value;
    updateQuestion(qId, { options: opts });
  };

  const removeOption = (qId, optIdx) => {
    const q = questions.find((x) => x.id === qId);
    if (!q) return;
    updateQuestion(qId, { options: q.options.filter((_, i) => i !== optIdx) });
  };

  const getTypeIcon = (type) => {
    const found = QUESTION_TYPES.find((t) => t.key === type);
    return found ? found.icon : Type;
  };

  return (
    <div className="space-y-5 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Info */}
      <div className="flex items-start gap-3 bg-violet-50 border border-violet-200 rounded-xl p-4">
        <ListChecks size={16} className="text-violet-500 mt-0.5 shrink-0" />
        <div className="text-xs text-violet-700 space-y-1">
          <p className="font-semibold">Form Pertanyaan Investigasi</p>
          <p>Buat dan kelola template pertanyaan untuk setiap tipe investigasi. Data disimpan di state lokal (belum ada DB). Pertanyaan ini nantinya akan ditampilkan di form investigasi petugas HSE.</p>
        </div>
      </div>

      {/* Category Switcher */}
      <div className="flex gap-1 p-1 bg-slate-100 rounded-xl w-full sm:w-fit">
        {INVESTIGATION_CATEGORIES.map((cat) => (
          <button
            key={cat.key}
            onClick={() => { setActiveCategory(cat.key); setEditingQuestion(null); }}
            className={cn(
              'flex-1 sm:flex-initial px-4 py-2 text-sm font-semibold rounded-lg transition-all whitespace-nowrap',
              activeCategory === cat.key
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-500 hover:text-slate-700'
            )}
          >
            {cat.label}
            <span className="ml-1.5 text-xs text-slate-400 font-normal">
              ({(formData[cat.key] || []).length})
            </span>
          </button>
        ))}
      </div>

      {/* Questions Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-700">
          Pertanyaan — {INVESTIGATION_CATEGORIES.find((c) => c.key === activeCategory)?.label}
        </h3>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setPreviewOpen(true)}>
            <Eye size={14} />
            Preview
          </Button>
          <Button size="sm" className="gap-1.5" onClick={addQuestion}>
            <Plus size={14} />
            Tambah Pertanyaan
          </Button>
        </div>
      </div>

      {/* Question List */}
      <div className="space-y-3">
        {questions.length === 0 ? (
          <div className="bg-white rounded-2xl border border-dashed border-slate-300 p-10 text-center">
            <ListChecks size={32} className="mx-auto mb-3 text-slate-300" />
            <p className="text-sm font-medium text-slate-500">Belum ada pertanyaan</p>
            <p className="text-xs text-slate-400 mt-1">Klik &quot;Tambah Pertanyaan&quot; untuk mulai membuat form.</p>
          </div>
        ) : (
          questions.map((q, idx) => {
            const TypeIcon = getTypeIcon(q.type);
            const isExpanded = editingQuestion === q.id;
            const needsOptions = q.type === 'multiple_choice' || q.type === 'checkbox';

            return (
              <div
                key={q.id}
                className={cn(
                  'bg-white rounded-xl border transition-all',
                  isExpanded ? 'border-blue-300 shadow-md shadow-blue-100' : 'border-slate-200 shadow-sm hover:shadow'
                )}
              >
                {/* Question Header */}
                <div
                  className="px-4 py-3 flex items-start gap-3 cursor-pointer"
                  onClick={() => setEditingQuestion(isExpanded ? null : q.id)}
                >
                  <div className="flex items-center gap-1 mt-0.5 text-slate-300">
                    <GripVertical size={14} />
                    <span className="text-xs font-bold text-slate-400 w-5">{idx + 1}.</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className={cn('text-sm font-medium', q.label ? 'text-slate-800' : 'text-slate-400 italic')}>
                        {q.label || 'Pertanyaan tanpa judul'}
                      </p>
                      {q.required && (
                        <span className="text-[10px] font-bold text-rose-500">WAJIB</span>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5 mt-1">
                      <TypeIcon size={12} className="text-slate-400" />
                      <span className="text-[11px] text-slate-400 font-medium">
                        {QUESTION_TYPES.find((t) => t.key === q.type)?.label}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={(e) => { e.stopPropagation(); moveQuestion(idx, -1); }}
                      disabled={idx === 0}
                      className="p-1 rounded hover:bg-slate-100 disabled:opacity-30"
                    >
                      <ChevronUp size={14} className="text-slate-400" />
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); moveQuestion(idx, 1); }}
                      disabled={idx === questions.length - 1}
                      className="p-1 rounded hover:bg-slate-100 disabled:opacity-30"
                    >
                      <ChevronDown size={14} className="text-slate-400" />
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); duplicateQuestion(q); }}
                      className="p-1 rounded hover:bg-slate-100"
                      title="Duplikat"
                    >
                      <Copy size={13} className="text-slate-400" />
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); deleteQuestion(q.id); }}
                      className="p-1 rounded hover:bg-rose-50"
                      title="Hapus"
                    >
                      <Trash2 size={13} className="text-rose-400" />
                    </button>
                  </div>
                </div>

                {/* Expanded Editor */}
                {isExpanded && (
                  <div className="px-4 pb-4 pt-1 border-t border-slate-100 space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <label className="text-xs font-medium text-slate-600">Teks Pertanyaan</label>
                        <Input
                          value={q.label}
                          onChange={(e) => updateQuestion(q.id, { label: e.target.value })}
                          placeholder="Tulis pertanyaan di sini..."
                          className="h-10"
                          autoFocus
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-xs font-medium text-slate-600">Tipe Jawaban</label>
                        <Select value={q.type} onValueChange={(v) => updateQuestion(q.id, { type: v })}>
                          <SelectTrigger className="h-10">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {QUESTION_TYPES.map((t) => {
                              const Icon = t.icon;
                              return (
                                <SelectItem key={t.key} value={t.key}>
                                  <div className="flex items-center gap-2">
                                    <Icon size={14} className="text-slate-400" />
                                    {t.label}
                                  </div>
                                </SelectItem>
                              );
                            })}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    {/* Options Editor (for multiple_choice & checkbox) */}
                    {needsOptions && (
                      <div className="space-y-2">
                        <label className="text-xs font-medium text-slate-600">Opsi Jawaban</label>
                        {q.options.map((opt, optIdx) => (
                          <div key={optIdx} className="flex items-center gap-2">
                            <span className="w-5 h-5 rounded-full border-2 border-slate-300 shrink-0 flex items-center justify-center text-[10px] text-slate-400">
                              {q.type === 'checkbox' ? '☐' : String.fromCharCode(65 + optIdx)}
                            </span>
                            <Input
                              value={opt}
                              onChange={(e) => updateOption(q.id, optIdx, e.target.value)}
                              className="h-9 flex-1"
                            />
                            <button onClick={() => removeOption(q.id, optIdx)} className="p-1 rounded hover:bg-rose-50">
                              <X size={14} className="text-rose-400" />
                            </button>
                          </div>
                        ))}
                        <button
                          onClick={() => addOption(q.id)}
                          className="flex items-center gap-1.5 text-xs text-blue-600 hover:text-blue-700 font-medium pl-7"
                        >
                          <Plus size={12} />
                          Tambah opsi
                        </button>
                      </div>
                    )}

                    {/* Required Toggle */}
                    <div className="flex items-center gap-3 pt-1">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <button
                          onClick={() => updateQuestion(q.id, { required: !q.required })}
                          className={cn(
                            'relative inline-flex h-5 w-9 items-center rounded-full transition-colors',
                            q.required ? 'bg-blue-600' : 'bg-slate-200'
                          )}
                        >
                          <span
                            className={cn(
                              'inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform',
                              q.required ? 'translate-x-4' : 'translate-x-1'
                            )}
                          />
                        </button>
                        <span className="text-xs font-medium text-slate-600">Wajib diisi</span>
                      </label>
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Preview Dialog */}
      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Eye size={18} className="text-blue-600" />
              Preview Form — {INVESTIGATION_CATEGORIES.find((c) => c.key === activeCategory)?.label}
            </DialogTitle>
            <DialogDescription>
              Tampilan form investigasi yang akan dilihat petugas HSE.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-5 py-2">
            {questions.length === 0 ? (
              <p className="text-sm text-slate-400 text-center py-8">Belum ada pertanyaan.</p>
            ) : (
              questions.map((q, idx) => (
                <div key={q.id} className="space-y-2">
                  <label className="text-sm font-medium text-slate-800">
                    {idx + 1}. {q.label || 'Pertanyaan tanpa judul'}
                    {q.required && <span className="text-rose-500 ml-1">*</span>}
                  </label>
                  {q.type === 'short_text' && (
                    <Input disabled placeholder="Jawaban singkat..." className="bg-slate-50" />
                  )}
                  {q.type === 'long_text' && (
                    <textarea disabled placeholder="Jawaban panjang..." className="w-full h-20 border border-slate-200 rounded-lg bg-slate-50 px-3 py-2 text-sm resize-none" />
                  )}
                  {q.type === 'number' && (
                    <Input type="number" disabled placeholder="0" className="bg-slate-50 w-32" />
                  )}
                  {q.type === 'yes_no' && (
                    <div className="flex gap-3">
                      {['Ya', 'Tidak'].map((opt) => (
                        <label key={opt} className="flex items-center gap-2 text-sm text-slate-600 cursor-pointer">
                          <span className="w-4 h-4 rounded-full border-2 border-slate-300" />
                          {opt}
                        </label>
                      ))}
                    </div>
                  )}
                  {q.type === 'multiple_choice' && (
                    <div className="space-y-2">
                      {q.options.map((opt, i) => (
                        <label key={i} className="flex items-center gap-2 text-sm text-slate-600">
                          <span className="w-4 h-4 rounded-full border-2 border-slate-300 shrink-0" />
                          {opt}
                        </label>
                      ))}
                    </div>
                  )}
                  {q.type === 'checkbox' && (
                    <div className="space-y-2">
                      {q.options.map((opt, i) => (
                        <label key={i} className="flex items-center gap-2 text-sm text-slate-600">
                          <span className="w-4 h-4 rounded border-2 border-slate-300 shrink-0" />
                          {opt}
                        </label>
                      ))}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN PAGE
// ═══════════════════════════════════════════════════════════════════════════════
export default function AdminK3Page() {
  const [activeTab, setActiveTab] = useState('settings');
  const [settings, setSettings] = useState(null);

  const fetchSettings = useCallback(async () => {
    try {
      const res = await apiGet('/k3-settings');
      setSettings(res.data);
    } catch (error) {
      console.error('Failed to load settings', error);
      toast.error('Gagal memuat pengaturan K3');
    }
  }, []);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  return (
    <div className="p-4 sm:p-6 md:p-8 max-w-5xl mx-auto space-y-6">
      {/* Page Header */}
      <div className="flex items-start sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2.5 mb-1">
            <div className="p-1.5 sm:p-2 bg-slate-800 rounded-lg sm:rounded-xl shadow-lg">
              <ShieldCheck size={18} className="text-white sm:w-5 sm:h-5" />
            </div>
            <h2 className="text-lg sm:text-2xl font-bold text-slate-900 tracking-tight">
              Admin K3
            </h2>
          </div>
          <p className="text-slate-500 text-xs sm:text-sm ml-9 sm:ml-12 hidden sm:block">
            Konfigurasi parameter K3, kelola tahapan laporan, dan buat template form investigasi.
          </p>
        </div>
      </div>

      {/* Tab Switcher */}
      <div className="flex gap-1 p-1 bg-slate-100 rounded-xl sm:rounded-2xl w-full overflow-x-auto">
        {TABS.map((t) => {
          const Icon = t.icon;
          const isActive = activeTab === t.key;
          return (
            <button
              key={t.key}
              onClick={() => setActiveTab(t.key)}
              className={cn(
                'flex items-center justify-center gap-1.5 sm:gap-2 flex-1 px-2.5 sm:px-5 py-2 sm:py-2.5 text-[11px] sm:text-sm font-semibold transition-all rounded-lg sm:rounded-xl whitespace-nowrap',
                isActive
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-500 hover:text-slate-700'
              )}
            >
              <Icon
                size={14}
                className={cn('sm:w-4 sm:h-4', isActive ? 'text-slate-800' : 'text-slate-400')}
              />
              <span className="hidden sm:inline">{t.label}</span>
              <span className="sm:hidden">{t.label.split(' ')[0]}</span>
            </button>
          );
        })}
      </div>

      {/* Tab Content */}
      {activeTab === 'settings' && <SettingsTab settings={settings} fetchSettings={fetchSettings} />}
      {activeTab === 'jam-aman' && <SafeHoursTab settings={settings} fetchSettings={fetchSettings} />}
      {activeTab === 'revert' && <RevertStepTab />}
      {activeTab === 'form-builder' && <FormBuilderTab />}
    </div>
  );
}
