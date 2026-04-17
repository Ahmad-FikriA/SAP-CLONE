'use client';

import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { apiGet, apiBlob } from '@/lib/api';
import { formatDate } from '@/lib/date-utils';
import { CATEGORIES } from '@/lib/constants';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { RefreshCw, Download } from 'lucide-react';

const MONTHS = [
  { value: '', label: 'Semua Bulan' },
  { value: '1', label: 'Januari' }, { value: '2', label: 'Februari' },
  { value: '3', label: 'Maret' }, { value: '4', label: 'April' },
  { value: '5', label: 'Mei' }, { value: '6', label: 'Juni' },
  { value: '7', label: 'Juli' }, { value: '8', label: 'Agustus' },
  { value: '9', label: 'September' }, { value: '10', label: 'Oktober' },
  { value: '11', label: 'November' }, { value: '12', label: 'Desember' },
];

function buildYears() {
  const now = new Date().getFullYear();
  return Array.from({ length: 5 }, (_, i) => now + 1 - i);
}

export default function SubmissionsPage() {
  const [subs, setSubs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [year, setYear] = useState(String(new Date().getFullYear()));
  const [month, setMonth] = useState('');
  const [category, setCategory] = useState('');
  const [exporting, setExporting] = useState(false);
  const [detail, setDetail] = useState(null);

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    try {
      const data = await apiGet('/submissions');
      setSubs(data);
    } catch (e) {
      toast.error('Gagal memuat data: ' + e.message);
    } finally {
      setLoading(false);
    }
  }

  async function exportExcel() {
    setExporting(true);
    try {
      const params = new URLSearchParams();
      if (year) params.set('year', year);
      if (month) params.set('month', month);
      if (category) params.set('category', category);
      const blob = await apiBlob(`/submissions/export?${params}`);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `submissions-${year || 'all'}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success('Berhasil diunduh');
    } catch (e) {
      toast.error('Export gagal: ' + e.message);
    } finally {
      setExporting(false);
    }
  }

  const displayed = [...subs].reverse();
  const years = buildYears();

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-xl font-semibold text-gray-800">Submissions Log</h2>
          <p className="text-sm text-gray-500">Riwayat pengiriman data preventive maintenance (read-only)</p>
        </div>
        <Button variant="outline" size="sm" onClick={load} className="gap-1.5">
          <RefreshCw size={13} /> Refresh
        </Button>
      </div>

      {/* Export filter bar */}
      <div className="flex flex-wrap items-end gap-3 p-4 bg-gray-50 border border-gray-200 rounded-xl">
        <div className="flex flex-col gap-1">
          <label className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide">Tahun</label>
          <select value={year} onChange={(e) => setYear(e.target.value)}
            className="px-2.5 py-1.5 border border-gray-200 rounded-md text-sm bg-white min-w-[80px]">
            {years.map((y) => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide">Bulan</label>
          <select value={month} onChange={(e) => setMonth(e.target.value)}
            className="px-2.5 py-1.5 border border-gray-200 rounded-md text-sm bg-white min-w-[120px]">
            {MONTHS.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide">Kategori</label>
          <select value={category} onChange={(e) => setCategory(e.target.value)}
            className="px-2.5 py-1.5 border border-gray-200 rounded-md text-sm bg-white min-w-[130px]">
            <option value="">Semua Kategori</option>
            {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <Button size="sm" onClick={exportExcel} disabled={exporting} className="gap-1.5">
          <Download size={14} /> {exporting ? 'Mengekspor...' : 'Export Excel'}
        </Button>
      </div>

      {/* Table */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              {['SPK Number', 'Submitted At', 'Duration (menit)', 'Evaluasi', 'Photos', 'Lokasi'].map((h) => (
                <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading ? (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-400">Memuat...</td></tr>
            ) : displayed.length === 0 ? (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-400">Belum ada submissions</td></tr>
            ) : displayed.map((s) => (
              <tr key={s.id} onClick={() => setDetail(s)}
                className="cursor-pointer hover:bg-gray-50 transition-colors">
                <td className="px-4 py-3 font-medium text-gray-900">{s.spkNumber}</td>
                <td className="px-4 py-3 text-gray-600">{formatDate(s.submittedAt)}</td>
                <td className="px-4 py-3 text-gray-600">{s.durationActual ?? '—'}</td>
                <td className="px-4 py-3 text-gray-600 max-w-[220px] truncate">{s.evaluasi || '—'}</td>
                <td className="px-4 py-3 text-gray-600">{(s.photoPaths || []).length}</td>
                <td className="px-4 py-3 text-gray-400 text-xs">
                  {s.latitude != null ? `${parseFloat(s.latitude).toFixed(4)}, ${parseFloat(s.longitude).toFixed(4)}` : '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Detail dialog */}
      <Dialog open={!!detail} onOpenChange={(open) => !open && setDetail(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Detail — {detail?.spkNumber}</DialogTitle>
          </DialogHeader>
          <pre className="bg-gray-50 border border-gray-200 rounded-lg p-4 text-xs overflow-auto max-h-96">
            {JSON.stringify(detail, null, 2)}
          </pre>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDetail(null)}>Tutup</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
