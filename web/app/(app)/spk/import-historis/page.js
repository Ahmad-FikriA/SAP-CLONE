'use client';

import { useRef, useState } from 'react';
import { toast } from 'sonner';
import { apiPost } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Upload, CheckCircle2, Clock, SkipForward, X, FileSpreadsheet, Loader2 } from 'lucide-react';

const BASE = process.env.NEXT_PUBLIC_API_URL;

function SummaryCard({ icon: Icon, label, value, color }) {
  return (
    <div className={`flex items-center gap-3 rounded-lg border p-4 ${color}`}>
      <Icon className="h-5 w-5 shrink-0" />
      <div>
        <p className="text-sm text-muted-foreground">{label}</p>
        <p className="text-2xl font-bold">{value}</p>
      </div>
    </div>
  );
}

async function previewFile(file, token) {
  const form = new FormData();
  form.append('file', file);
  const res = await fetch(`${BASE}/api/spk/import-historical/preview`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: form,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || `Gagal membaca ${file.name}`);
  return { fileName: file.name, ...data };
}

export default function ImportHistorisPage() {
  const inputRef            = useRef(null);
  const [step, setStep]     = useState('upload');
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState('');
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [preview, setPreview] = useState(null); // { files: [...], orders: [...], total, sudah, belum }
  const [result, setResult] = useState(null);

  function handleFileChange(e) {
    const files = Array.from(e.target.files || []);
    if (files.length) setSelectedFiles(prev => {
      const existing = new Set(prev.map(f => f.name));
      return [...prev, ...files.filter(f => !existing.has(f.name))];
    });
    e.target.value = '';
  }

  function removeFile(name) {
    setSelectedFiles(prev => prev.filter(f => f.name !== name));
  }

  async function handleProcess() {
    if (loading || !selectedFiles.length) return;
    if (!BASE) { toast.error('API URL tidak dikonfigurasi'); return; }
    const token = localStorage.getItem('token');
    if (!token) { toast.error('Sesi habis, silakan login ulang'); return; }

    setLoading(true);
    try {
      const fileResults = [];
      const seenOrders = new Set();
      const allOrders  = [];

      for (let i = 0; i < selectedFiles.length; i++) {
        const file = selectedFiles[i];
        setProgress(`Membaca file ${i + 1} dari ${selectedFiles.length}: ${file.name}`);
        const res = await previewFile(file, token);
        // Deduplicate across files by orderNumber
        const unique = res.orders.filter(o => {
          const key = String(o.orderNumber).trim();
          if (seenOrders.has(key)) return false;
          seenOrders.add(key);
          return true;
        });
        fileResults.push({ fileName: file.name, total: unique.length, sudah: unique.filter(o => o.sudah).length });
        allOrders.push(...unique);
      }

      setPreview({
        files:   fileResults,
        orders:  allOrders,
        total:   allOrders.length,
        sudah:   allOrders.filter(o => o.sudah).length,
        belum:   allOrders.filter(o => !o.sudah).length,
      });
      setStep('preview');
    } catch (err) {
      toast.error(err.message);
    } finally {
      setLoading(false);
      setProgress('');
    }
  }

  async function handleConfirm() {
    setLoading(true);
    try {
      const orders = preview?.orders ?? [];
      if (!orders.length) { toast.error('Tidak ada data untuk diimpor'); return; }
      const data = await apiPost('/spk/import-historical/confirm', { orders });
      setResult(data);
      setStep('done');
      toast.success(`Import selesai — ${data.imported} SPK berhasil diimpor`);
    } catch (err) {
      toast.error(err.message || 'Gagal mengimpor data');
    } finally {
      setLoading(false);
    }
  }

  function reset() {
    setStep('upload');
    setSelectedFiles([]);
    setPreview(null);
    setResult(null);
    setProgress('');
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-bold text-[#1b3a5c]">Import Data Historis SPK</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Upload satu atau beberapa file Excel SAP IW38. Status ditentukan dari kolom{' '}
          <code className="rounded bg-muted px-1">System Status</code> —
          records dengan <code className="rounded bg-muted px-1">TECO</code> diclose,
          sisanya masuk tunggakan. Tidak ada notifikasi yang dikirim.
        </p>
      </div>

      {/* ── Step 1: Upload ─────────────────────────────────────────────── */}
      {step === 'upload' && (
        <div className="space-y-4">
          {/* Drop zone */}
          <div
            onClick={() => !loading && inputRef.current?.click()}
            onDragOver={e => { e.preventDefault(); }}
            onDrop={e => {
              e.preventDefault();
              if (loading) return;
              const files = Array.from(e.dataTransfer.files).filter(f =>
                f.name.endsWith('.xlsx') || f.name.endsWith('.xls')
              );
              if (files.length) setSelectedFiles(prev => {
                const existing = new Set(prev.map(f => f.name));
                return [...prev, ...files.filter(f => !existing.has(f.name))];
              });
            }}
            className="flex flex-col items-center justify-center gap-2 border-2 border-dashed rounded-xl p-10 cursor-pointer transition-colors border-gray-300 bg-gray-50 hover:border-blue-400 hover:bg-blue-50"
          >
            <Upload size={32} className="text-gray-400" />
            <p className="text-sm text-gray-500 text-center">
              Drop file Excel di sini atau klik untuk memilih
            </p>
            <p className="text-xs text-gray-400">Bisa pilih beberapa file sekaligus (.xlsx, .xls)</p>
            <input
              ref={inputRef}
              type="file"
              accept=".xlsx,.xls"
              multiple
              onChange={handleFileChange}
              className="hidden"
            />
          </div>

          {/* Selected files list */}
          {selectedFiles.length > 0 && (
            <div className="space-y-2">
              <p className="text-sm font-medium text-gray-700">{selectedFiles.length} file dipilih:</p>
              <div className="divide-y rounded-lg border overflow-hidden">
                {selectedFiles.map(f => (
                  <div key={f.name} className="flex items-center gap-3 px-3 py-2 bg-white">
                    <FileSpreadsheet size={16} className="text-green-600 shrink-0" />
                    <span className="flex-1 text-sm truncate">{f.name}</span>
                    <button
                      onClick={() => removeFile(f.name)}
                      className="text-gray-400 hover:text-red-500 transition-colors"
                    >
                      <X size={14} />
                    </button>
                  </div>
                ))}
              </div>

              <div className="flex gap-3">
                <Button variant="outline" onClick={() => setSelectedFiles([])}>Hapus Semua</Button>
                <Button onClick={handleProcess} disabled={loading}>
                  {loading ? (
                    <span className="flex items-center gap-2">
                      <Loader2 size={14} className="animate-spin" />
                      {progress || 'Memproses…'}
                    </span>
                  ) : `Proses ${selectedFiles.length} File`}
                </Button>
              </div>

              {loading && progress && (
                <p className="text-xs text-muted-foreground">{progress}</p>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── Step 2: Preview ────────────────────────────────────────────── */}
      {step === 'preview' && preview && (
        <div className="space-y-4">
          <h2 className="font-semibold">Preview Import</h2>

          {/* Combined totals */}
          <div className="grid grid-cols-3 gap-3">
            <SummaryCard icon={Upload}       label="Total SPK"           value={preview.total} color="border-blue-200 bg-blue-50" />
            <SummaryCard icon={CheckCircle2} label="Akan Ditutup (TECO)" value={preview.sudah} color="border-green-200 bg-green-50" />
            <SummaryCard icon={Clock}        label="Masuk Tunggakan"      value={preview.belum} color="border-amber-200 bg-amber-50" />
          </div>

          {/* Per-file breakdown */}
          {preview.files.length > 1 && (
            <div className="rounded-lg border overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-gray-100 text-gray-600">
                  <tr>
                    <th className="px-3 py-2 text-left font-medium">File</th>
                    <th className="px-3 py-2 text-right font-medium">Total</th>
                    <th className="px-3 py-2 text-right font-medium">TECO</th>
                    <th className="px-3 py-2 text-right font-medium">Tunggakan</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.files.map((f, i) => (
                    <tr key={f.fileName} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                      <td className="px-3 py-2 truncate max-w-[200px]">{f.fileName}</td>
                      <td className="px-3 py-2 text-right font-mono">{f.total}</td>
                      <td className="px-3 py-2 text-right text-green-600 font-mono">{f.sudah}</td>
                      <td className="px-3 py-2 text-right text-amber-600 font-mono">{f.total - f.sudah}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Sample orders table */}
          <div className="overflow-auto rounded-lg border">
            <table className="w-full text-sm">
              <thead className="bg-[#1b3a5c] text-white">
                <tr>
                  <th className="px-3 py-2 text-left">Order</th>
                  <th className="px-3 py-2 text-left">Deskripsi</th>
                  <th className="px-3 py-2 text-left">Kategori</th>
                  <th className="px-3 py-2 text-left">Tgl. Jadwal</th>
                  <th className="px-3 py-2 text-left">System Status</th>
                  <th className="px-3 py-2 text-center">TECO</th>
                </tr>
              </thead>
              <tbody>
                {preview.orders.slice(0, 10).map((o, i) => (
                  <tr key={o.orderNumber} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                    <td className="px-3 py-2 font-mono text-xs">{o.orderNumber}</td>
                    <td className="px-3 py-2">{o.description || '—'}</td>
                    <td className="px-3 py-2">{o.category || '—'}</td>
                    <td className="px-3 py-2">{o.scheduledDate ?? '—'}</td>
                    <td className="px-3 py-2 text-xs text-muted-foreground">{o.systemStatus || '—'}</td>
                    <td className="px-3 py-2 text-center">
                      {o.sudah
                        ? <span className="text-green-600 font-bold">✓</span>
                        : <span className="text-amber-500">–</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {preview.orders.length > 10 && (
              <p className="px-3 py-2 text-xs text-muted-foreground">
                …dan {preview.orders.length - 10} baris lainnya
              </p>
            )}
          </div>

          <div className="flex gap-3">
            <Button variant="outline" onClick={reset} disabled={loading}>Batal</Button>
            <Button onClick={handleConfirm} disabled={loading}>
              {loading ? 'Mengimpor…' : `Konfirmasi Import ${preview.total} SPK`}
            </Button>
          </div>
        </div>
      )}

      {/* ── Step 3: Done ───────────────────────────────────────────────── */}
      {step === 'done' && result && (
        <div className="space-y-4">
          <h2 className="font-semibold text-green-700">Import Berhasil</h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <SummaryCard icon={Upload}       label="Diimpor"   value={result.imported}  color="border-blue-200 bg-blue-50" />
            <SummaryCard icon={CheckCircle2} label="Ditutup"   value={result.closed}    color="border-green-200 bg-green-50" />
            <SummaryCard icon={Clock}        label="Tunggakan" value={result.tunggakan} color="border-amber-200 bg-amber-50" />
            <SummaryCard icon={SkipForward}  label="Dilewati"  value={result.skipped}   color="border-gray-200 bg-gray-50" />
          </div>
          <Button onClick={reset}>Import File Lain</Button>
        </div>
      )}
    </div>
  );
}
