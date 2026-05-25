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
  Sliders,
  Calendar as CalendarIcon,
  Clock as ClockIcon,
  Upload,
  LayoutList,
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
// QUESTION TYPE CONFIG (enhanced — Google Forms parity)
// ═══════════════════════════════════════════════════════════════════════════════
const QUESTION_TYPES = [
  { key: 'short_text', label: 'Jawaban Singkat', icon: Type, group: 'text' },
  { key: 'long_text', label: 'Jawaban Panjang', icon: AlignLeft, group: 'text' },
  { key: 'number', label: 'Angka', icon: Hash, group: 'text' },
  { key: 'multiple_choice', label: 'Pilihan Ganda', icon: CircleDot, group: 'choice' },
  { key: 'checkbox', label: 'Kotak Centang', icon: CheckSquare, group: 'choice' },
  { key: 'dropdown', label: 'Dropdown', icon: ChevronDown, group: 'choice' },
  { key: 'yes_no', label: 'Ya / Tidak', icon: ToggleLeft, group: 'choice' },
  { key: 'linear_scale', label: 'Skala Linier', icon: Sliders, group: 'special' },
  { key: 'date', label: 'Tanggal', icon: CalendarIcon, group: 'special' },
  { key: 'time', label: 'Waktu', icon: ClockIcon, group: 'special' },
  { key: 'file_upload', label: 'Upload File', icon: Upload, group: 'special' },
  { key: 'section', label: '── Pemisah Bagian ──', icon: LayoutList, group: 'layout' },
];

const QUESTION_TYPE_GROUPS = [
  { key: 'text', label: 'Teks' },
  { key: 'choice', label: 'Pilihan' },
  { key: 'special', label: 'Spesial' },
  { key: 'layout', label: 'Tata Letak' },
];

const INVESTIGATION_CATEGORIES = [
  { key: 'kecelakaan', label: 'Kecelakaan', color: 'bg-rose-500' },
  { key: 'penyakit_kerja', label: 'Penyakit Akibat Kerja', color: 'bg-amber-500' },
  { key: 'kebakaran', label: 'Kebakaran', color: 'bg-orange-500' },
];

