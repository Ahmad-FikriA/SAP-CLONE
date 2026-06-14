'use client';

import { useState, useEffect, useMemo } from 'react';
import { toast } from 'sonner';
import { 
  X, Upload, CalendarDays, Wrench, Loader2, Camera, FileText, 
  CheckCircle2, AlertTriangle, Plus, Trash2, ShieldAlert
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { getUser } from '@/lib/auth';
import { submitInspeksiReport } from '@/lib/inspeksi-service';
import { apiUpload } from '@/lib/api';

const STANDARD_TOOLS = [
  'Multimeter',
  'Thermometer',
  'Pressure Gauge',
  'Clamp Meter',
  'Vibration Meter',
  'Tachometer',
  'Flow Meter',
];

function toDateInputValue(date) {
  const d = date instanceof Date ? date : new Date(date);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function FieldError({ children }) {
  if (!children) return null;
  return <p className="mt-1 text-xs font-semibold text-red-600 animate-pulse">{children}</p>;
}

function FormLabel({ children, required = false }) {
  return (
    <label className="text-xs font-bold uppercase tracking-wider text-slate-600 flex items-center gap-1">
      {children}
      {required && <span className="text-red-500 font-bold">*</span>}
    </label>
  );
}

export function InspeksiExecutionModal({ schedule, open, onClose, onSaved }) {
  const [submitting, setSubmitting] = useState(false);
  const [uploading, setUploading] = useState(false);

  // Form States
  const [inspectorName, setInspectorName] = useState('');
  const [inspectionDate, setInspectionDate] = useState(toDateInputValue(new Date()));
  const [location, setLocation] = useState('');
  const [selectedTools, setSelectedTools] = useState([]);
  const [customToolText, setCustomToolText] = useState('');
  const [findings, setFindings] = useState('');
  const [statusInspeksi, setStatusInspeksi] = useState('Aman');
  const [kerusakanDetail, setKerusakanDetail] = useState('');
  
  // File States
  const [photos, setPhotos] = useState([]); // List of File objects for photos/videos
  const [documents, setDocuments] = useState([]); // List of File objects for pdf/word/excel
  const [photoPreviews, setPhotoPreviews] = useState([]); // List of { id, url, name, type }

  // Clean previews on unmount/close
  useEffect(() => {
    return () => {
      photoPreviews.forEach((p) => URL.revokeObjectURL(p.url));
    };
  }, [photoPreviews]);

  // Pre-fill fields on open
  useEffect(() => {
    if (!open || !schedule) return;

    const currentUser = getUser();
    setInspectorName(currentUser?.name || currentUser?.nik || 'Inspector');
    setLocation(schedule.location || schedule.title || '-');
    setInspectionDate(toDateInputValue(new Date()));
    setSelectedTools([]);
    setCustomToolText('');
    setFindings('');
    setStatusInspeksi('Aman');
    setKerusakanDetail('');
    setPhotos([]);
    setDocuments([]);
    setPhotoPreviews([]);
  }, [open, schedule]);

  // Handle standard tool toggle
  function handleToggleTool(tool) {
    if (selectedTools.includes(tool)) {
      setSelectedTools(selectedTools.filter((t) => t !== tool));
    } else {
      setSelectedTools([...selectedTools, tool]);
    }
  }

  // Handle manual tool addition
  function handleAddCustomTool(e) {
    if (e) e.preventDefault();
    const text = customToolText.trim();
    if (!text) return;
    if (!selectedTools.includes(text)) {
      setSelectedTools([...selectedTools, text]);
    }
    setCustomToolText('');
  }

  // Handle Photo/Video Selection
  function handlePhotoSelect(e) {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    // Check count limit (max 10 total)
    if (photos.length + files.length > 10) {
      toast.error('Maksimal 10 foto/video dokumentasi.');
      return;
    }

    const newPhotos = [];
    const newPreviews = [];

    files.forEach((file) => {
      // Validate file size (max 50MB for media)
      if (file.size > 50 * 1024 * 1024) {
        toast.error(`File "${file.name}" dilewati karena melebihi batas 50 MB.`);
        return;
      }

      newPhotos.push(file);
      const isVideo = file.type.startsWith('video/');
      const url = URL.createObjectURL(file);
      newPreviews.push({
        id: Math.random().toString(36).substring(7),
        url,
        name: file.name,
        isVideo,
      });
    });

    setPhotos([...photos, ...newPhotos]);
    setPhotoPreviews([...photoPreviews, ...newPreviews]);
  }

  // Remove Selected Photo
  function handleRemovePhoto(index) {
    const previewToRemove = photoPreviews[index];
    if (previewToRemove) {
      URL.revokeObjectURL(previewToRemove.url);
    }
    setPhotos(photos.filter((_, i) => i !== index));
    setPhotoPreviews(photoPreviews.filter((_, i) => i !== index));
  }

  // Handle Document Selection
  function handleDocSelect(e) {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    // Check count limit
    if (documents.length + files.length > 5) {
      toast.error('Maksimal 5 dokumen lampiran.');
      return;
    }

    const newDocs = [];
    files.forEach((file) => {
      // Validate size (max 10MB)
      if (file.size > 10 * 1024 * 1024) {
        toast.error(`File "${file.name}" dilewati karena melebihi batas 10 MB.`);
        return;
      }
      newDocs.push(file);
    });

    setDocuments([...documents, ...newDocs]);
  }

  // Remove Selected Document
  function handleRemoveDoc(index) {
    setDocuments(documents.filter((_, i) => i !== index));
  }

  // Helper for document icon
  function getFileIcon(filename) {
    const ext = filename.split('.').pop().toLowerCase();
    if (ext === 'pdf') return <FileText size={18} className="text-red-500" />;
    if (['doc', 'docx'].includes(ext)) return <FileText size={18} className="text-blue-500" />;
    if (['xls', 'xlsx'].includes(ext)) return <FileText size={18} className="text-green-500" />;
    return <FileText size={18} className="text-slate-500" />;
  }

  // Format file size
  function formatSize(bytes) {
    const kb = bytes / 1024;
    if (kb < 1024) return `${kb.toFixed(1)} KB`;
    return `${(kb / 1024).toFixed(1)} MB`;
  }

  // Form Validation
  function validateForm() {
    if (selectedTools.length === 0) {
      toast.error('Minimal satu alat harus dipilih atau dimasukkan.');
      return false;
    }
    if (!findings.trim()) {
      toast.error('Laporan temuan inspeksi wajib diisi.');
      return false;
    }
    if (statusInspeksi === 'Tidak Aman') {
      if (!kerusakanDetail.trim()) {
        toast.error('Detail kerusakan wajib diisi jika kondisi tidak aman.');
        return false;
      }
    }
    if (photos.length === 0) {
      toast.error('Minimal satu foto dokumentasi wajib ditambahkan.');
      return false;
    }
    return true;
  }

  // Sequential Asynchronous File Upload & Submission
  async function handleSubmit(e) {
    e.preventDefault();
    if (!validateForm()) return;

    setSubmitting(true);
    setUploading(true);

    try {
      // 1. Upload Photos/Videos if any
      let uploadedPhotoPaths = [];
      if (photos.length > 0) {
        const formData = new FormData();
        photos.forEach((file) => {
          formData.append('media', file);
        });
        const res = await apiUpload('/upload/inspection-media', formData);
        uploadedPhotoPaths = res?.data?.paths ?? res?.paths ?? [];
      }

      // 2. Upload Documents if any
      let uploadedDocPaths = [];
      if (documents.length > 0) {
        const formData = new FormData();
        documents.forEach((file) => {
          formData.append('media', file);
        });
        const res = await apiUpload('/upload/inspection-media', formData);
        uploadedDocPaths = res?.data?.paths ?? res?.paths ?? [];
      }

      setUploading(false);

      // 3. Assemble and Submit Final Report
      const payload = {
        scheduleId: schedule.id,
        inspectorName,
        inspectionDate,
        location,
        tools: selectedTools,
        findings: findings.trim(),
        hasKerusakan: statusInspeksi === 'Tidak Aman',
        kerusakanDetail: statusInspeksi === 'Tidak Aman' ? kerusakanDetail.trim() : null,
        kriteria: statusInspeksi, // 'Aman' atau 'Tidak Aman'
        photos: uploadedPhotoPaths,
        attachments: uploadedDocPaths,
        status: 'submitted',
      };

      const result = await submitInspeksiReport(payload);
      if (result) {
        toast.success('Laporan inspeksi K3 berhasil dikirim!');
        onSaved?.(result);
        onClose();
      } else {
        throw new Error('Gagal menyimpan laporan.');
      }
    } catch (error) {
      console.error('[InspeksiExecutionModal] Error:', error);
      toast.error('Gagal mengirimkan laporan: ' + error.message);
    } finally {
      setSubmitting(false);
      setUploading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => !submitting && onClose()}>
      <DialogContent className="max-h-[92vh] max-w-2xl overflow-y-auto p-0 rounded-xl shadow-2xl border border-slate-100 modal-custom-scroll bg-white">
        
        {/* Header */}
        <DialogHeader className="bg-[#0a2540] text-white px-6 py-5 rounded-t-xl shrink-0">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center shrink-0">
              <Camera size={20} className="text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <DialogTitle className="text-lg font-bold leading-tight">
                Pelaksanaan Inspeksi
              </DialogTitle>
              <p className="text-xs text-white/70 font-mono mt-1">
                SPK: {schedule?.nomorPoJo || `#${schedule?.id}`}
              </p>
            </div>
            <button 
              type="button" 
              onClick={onClose} 
              disabled={submitting}
              className="text-white/70 hover:text-white transition p-1 hover:bg-white/10 rounded-lg"
            >
              <X size={18} />
            </button>
          </div>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">

          {/* SECTION 1: DATA INSPEKTOR */}
          <div className="bg-slate-50 border border-slate-200/60 rounded-xl p-4 space-y-4">
            <h4 className="text-xs font-bold text-[#0a2540] uppercase tracking-wider flex items-center gap-1.5">
              <CalendarDays size={14} /> Data Inspektor
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <FormLabel>Nama Inspektor</FormLabel>
                <input
                  type="text"
                  value={inspectorName}
                  readOnly
                  disabled
                  className="h-10 w-full rounded-lg border border-slate-200 bg-slate-100/80 px-3 text-sm text-slate-500 cursor-not-allowed outline-none font-medium"
                />
              </div>

              <div className="space-y-1.5">
                <FormLabel required>Tanggal Inspeksi</FormLabel>
                <div className="relative">
                  <input
                    type="date"
                    value={inspectionDate}
                    onChange={(e) => setInspectionDate(e.target.value)}
                    required
                    disabled={submitting}
                    className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 pr-9 text-sm text-slate-800 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 font-medium"
                  />
                  <CalendarDays size={15} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#0a2540] pointer-events-none" />
                </div>
              </div>

              <div className="col-span-1 sm:col-span-2 space-y-1.5">
                <FormLabel>Lokasi Inspeksi</FormLabel>
                <input
                  type="text"
                  value={location}
                  readOnly
                  disabled
                  className="h-10 w-full rounded-lg border border-slate-200 bg-slate-100/80 px-3 text-sm text-slate-500 cursor-not-allowed outline-none font-medium"
                />
              </div>
            </div>
          </div>

          {/* SECTION 2: DETAIL ALAT */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold text-[#0a2540] uppercase tracking-wider flex items-center gap-1.5">
              <Wrench size={14} /> Alat yang Dipakai <span className="text-red-500 font-bold">*</span>
            </h4>
            
            {/* Standard tools chips list */}
            <div className="flex flex-wrap gap-2">
              {STANDARD_TOOLS.map((tool) => {
                const isSelected = selectedTools.includes(tool);
                return (
                  <button
                    key={tool}
                    type="button"
                    onClick={() => handleToggleTool(tool)}
                    disabled={submitting}
                    className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-all ${
                      isSelected 
                        ? 'bg-blue-50 text-blue-700 border-blue-200 shadow-sm scale-[1.02]' 
                        : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    {tool}
                  </button>
                );
              })}
            </div>

            {/* Custom Tool Insertion */}
            <div className="flex gap-2 max-w-sm mt-3">
              <input
                type="text"
                value={customToolText}
                onChange={(e) => setCustomToolText(e.target.value)}
                placeholder="Ketik alat lainnya..."
                disabled={submitting}
                onKeyDown={(e) => e.key === 'Enter' && handleAddCustomTool(e)}
                className="h-9 flex-1 rounded-lg border border-slate-200 bg-white px-3 text-xs text-slate-800 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleAddCustomTool}
                disabled={submitting}
                className="h-9 bg-slate-50 hover:bg-slate-100 border-slate-200 text-slate-700"
              >
                <Plus size={14} /> Tambah
              </Button>
            </div>

            {/* Selection Status */}
            {selectedTools.length > 0 && (
              <div className="border border-slate-100 rounded-lg p-3 bg-blue-50/20 flex flex-wrap gap-1.5 items-center">
                <span className="text-[10px] font-bold text-blue-600 uppercase tracking-wide mr-1.5">Alat Terpilih:</span>
                {selectedTools.map((tool) => (
                  <span 
                    key={tool} 
                    className="inline-flex items-center gap-1 bg-[#0a2540] text-white px-2 py-0.5 rounded-full text-[11px] font-medium"
                  >
                    {tool}
                    <button 
                      type="button" 
                      onClick={() => handleToggleTool(tool)}
                      disabled={submitting}
                      className="hover:bg-white/20 rounded-full p-0.5"
                    >
                      <X size={10} />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* SECTION 3: LAPORAN TEMUAN */}
          <div className="space-y-1.5">
            <FormLabel required>Laporan Temuan Inspeksi</FormLabel>
            <textarea
              value={findings}
              onChange={(e) => setFindings(e.target.value)}
              placeholder="Tulis detail temuan hasil inspeksi di lapangan..."
              rows={4}
              required
              disabled={submitting}
              className="w-full rounded-lg border border-slate-200 bg-white p-3 text-sm text-slate-800 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 placeholder:text-slate-400"
            />
          </div>

          {/* SECTION 4: STATUS KONDISI K3 */}
          <div className="space-y-3">
            <FormLabel required>Status Inspeksi</FormLabel>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Card 1: Aman */}
              <button
                type="button"
                onClick={() => setStatusInspeksi('Aman')}
                disabled={submitting}
                className={`p-4 rounded-xl border text-left flex items-start gap-3 transition-all ${
                  statusInspeksi === 'Aman'
                    ? 'border-emerald-500 bg-emerald-50/20 ring-1 ring-emerald-500'
                    : 'border-slate-200 hover:border-slate-300 bg-white'
                }`}
              >
                <CheckCircle2 className={`w-5 h-5 mt-0.5 shrink-0 ${statusInspeksi === 'Aman' ? 'text-emerald-500' : 'text-slate-400'}`} />
                <div>
                  <span className="block text-sm font-bold text-slate-800">Aman</span>
                  <span className="text-xs text-slate-500 mt-1 block">Kondisi normal, tidak ditemukan kejanggalan atau potensi bahaya.</span>
                </div>
              </button>

              {/* Card 2: Tidak Aman */}
              <button
                type="button"
                onClick={() => setStatusInspeksi('Tidak Aman')}
                disabled={submitting}
                className={`p-4 rounded-xl border text-left flex items-start gap-3 transition-all ${
                  statusInspeksi === 'Tidak Aman'
                    ? 'border-amber-500 bg-amber-50/20 ring-1 ring-amber-500'
                    : 'border-slate-200 hover:border-slate-300 bg-white'
                }`}
              >
                <AlertTriangle className={`w-5 h-5 mt-0.5 shrink-0 ${statusInspeksi === 'Tidak Aman' ? 'text-amber-600' : 'text-slate-400'}`} />
                <div>
                  <span className="block text-sm font-bold text-slate-800">Tidak Aman</span>
                  <span className="text-xs text-slate-500 mt-1 block">Ditemukan penyimpangan K3, kerusakan, atau kondisi berbahaya.</span>
                </div>
              </button>
            </div>

            {/* Conditional Fields: Jika Tidak Aman */}
            {statusInspeksi === 'Tidak Aman' && (
              <div className="border border-amber-200/70 bg-amber-50/10 rounded-xl p-4 space-y-4 animate-fadeIn">
                <div className="flex items-center gap-2 border-b border-amber-100 pb-2 mb-3">
                  <ShieldAlert size={15} className="text-amber-600" />
                  <span className="text-xs font-bold text-amber-800 uppercase tracking-wider">Tindakan Lanjut Perbaikan</span>
                </div>

                <div className="space-y-1.5">
                  <FormLabel required>Detail Kerusakan</FormLabel>
                  <textarea
                    value={kerusakanDetail}
                    onChange={(e) => setKerusakanDetail(e.target.value)}
                    placeholder="Jelaskan detail kerusakan alat/perangkat atau kondisi tidak aman yang perlu diperbaiki..."
                    rows={3}
                    required={statusInspeksi === 'Tidak Aman'}
                    disabled={submitting}
                    className="w-full rounded-lg border border-slate-200 bg-white p-3 text-sm text-slate-800 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 placeholder:text-slate-400"
                  />
                </div>
              </div>
            )}
          </div>

          {/* SECTION 5: DOKUMENTASI MEDIA (FOTO/VIDEO) */}
          <div className="space-y-3">
            <FormLabel required>Dokumentasi Foto / Video (Maks 10)</FormLabel>
            
            {/* Visual File Dropzone */}
            <div className="relative border-2 border-dashed border-slate-200 hover:border-blue-500 transition bg-slate-50/50 rounded-xl px-5 py-6 flex flex-col items-center justify-center text-center cursor-pointer group">
              <input
                type="file"
                multiple
                accept="image/*,video/*"
                onChange={handlePhotoSelect}
                disabled={submitting}
                className="absolute inset-0 opacity-0 cursor-pointer disabled:cursor-not-allowed"
              />
              <Upload size={24} className="text-slate-400 group-hover:text-blue-500 transition mb-2" />
              <p className="text-sm font-semibold text-slate-700">Pilih Foto / Video</p>
              <p className="text-xs text-slate-400 mt-1">Kompresi otomatis • Maksimal 50MB per media</p>
            </div>

            {/* Preview Grid */}
            {photoPreviews.length > 0 && (
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-3 mt-3">
                {photoPreviews.map((preview, idx) => (
                  <div key={preview.id} className="relative rounded-lg overflow-hidden border border-slate-200 aspect-square group shadow-sm bg-slate-100">
                    {preview.isVideo ? (
                      <div className="w-full h-full flex flex-col items-center justify-center p-2 text-center">
                        <Camera size={20} className="text-slate-400 mb-1" />
                        <span className="text-[9px] text-slate-500 truncate max-w-full font-medium">{preview.name}</span>
                      </div>
                    ) : (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img 
                        src={preview.url} 
                        alt="media preview" 
                        className="w-full h-full object-cover" 
                      />
                    )}
                    {/* Dark overlay & trash button */}
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition flex items-center justify-center">
                      <button
                        type="button"
                        onClick={() => handleRemovePhoto(idx)}
                        disabled={submitting}
                        className="p-1.5 bg-red-600 hover:bg-red-700 text-white rounded-lg transition"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* SECTION 6: LAMPIRAN DOKUMEN */}
          <div className="space-y-3">
            <FormLabel>Lampiran Dokumen Tambahan (Maks 5)</FormLabel>
            
            <div className="flex items-center gap-3">
              <label className="flex items-center gap-2 px-4 py-2 border border-slate-200 rounded-lg text-xs font-bold text-slate-700 bg-white hover:bg-slate-50 transition cursor-pointer">
                <Upload size={14} className="text-slate-500" />
                Pilih File Dokumen
                <input
                  type="file"
                  multiple
                  accept=".pdf,.doc,.docx,.xls,.xlsx"
                  onChange={handleDocSelect}
                  disabled={submitting}
                  className="hidden"
                />
              </label>
              <span className="text-xs text-slate-400">PDF, Word, Excel (Maks 10MB per file)</span>
            </div>

            {/* Document List */}
            {documents.length > 0 && (
              <div className="space-y-2 mt-2">
                {documents.map((doc, idx) => (
                  <div key={idx} className="flex items-center gap-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs">
                    {getFileIcon(doc.name)}
                    <span className="font-semibold text-slate-700 truncate flex-1">{doc.name}</span>
                    <span className="text-slate-400 font-mono shrink-0">{formatSize(doc.size)}</span>
                    <button
                      type="button"
                      onClick={() => handleRemoveDoc(idx)}
                      disabled={submitting}
                      className="text-red-500 hover:text-red-700 p-0.5 rounded transition"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Action Footer */}
          <DialogFooter className="border-t border-slate-100 pt-5 mt-8 flex flex-col-reverse sm:flex-row gap-2.5">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={submitting}
              className="h-11 rounded-lg border-slate-200 text-slate-700 font-semibold"
            >
              Batal
            </Button>
            <Button
              type="submit"
              disabled={submitting}
              className="h-11 bg-[#0a2540] text-white hover:bg-[#0d3152] flex-1 rounded-lg font-semibold"
            >
              {submitting ? (
                <>
                  <Loader2 size={16} className="animate-spin mr-2 shrink-0" />
                  {uploading ? 'Mengupload File...' : 'Mengirim Laporan...'}
                </>
              ) : (
                'Kirim Laporan Hasil Inspeksi'
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