// Pre-populated dummy questions (enhanced with descriptions & sections)
const INITIAL_FORM_DATA = {
  kecelakaan: {
    title: 'Form Investigasi Kecelakaan',
    description: 'Form ini digunakan untuk melengkapi data investigasi insiden kecelakaan kerja. Isi semua pertanyaan dengan lengkap dan akurat.',
    questions: [
      { id: 'sec1', type: 'section', label: 'Informasi Kejadian', description: 'Detail kronologi dan jenis kecelakaan yang terjadi.', required: false, options: [], config: {} },
      { id: 'q1', label: 'Apa jenis kecelakaan yang terjadi?', description: 'Pilih salah satu jenis yang paling sesuai', type: 'multiple_choice', required: true, options: ['Terjatuh', 'Tertimpa', 'Terjepit', 'Tertabrak', 'Terpotong'], config: { allowOther: true } },
      { id: 'q2', label: 'Jelaskan kronologi kejadian secara singkat', description: '', type: 'long_text', required: true, options: [], config: {} },
      { id: 'q3', label: 'Tanggal kejadian', description: '', type: 'date', required: true, options: [], config: {} },
      { id: 'q4', label: 'Waktu kejadian', description: '', type: 'time', required: true, options: [], config: {} },
      { id: 'sec2', type: 'section', label: 'Data Korban & APD', description: 'Informasi mengenai korban dan alat pelindung diri.', required: false, options: [], config: {} },
      { id: 'q5', label: 'Jumlah korban', description: '', type: 'number', required: true, options: [], config: { min: 0, max: 100 } },
      { id: 'q6', label: 'Apakah korban menggunakan APD saat kejadian?', description: '', type: 'yes_no', required: true, options: [], config: {} },
      { id: 'q7', label: 'APD yang digunakan saat kejadian', description: 'Centang semua yang digunakan', type: 'checkbox', required: false, options: ['Helm', 'Sepatu Safety', 'Sarung Tangan', 'Kacamata', 'Rompi', 'Ear Plug', 'Masker'], config: { allowOther: true } },
      { id: 'q8', label: 'Tingkat keparahan', description: '', type: 'linear_scale', required: true, options: [], config: { scaleMin: 1, scaleMax: 5, labelMin: 'Ringan', labelMax: 'Sangat Berat' } },
      { id: 'sec3', type: 'section', label: 'Dokumentasi', description: 'Lampirkan foto dan dokumen pendukung.', required: false, options: [], config: {} },
      { id: 'q9', label: 'Upload foto lokasi kejadian', description: 'Foto kondisi lokasi saat dan sesudah kejadian', type: 'file_upload', required: false, options: [], config: { accept: 'image/*', maxFiles: 5 } },
    ],
  },
  penyakit_kerja: {
    title: 'Form Investigasi Penyakit Akibat Kerja',
    description: 'Form ini digunakan untuk investigasi kasus penyakit yang disebabkan oleh kondisi kerja.',
    questions: [
      { id: 'q1', label: 'Jenis penyakit yang didiagnosis', description: '', type: 'short_text', required: true, options: [], config: {} },
      { id: 'q2', label: 'Berapa lama pekerja terpapar bahan/kondisi berbahaya?', description: '', type: 'short_text', required: true, options: [], config: {} },
      { id: 'q3', label: 'Apakah pekerja pernah menjalani medical check-up sebelumnya?', description: '', type: 'yes_no', required: true, options: [], config: {} },
      { id: 'q4', label: 'Faktor penyebab utama', description: '', type: 'multiple_choice', required: true, options: ['Bahan Kimia', 'Debu', 'Kebisingan', 'Ergonomi', 'Radiasi'], config: { allowOther: true } },
      { id: 'q5', label: 'Tingkat urgensi penanganan', description: '', type: 'dropdown', required: true, options: ['Sangat Mendesak', 'Mendesak', 'Sedang', 'Rendah'], config: {} },
      { id: 'q6', label: 'Tanggal diagnosis', description: '', type: 'date', required: true, options: [], config: {} },
      { id: 'q7', label: 'Dokumen medis pendukung', description: 'Upload surat keterangan dokter atau hasil lab', type: 'file_upload', required: false, options: [], config: { accept: '.pdf,.doc,.docx,.jpg,.png', maxFiles: 3 } },
    ],
  },
  kebakaran: {
    title: 'Form Investigasi Kebakaran',
    description: 'Form ini digunakan untuk investigasi insiden kebakaran di area kerja.',
    questions: [
      { id: 'q1', label: 'Lokasi titik api pertama kali terdeteksi', description: 'Sebutkan area, gedung, atau lantai', type: 'short_text', required: true, options: [], config: {} },
      { id: 'q2', label: 'Sumber api / penyebab kebakaran', description: '', type: 'multiple_choice', required: true, options: ['Korsleting Listrik', 'Bahan Kimia', 'Gesekan Mekanis', 'Rokok/Api Terbuka'], config: { allowOther: true } },
      { id: 'q3', label: 'Apakah sistem APAR/sprinkler berfungsi saat kejadian?', description: '', type: 'yes_no', required: true, options: [], config: {} },
      { id: 'q4', label: 'Klasifikasi kelas kebakaran', description: '', type: 'dropdown', required: true, options: ['Kelas A (Padat)', 'Kelas B (Cair)', 'Kelas C (Gas)', 'Kelas D (Logam)', 'Kelas K (Minyak Goreng)'], config: {} },
      { id: 'q5', label: 'Estimasi kerugian material (Rp)', description: '', type: 'number', required: false, options: [], config: { min: 0 } },
      { id: 'q6', label: 'Kronologi detail kebakaran', description: '', type: 'long_text', required: true, options: [], config: {} },
      { id: 'q7', label: 'Skala kerusakan', description: '', type: 'linear_scale', required: true, options: [], config: { scaleMin: 1, scaleMax: 10, labelMin: 'Minimal', labelMax: 'Total' } },
      { id: 'q8', label: 'Tanggal kejadian', description: '', type: 'date', required: true, options: [], config: {} },
      { id: 'q9', label: 'Upload foto sebelum & sesudah', description: '', type: 'file_upload', required: false, options: [], config: { accept: 'image/*', maxFiles: 10 } },
    ],
  },
};

// ═══════════════════════════════════════════════════════════════════════════════
// TAB 4: FORM BUILDER INVESTIGASI (Enhanced — Google Forms style)
// ═══════════════════════════════════════════════════════════════════════════════
function FormBuilderTab() {
  const [activeCategory, setActiveCategory] = useState('kecelakaan');
  const [formData, setFormData] = useState(JSON.parse(JSON.stringify(INITIAL_FORM_DATA)));
  const [previewOpen, setPreviewOpen] = useState(false);
  const [editingQuestion, setEditingQuestion] = useState(null);
  const [addMenuOpen, setAddMenuOpen] = useState(false);

  const currentForm = formData[activeCategory] || { title: '', description: '', questions: [] };
  const questions = currentForm.questions || [];

  // ── Form Header Helpers ────────────────────────────────────────────────────
  const updateFormHeader = (field, value) => {
    setFormData((prev) => ({
      ...prev,
      [activeCategory]: { ...prev[activeCategory], [field]: value },
    }));
  };

  // ── Question CRUD ──────────────────────────────────────────────────────────
  const addQuestion = (type = 'short_text') => {
    const isSection = type === 'section';
    const newQ = {
      id: `q_${Date.now()}`,
      label: isSection ? 'Bagian Baru' : '',
      description: '',
      type,
      required: false,
      options: ['multiple_choice', 'checkbox', 'dropdown'].includes(type) ? ['Opsi 1'] : [],
      config: type === 'linear_scale'
        ? { scaleMin: 1, scaleMax: 5, labelMin: '', labelMax: '' }
        : type === 'number'
        ? { min: undefined, max: undefined }
        : type === 'file_upload'
        ? { accept: 'image/*', maxFiles: 5 }
        : {},
    };
    setFormData((prev) => ({
      ...prev,
      [activeCategory]: {
        ...prev[activeCategory],
        questions: [...prev[activeCategory].questions, newQ],
      },
    }));
    setEditingQuestion(newQ.id);
    setAddMenuOpen(false);
  };

  const updateQuestion = (qId, updates) => {
    setFormData((prev) => ({
      ...prev,
      [activeCategory]: {
        ...prev[activeCategory],
        questions: prev[activeCategory].questions.map((q) =>
          q.id === qId ? { ...q, ...updates } : q
        ),
      },
    }));
  };

  const updateConfig = (qId, cfgUpdates) => {
    const q = questions.find((x) => x.id === qId);
    if (!q) return;
    updateQuestion(qId, { config: { ...(q.config || {}), ...cfgUpdates } });
  };

  const deleteQuestion = (qId) => {
    setFormData((prev) => ({
      ...prev,
      [activeCategory]: {
        ...prev[activeCategory],
        questions: prev[activeCategory].questions.filter((q) => q.id !== qId),
      },
    }));
    if (editingQuestion === qId) setEditingQuestion(null);
  };

  const duplicateQuestion = (q) => {
    const dup = {
      ...JSON.parse(JSON.stringify(q)),
      id: `q_${Date.now()}`,
      label: q.label + ' (Copy)',
    };
    setFormData((prev) => ({
      ...prev,
      [activeCategory]: {
        ...prev[activeCategory],
        questions: [...prev[activeCategory].questions, dup],
      },
    }));
  };

  const moveQuestion = (idx, direction) => {
    const newIdx = idx + direction;
    if (newIdx < 0 || newIdx >= questions.length) return;
    setFormData((prev) => {
      const arr = [...prev[activeCategory].questions];
      [arr[idx], arr[newIdx]] = [arr[newIdx], arr[idx]];
      return { ...prev, [activeCategory]: { ...prev[activeCategory], questions: arr } };
    });
  };

  // ── Option helpers ─────────────────────────────────────────────────────────
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

  const getTypeInfo = (type) => QUESTION_TYPES.find((t) => t.key === type) || QUESTION_TYPES[0];
  const needsOptions = (type) => ['multiple_choice', 'checkbox', 'dropdown'].includes(type);
  const catInfo = INVESTIGATION_CATEGORIES.find((c) => c.key === activeCategory);
  const questionCount = questions.filter((q) => q.type !== 'section').length;
  const sectionCount = questions.filter((q) => q.type === 'section').length;

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-5 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Info Banner */}
      <div className="flex items-start gap-3 bg-violet-50 border border-violet-200 rounded-xl p-4">
        <ListChecks size={16} className="text-violet-500 mt-0.5 shrink-0" />
        <div className="text-xs text-violet-700 space-y-1">
          <p className="font-semibold">Form Pertanyaan Investigasi</p>
          <p>Buat dan kelola template pertanyaan seperti Google Form untuk setiap kategori investigasi. Tersedia berbagai tipe pertanyaan: teks, pilihan ganda, skala, upload file, dan lainnya.</p>
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
              ({(formData[cat.key]?.questions || []).filter((q) => q.type !== 'section').length})
            </span>
          </button>
        ))}
      </div>

      {/* ── Form Header (editable title & description) ── */}
      <div className={cn('rounded-2xl overflow-hidden border shadow-sm', 'border-slate-200')}>
        <div className={cn('h-2', catInfo?.color || 'bg-violet-500')} />
        <div className="bg-white p-5 sm:p-6 space-y-3">
          <input
            type="text"
            value={currentForm.title}
            onChange={(e) => updateFormHeader('title', e.target.value)}
            placeholder="Judul Form"
            className="w-full text-xl sm:text-2xl font-bold text-slate-900 placeholder:text-slate-300 border-0 border-b-2 border-transparent focus:border-blue-500 outline-none pb-1.5 transition-colors bg-transparent"
          />
          <textarea
            value={currentForm.description}
            onChange={(e) => updateFormHeader('description', e.target.value)}
            placeholder="Deskripsi form (opsional)"
            rows={2}
            className="w-full text-sm text-slate-600 placeholder:text-slate-300 border-0 border-b border-transparent focus:border-blue-400 outline-none resize-none transition-colors bg-transparent"
          />
          <div className="flex items-center gap-4 text-xs text-slate-400 pt-1">
            <span>{questionCount} pertanyaan</span>
            {sectionCount > 0 && <span>{sectionCount} bagian</span>}
          </div>
        </div>
      </div>

      {/* Questions Header & Actions */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-700">
          Pertanyaan — {catInfo?.label}
        </h3>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setPreviewOpen(true)}>
            <Eye size={14} />
            Preview
          </Button>
          {/* Add Question Dropdown */}
          <div className="relative">
            <Button size="sm" className="gap-1.5" onClick={() => setAddMenuOpen(!addMenuOpen)}>
              <Plus size={14} />
              Tambah
              <ChevronDown size={12} />
            </Button>
            {addMenuOpen && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setAddMenuOpen(false)} />
                <div className="absolute right-0 top-full mt-1 z-50 w-64 bg-white rounded-xl border border-slate-200 shadow-xl py-1 max-h-80 overflow-y-auto">
                  {QUESTION_TYPE_GROUPS.map((group) => {
                    const items = QUESTION_TYPES.filter((t) => t.group === group.key);
                    if (items.length === 0) return null;
                    return (
                      <div key={group.key}>
                        <div className="px-3 py-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                          {group.label}
                        </div>
                        {items.map((t) => {
                          const Icon = t.icon;
                          return (
                            <button
                              key={t.key}
                              onClick={() => addQuestion(t.key)}
                              className={cn(
                                'w-full text-left px-3 py-2 flex items-center gap-2.5 text-sm hover:bg-slate-50 transition-colors',
                                t.key === 'section' && 'text-violet-700 font-medium'
                              )}
                            >
                              <Icon size={15} className={t.key === 'section' ? 'text-violet-500' : 'text-slate-400'} />
                              {t.label}
                            </button>
                          );
                        })}
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Question List */}
      <div className="space-y-3">
        {questions.length === 0 ? (
          <div className="bg-white rounded-2xl border border-dashed border-slate-300 p-10 text-center">
            <ListChecks size={32} className="mx-auto mb-3 text-slate-300" />
            <p className="text-sm font-medium text-slate-500">Belum ada pertanyaan</p>
            <p className="text-xs text-slate-400 mt-1">Klik &quot;Tambah&quot; untuk mulai membuat form.</p>
          </div>
        ) : (
          questions.map((q, idx) => {
            const typeInfo = getTypeInfo(q.type);
            const TypeIcon = typeInfo.icon;
            const isExpanded = editingQuestion === q.id;
            const isSection = q.type === 'section';

            // ── Section Separator Card ──
            if (isSection) {
              return (
                <div
                  key={q.id}
                  className={cn(
                    'rounded-xl overflow-hidden border transition-all',
                    isExpanded ? 'border-violet-300 shadow-md shadow-violet-100' : 'border-slate-200 shadow-sm'
                  )}
                >
                  <div className={cn('h-1.5', catInfo?.color || 'bg-violet-500')} />
                  <div
                    className="bg-white px-5 py-4 cursor-pointer"
                    onClick={() => setEditingQuestion(isExpanded ? null : q.id)}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        {isExpanded ? (
                          <div className="space-y-2">
                            <input
                              type="text"
                              value={q.label}
                              onChange={(e) => updateQuestion(q.id, { label: e.target.value })}
                              placeholder="Judul bagian"
                              className="w-full text-base font-semibold text-slate-900 placeholder:text-slate-300 border-0 border-b-2 border-violet-300 outline-none pb-1 bg-transparent"
                              onClick={(e) => e.stopPropagation()}
                            />
                            <input
                              type="text"
                              value={q.description}
                              onChange={(e) => updateQuestion(q.id, { description: e.target.value })}
                              placeholder="Deskripsi bagian (opsional)"
                              className="w-full text-sm text-slate-500 placeholder:text-slate-300 border-0 border-b border-slate-200 outline-none pb-1 bg-transparent"
                              onClick={(e) => e.stopPropagation()}
                            />
                          </div>
                        ) : (
                          <>
                            <p className="text-base font-semibold text-slate-900">{q.label || 'Bagian tanpa judul'}</p>
                            {q.description && <p className="text-sm text-slate-500 mt-0.5">{q.description}</p>}
                          </>
                        )}
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <button onClick={(e) => { e.stopPropagation(); moveQuestion(idx, -1); }} disabled={idx === 0} className="p-1 rounded hover:bg-slate-100 disabled:opacity-30"><ChevronUp size={14} className="text-slate-400" /></button>
                        <button onClick={(e) => { e.stopPropagation(); moveQuestion(idx, 1); }} disabled={idx === questions.length - 1} className="p-1 rounded hover:bg-slate-100 disabled:opacity-30"><ChevronDown size={14} className="text-slate-400" /></button>
                        <button onClick={(e) => { e.stopPropagation(); deleteQuestion(q.id); }} className="p-1 rounded hover:bg-rose-50" title="Hapus"><Trash2 size={13} className="text-rose-400" /></button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            }

            // ── Regular Question Card ──
            return (
              <div
                key={q.id}
                className={cn(
                  'bg-white rounded-xl border transition-all',
                  isExpanded ? 'border-blue-300 shadow-md shadow-blue-100' : 'border-slate-200 shadow-sm hover:shadow'
                )}
              >
                {/* Question Header (collapsed view) */}
                <div
                  className="px-4 py-3 flex items-start gap-3 cursor-pointer"
                  onClick={() => setEditingQuestion(isExpanded ? null : q.id)}
                >
                  <div className="flex items-center gap-1 mt-0.5 text-slate-300">
                    <GripVertical size={14} />
                    <span className="text-xs font-bold text-slate-400 w-5">
                      {questions.filter((x, i) => i <= idx && x.type !== 'section').length}.
                    </span>
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
                    {q.description && !isExpanded && (
                      <p className="text-xs text-slate-400 mt-0.5 line-clamp-1">{q.description}</p>
                    )}
                    <div className="flex items-center gap-1.5 mt-1">
                      <TypeIcon size={12} className="text-slate-400" />
                      <span className="text-[11px] text-slate-400 font-medium">
                        {typeInfo.label}
                      </span>
                      {needsOptions(q.type) && q.options.length > 0 && (
                        <span className="text-[11px] text-slate-300">· {q.options.length} opsi</span>
                      )}
                      {q.config?.allowOther && (
                        <span className="text-[10px] bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded font-medium">+ Lainnya</span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button onClick={(e) => { e.stopPropagation(); moveQuestion(idx, -1); }} disabled={idx === 0} className="p-1 rounded hover:bg-slate-100 disabled:opacity-30"><ChevronUp size={14} className="text-slate-400" /></button>
                    <button onClick={(e) => { e.stopPropagation(); moveQuestion(idx, 1); }} disabled={idx === questions.length - 1} className="p-1 rounded hover:bg-slate-100 disabled:opacity-30"><ChevronDown size={14} className="text-slate-400" /></button>
                    <button onClick={(e) => { e.stopPropagation(); duplicateQuestion(q); }} className="p-1 rounded hover:bg-slate-100" title="Duplikat"><Copy size={13} className="text-slate-400" /></button>
                    <button onClick={(e) => { e.stopPropagation(); deleteQuestion(q.id); }} className="p-1 rounded hover:bg-rose-50" title="Hapus"><Trash2 size={13} className="text-rose-400" /></button>
                  </div>
                </div>

                {/* Expanded Editor */}
                {isExpanded && (
                  <div className="px-4 pb-4 pt-1 border-t border-slate-100 space-y-4">
                    {/* Question text + Description */}
                    <div className="space-y-3">
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
                        <label className="text-xs font-medium text-slate-600 flex items-center gap-1">
                          <HelpCircle size={11} className="text-slate-400" />
                          Deskripsi / Petunjuk
                          <span className="text-slate-300 font-normal">(opsional)</span>
                        </label>
                        <Input
                          value={q.description || ''}
                          onChange={(e) => updateQuestion(q.id, { description: e.target.value })}
                          placeholder="Tambahkan deskripsi atau petunjuk pengisian..."
                          className="h-9 text-sm"
                        />
                      </div>
                    </div>

                    {/* Type selector */}
                    <div className="space-y-1.5">
                      <label className="text-xs font-medium text-slate-600">Tipe Jawaban</label>
                      <Select value={q.type} onValueChange={(v) => {
                        const updates = { type: v };
                        // Reset options if switching to a non-option type
                        if (!needsOptions(v) && needsOptions(q.type)) {
                          updates.options = [];
                        }
                        // Add default options if switching to an option type from non-option
                        if (needsOptions(v) && !needsOptions(q.type)) {
                          updates.options = ['Opsi 1', 'Opsi 2'];
                        }
                        // Set default config for special types
                        if (v === 'linear_scale' && q.type !== 'linear_scale') {
                          updates.config = { scaleMin: 1, scaleMax: 5, labelMin: '', labelMax: '' };
                        }
                        if (v === 'number' && q.type !== 'number') {
                          updates.config = { min: undefined, max: undefined };
                        }
                        if (v === 'file_upload' && q.type !== 'file_upload') {
                          updates.config = { accept: 'image/*', maxFiles: 5, maxSizeKB: 500 };
                        }
                        updateQuestion(q.id, updates);
                      }}>
                        <SelectTrigger className="h-10">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {QUESTION_TYPE_GROUPS.filter((g) => g.key !== 'layout').map((group) => {
                            const items = QUESTION_TYPES.filter((t) => t.group === group.key);
                            return items.map((t) => {
                              const Icon = t.icon;
                              return (
                                <SelectItem key={t.key} value={t.key}>
                                  <div className="flex items-center gap-2">
                                    <Icon size={14} className="text-slate-400" />
                                    {t.label}
                                  </div>
                                </SelectItem>
                              );
                            });
                          })}
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Options Editor (for multiple_choice, checkbox, dropdown) */}
                    {needsOptions(q.type) && (
                      <div className="space-y-2">
                        <label className="text-xs font-medium text-slate-600">Opsi Jawaban</label>
                        {q.options.map((opt, optIdx) => (
                          <div key={optIdx} className="flex items-center gap-2">
                            <span className="w-5 h-5 rounded-full border-2 border-slate-300 shrink-0 flex items-center justify-center text-[10px] text-slate-400">
                              {q.type === 'checkbox' ? '☐' : q.type === 'dropdown' ? '▾' : String.fromCharCode(65 + optIdx)}
                            </span>
                            <Input
                              value={opt}
                              onChange={(e) => updateOption(q.id, optIdx, e.target.value)}
                              className="h-9 flex-1"
                            />
                            <button onClick={() => removeOption(q.id, optIdx)} className="p-1 rounded hover:bg-rose-50" disabled={q.options.length <= 1}>
                              <X size={14} className={q.options.length <= 1 ? 'text-slate-200' : 'text-rose-400'} />
                            </button>
                          </div>
                        ))}
                        {/* "Lainnya" option toggle */}
                        {q.config?.allowOther && (
                          <div className="flex items-center gap-2 opacity-60">
                            <span className="w-5 h-5 rounded-full border-2 border-dashed border-slate-300 shrink-0 flex items-center justify-center text-[10px] text-slate-400">
                              {q.type === 'checkbox' ? '☐' : '○'}
                            </span>
                            <span className="text-sm text-slate-400 italic">Lainnya...</span>
                          </div>
                        )}
                        <div className="flex items-center gap-4 pl-7">
                          <button
                            onClick={() => addOption(q.id)}
                            className="flex items-center gap-1.5 text-xs text-blue-600 hover:text-blue-700 font-medium"
                          >
                            <Plus size={12} />
                            Tambah opsi
                          </button>
                          <span className="text-slate-200">|</span>
                          <label className="flex items-center gap-1.5 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={q.config?.allowOther || false}
                              onChange={(e) => updateConfig(q.id, { allowOther: e.target.checked })}
                              className="w-3.5 h-3.5 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                            />
                            <span className="text-xs text-slate-500">Tambah &quot;Lainnya&quot;</span>
                          </label>
                        </div>
                      </div>
                    )}

                    {/* Linear Scale Config */}
                    {q.type === 'linear_scale' && (
                      <div className="space-y-3 bg-slate-50 rounded-lg p-3">
                        <label className="text-xs font-medium text-slate-600">Pengaturan Skala</label>
                        <div className="grid grid-cols-2 gap-3">
                          <div className="space-y-1">
                            <label className="text-[11px] text-slate-500">Mulai dari</label>
                            <Select value={String(q.config?.scaleMin || 0)} onValueChange={(v) => updateConfig(q.id, { scaleMin: parseInt(v) })}>
                              <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                              <SelectContent>
                                {[0, 1].map((n) => <SelectItem key={n} value={String(n)}>{n}</SelectItem>)}
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-1">
                            <label className="text-[11px] text-slate-500">Sampai</label>
                            <Select value={String(q.config?.scaleMax || 5)} onValueChange={(v) => updateConfig(q.id, { scaleMax: parseInt(v) })}>
                              <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                              <SelectContent>
                                {[2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => <SelectItem key={n} value={String(n)}>{n}</SelectItem>)}
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <div className="space-y-1">
                            <label className="text-[11px] text-slate-500">Label nilai terendah</label>
                            <Input
                              value={q.config?.labelMin || ''}
                              onChange={(e) => updateConfig(q.id, { labelMin: e.target.value })}
                              placeholder="mis. Sangat Buruk"
                              className="h-9 text-sm"
                            />
                          </div>
                          <div className="space-y-1">
                            <label className="text-[11px] text-slate-500">Label nilai tertinggi</label>
                            <Input
                              value={q.config?.labelMax || ''}
                              onChange={(e) => updateConfig(q.id, { labelMax: e.target.value })}
                              placeholder="mis. Sangat Baik"
                              className="h-9 text-sm"
                            />
                          </div>
                        </div>
                        {/* Scale Preview */}
                        <div className="pt-2">
                          <div className="flex items-center justify-between text-[10px] text-slate-400 mb-1">
                            <span>{q.config?.labelMin || ''}</span>
                            <span>{q.config?.labelMax || ''}</span>
                          </div>
                          <div className="flex items-center justify-center gap-2">
                            {Array.from({ length: (q.config?.scaleMax || 5) - (q.config?.scaleMin || 1) + 1 }, (_, i) => (q.config?.scaleMin || 1) + i).map((n) => (
                              <div key={n} className="flex flex-col items-center gap-1">
                                <span className="w-7 h-7 rounded-full border-2 border-slate-300 flex items-center justify-center text-xs text-slate-500">{n}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Number validation */}
                    {q.type === 'number' && (
                      <div className="space-y-2 bg-slate-50 rounded-lg p-3">
                        <label className="text-xs font-medium text-slate-600">Validasi Angka</label>
                        <div className="grid grid-cols-2 gap-3">
                          <div className="space-y-1">
                            <label className="text-[11px] text-slate-500">Minimum</label>
                            <Input
                              type="number"
                              value={q.config?.min ?? ''}
                              onChange={(e) => updateConfig(q.id, { min: e.target.value === '' ? undefined : Number(e.target.value) })}
                              placeholder="tanpa batas"
                              className="h-9 text-sm"
                            />
                          </div>
                          <div className="space-y-1">
                            <label className="text-[11px] text-slate-500">Maksimum</label>
                            <Input
                              type="number"
                              value={q.config?.max ?? ''}
                              onChange={(e) => updateConfig(q.id, { max: e.target.value === '' ? undefined : Number(e.target.value) })}
                              placeholder="tanpa batas"
                              className="h-9 text-sm"
                            />
                          </div>
                        </div>
                      </div>
                    )}

                    {/* File Upload Config */}
                    {q.type === 'file_upload' && (
                      <div className="space-y-2 bg-slate-50 rounded-lg p-3">
                        <label className="text-xs font-medium text-slate-600">Pengaturan Upload</label>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                          <div className="space-y-1">
                            <label className="text-[11px] text-slate-500">Tipe file</label>
                            <Select value={q.config?.accept || 'image/*'} onValueChange={(v) => updateConfig(q.id, { accept: v })}>
                              <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="image/*">Gambar saja</SelectItem>
                                <SelectItem value=".pdf,.doc,.docx">Dokumen saja</SelectItem>
                                <SelectItem value="image/*,.pdf,.doc,.docx">Gambar & Dokumen</SelectItem>
                                <SelectItem value="*">Semua tipe file</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-1">
                            <label className="text-[11px] text-slate-500">Maks. jumlah file</label>
                            <Select value={String(q.config?.maxFiles || 5)} onValueChange={(v) => updateConfig(q.id, { maxFiles: parseInt(v) })}>
                              <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                              <SelectContent>
                                {[1, 2, 3, 5, 10].map((n) => <SelectItem key={n} value={String(n)}>{n} file</SelectItem>)}
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-1">
                            <label className="text-[11px] text-slate-500">Ukuran maks (KB)</label>
                            <Input
                              type="number"
                              value={q.config?.maxSizeKB ?? 500}
                              onChange={(e) => updateConfig(q.id, { maxSizeKB: e.target.value === '' ? undefined : Number(e.target.value) })}
                              className="h-9 text-sm"
                            />
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Bottom bar: Required toggle */}
                    <div className="flex items-center justify-between pt-2 border-t border-slate-100">
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

      {/* Quick Add Floating Button */}
      {questions.length > 0 && (
        <div className="flex justify-center">
          <Button variant="outline" onClick={() => addQuestion('short_text')} className="gap-1.5 rounded-full shadow-sm">
            <Plus size={14} />
            Tambah Pertanyaan
          </Button>
        </div>
      )}

      {/* ── Preview Dialog ── */}
      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Eye size={18} className="text-blue-600" />
              Preview Form
            </DialogTitle>
            <DialogDescription>
              Tampilan form investigasi yang akan dilihat petugas HSE di aplikasi.
            </DialogDescription>
          </DialogHeader>

          {/* Preview: Form Header */}
          <div className="rounded-xl overflow-hidden border border-slate-200 mt-2">
            <div className={cn('h-2', catInfo?.color || 'bg-violet-500')} />
            <div className="p-5 bg-white">
              <h2 className="text-lg font-bold text-slate-900">{currentForm.title || 'Tanpa Judul'}</h2>
              {currentForm.description && (
                <p className="text-sm text-slate-500 mt-1">{currentForm.description}</p>
              )}
              <p className="text-xs text-rose-500 mt-3">* Menandakan pertanyaan wajib</p>
            </div>
          </div>

          {/* Preview: Questions */}
          <div className="space-y-3 py-2">
            {questions.length === 0 ? (
              <p className="text-sm text-slate-400 text-center py-8">Belum ada pertanyaan.</p>
            ) : (
              questions.map((q, idx) => {
                // Section break
                if (q.type === 'section') {
                  return (
                    <div key={q.id} className="rounded-xl overflow-hidden border border-slate-200">
                      <div className={cn('h-1.5', catInfo?.color || 'bg-violet-500')} />
                      <div className="p-4 bg-white">
                        <h3 className="text-base font-semibold text-slate-900">{q.label}</h3>
                        {q.description && <p className="text-sm text-slate-500 mt-0.5">{q.description}</p>}
                      </div>
                    </div>
                  );
                }

                const qNum = questions.filter((x, i) => i <= idx && x.type !== 'section').length;

                return (
                  <div key={q.id} className="bg-white rounded-xl border border-slate-200 p-4 space-y-3">
                    <div>
                      <label className="text-sm font-medium text-slate-800">
                        {qNum}. {q.label || 'Pertanyaan tanpa judul'}
                        {q.required && <span className="text-rose-500 ml-1">*</span>}
                      </label>
                      {q.description && (
                        <p className="text-xs text-slate-400 mt-0.5">{q.description}</p>
                      )}
                    </div>

                    {/* Render by type */}
                    {q.type === 'short_text' && (
                      <Input disabled placeholder="Jawaban singkat..." className="bg-slate-50" />
                    )}
                    {q.type === 'long_text' && (
                      <textarea disabled placeholder="Jawaban panjang..." className="w-full h-20 border border-slate-200 rounded-lg bg-slate-50 px-3 py-2 text-sm resize-none" />
                    )}
                    {q.type === 'number' && (
                      <div>
                        <Input type="number" disabled placeholder="0" className="bg-slate-50 w-40" />
                        {(q.config?.min !== undefined || q.config?.max !== undefined) && (
                          <p className="text-[11px] text-slate-400 mt-1">
                            {q.config?.min !== undefined && `Min: ${q.config.min}`}
                            {q.config?.min !== undefined && q.config?.max !== undefined && ' · '}
                            {q.config?.max !== undefined && `Max: ${q.config.max}`}
                          </p>
                        )}
                      </div>
                    )}
                    {q.type === 'yes_no' && (
                      <div className="flex gap-4">
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
                        {q.config?.allowOther && (
                          <label className="flex items-center gap-2 text-sm text-slate-400 italic">
                            <span className="w-4 h-4 rounded-full border-2 border-dashed border-slate-300 shrink-0" />
                            Lainnya...
                          </label>
                        )}
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
                        {q.config?.allowOther && (
                          <label className="flex items-center gap-2 text-sm text-slate-400 italic">
                            <span className="w-4 h-4 rounded border-2 border-dashed border-slate-300 shrink-0" />
                            Lainnya...
                          </label>
                        )}
                      </div>
                    )}
                    {q.type === 'dropdown' && (
                      <div className="w-60">
                        <div className="flex items-center justify-between h-10 px-3 border border-slate-200 rounded-lg bg-slate-50 text-sm text-slate-400">
                          <span>Pilih jawaban</span>
                          <ChevronDown size={14} />
                        </div>
                      </div>
                    )}
                    {q.type === 'linear_scale' && (
                      <div>
                        <div className="flex items-center justify-between text-[11px] text-slate-400 mb-1 px-1">
                          <span>{q.config?.labelMin || ''}</span>
                          <span>{q.config?.labelMax || ''}</span>
                        </div>
                        <div className="flex items-center justify-center gap-2 sm:gap-3">
                          {Array.from({ length: (q.config?.scaleMax || 5) - (q.config?.scaleMin || 1) + 1 }, (_, i) => (q.config?.scaleMin || 1) + i).map((n) => (
                            <div key={n} className="flex flex-col items-center gap-1">
                              <span className="w-8 h-8 rounded-full border-2 border-slate-300 flex items-center justify-center text-sm text-slate-500 hover:border-blue-400 hover:text-blue-600 transition-colors cursor-pointer">{n}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    {q.type === 'date' && (
                      <div className="flex items-center gap-2 h-10 px-3 border border-slate-200 rounded-lg bg-slate-50 text-sm text-slate-400 w-48">
                        <CalendarIcon size={14} />
                        <span>DD / MM / YYYY</span>
                      </div>
                    )}
                    {q.type === 'time' && (
                      <div className="flex items-center gap-2 h-10 px-3 border border-slate-200 rounded-lg bg-slate-50 text-sm text-slate-400 w-36">
                        <ClockIcon size={14} />
                        <span>HH : MM</span>
                      </div>
                    )}
                    {q.type === 'file_upload' && (
                      <div className="border-2 border-dashed border-slate-200 rounded-lg p-6 text-center bg-slate-50">
                        <Upload size={24} className="mx-auto text-slate-300 mb-2" />
                        <p className="text-sm text-slate-500 font-medium">Klik atau seret file ke sini</p>
                        <p className="text-xs text-slate-400 mt-1">
                          {q.config?.accept === 'image/*' ? 'Gambar' : q.config?.accept === '*' ? 'Semua tipe file' : q.config?.accept || 'File'}
                          {' · '}Maks. {q.config?.maxFiles || 5} file
                          {q.config?.maxSizeKB && ` · Maks. ${q.config.maxSizeKB} KB`}
                        </p>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
// ═══════════════════════════════════════════════════════════════════════════════
function SettingsTab({ settings, fetchSettings }) {
  const [totalKaryawan, setTotalKaryawan] = useState(settings?.totalKaryawan || 280);
  const [jamPerHari, setJamPerHari] = useState(settings?.jamKerjaPerHari || 8);
  const [hariPerBulan, setHariPerBulan] = useState(settings?.hariKerjaPerBulan || 20);
  const [jumlahFatality, setJumlahFatality] = useState(settings?.jumlahFatality || 0);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (settings) {
      setTotalKaryawan(settings.totalKaryawan || 280);
      setJamPerHari(settings.jamKerjaPerHari || 8);
      setHariPerBulan(settings.hariKerjaPerBulan || 20);
      setJumlahFatality(settings.jumlahFatality || 0);
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
        hariKerjaPerBulan: hariPerBulan,
        jumlahFatality,
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
            { label: 'Jumlah Fatality', value: jumlahFatality, suffix: jumlahFatality > 0 ? '⚠️ Ada' : '✅ Tidak Ada' },
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
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
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
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700 flex items-center gap-1.5">
                <AlertTriangle size={14} className="text-rose-400" />
                Jumlah Fatality
              </label>
              <Input
                type="number"
                value={jumlahFatality}
                onChange={(e) => setJumlahFatality(Number(e.target.value) || 0)}
                min={0}
                className="h-11 text-lg font-semibold"
              />
              <p className="text-[11px] text-slate-400">
                Status otomatis: <strong className={jumlahFatality > 0 ? 'text-rose-600' : 'text-emerald-600'}>{jumlahFatality > 0 ? '⚠️ Ada' : '✅ Tidak Ada'}</strong>
              </p>
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
