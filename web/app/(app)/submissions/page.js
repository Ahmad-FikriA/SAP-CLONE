'use client';

import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { apiGet, apiBlob } from '@/lib/api';
import { formatDate } from '@/lib/date-utils';
import { CATEGORIES } from '@/lib/constants';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { CategoryBadge } from '@/components/shared/StatusBadge';
import { RefreshCw, Download, MapPin } from 'lucide-react';

const UPLOADS_BASE = (process.env.NEXT_PUBLIC_API_URL || '').replace(/\/api\/?$/, '');

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

function buildWeeks() {
  return Array.from({ length: 54 }, (_, i) => i + 1);
}

function getISOWeek(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + 3 - ((d.getDay() + 6) % 7));
  const week1 = new Date(d.getFullYear(), 0, 4);
  return 1 + Math.round(((d - week1) / 86400000 - 3 + ((week1.getDay() + 6) % 7)) / 7);
}

function filterSubs(subs, { year, month, week, category }) {
  return subs.filter((s) => {
    const d = new Date(s.submittedAt);
    if (year && d.getFullYear() !== parseInt(year)) return false;
    if (week) {
      if (getISOWeek(d) !== parseInt(week)) return false;
    } else if (month) {
      if (d.getMonth() + 1 !== parseInt(month)) return false;
    }
    if (category && s.spkCategory !== category) return false;
    return true;
  });
}

export default function SubmissionsPage() {
  const [subs, setSubs] = useState([]);
  const [userMap, setUserMap] = useState({});
  const [loading, setLoading] = useState(true);
  const [year, setYear] = useState(String(new Date().getFullYear()));
  const [month, setMonth] = useState('');
  const [category, setCategory] = useState('');
  const [week, setWeek] = useState('');
  const [exporting, setExporting] = useState(false);
  const [exportingIW49, setExportingIW49] = useState(false);
  const [detail, setDetail] = useState(null);

  useEffect(() => {
    load();
    apiGet('/users').then(users => {
      setUserMap(Object.fromEntries(users.map(u => [u.id, u.name || u.nik])));
    }).catch(() => {});
  }, []);

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
      if (week) params.set('week', week);
      else if (month) params.set('month', month);
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

  async function exportIW49() {
    setExportingIW49(true);
    try {
      const params = new URLSearchParams();
      if (year) params.set('year', year);
      if (week) params.set('week', week);
      else if (month) params.set('month', month);
      if (category) params.set('category', category);
      const blob = await apiBlob(`/submissions/export-iw49?${params}`);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `IW49_Confirmation-${year || 'all'}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success('IW49 berhasil diunduh');
    } catch (e) {
      toast.error('Export IW49 gagal: ' + e.message);
    } finally {
      setExportingIW49(false);
    }
  }

  const displayed = filterSubs([...subs].reverse(), { year, month, week, category });
  const years = buildYears();
  const weeks = buildWeeks();

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-xl font-semibold text-gray-800">Submissions Log</h2>
          <p className="text-sm text-gray-500">
            {displayed.length} dari {subs.length} submissions
          </p>
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
          <label className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide">Minggu</label>
          <select value={week} onChange={(e) => { setWeek(e.target.value); if (e.target.value) setMonth(''); }}
            className="px-2.5 py-1.5 border border-gray-200 rounded-md text-sm bg-white min-w-[110px]">
            <option value="">Semua Minggu</option>
            {weeks.map((w) => <option key={w} value={w}>Minggu {w}</option>)}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label className={`text-[11px] font-semibold uppercase tracking-wide ${week ? 'text-gray-300' : 'text-gray-500'}`}>
            Bulan {week ? <span className="normal-case font-normal">(nonaktif saat minggu dipilih)</span> : ''}
          </label>
          <select value={month} onChange={(e) => { setMonth(e.target.value); if (e.target.value) setWeek(''); }}
            className={`px-2.5 py-1.5 border rounded-md text-sm bg-white min-w-[120px] transition-colors ${week ? 'border-gray-100 text-gray-300 cursor-not-allowed bg-gray-50' : 'border-gray-200'}`}
            disabled={!!week}>
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
          <Download size={14} /> {exporting ? 'Mengekspor...' : 'Export LK'}
        </Button>
        <Button size="sm" variant="outline" onClick={exportIW49} disabled={exportingIW49} className="gap-1.5 border-blue-300 text-blue-700 hover:bg-blue-50">
          <Download size={14} /> {exportingIW49 ? 'Mengekspor...' : 'Export IW49 (SAP)'}
        </Button>
      </div>

      {/* Table */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              {['SPK Number', 'Kategori', 'Work Start', 'Work Finish', 'Duration (menit)', 'Evaluasi', 'Photos', 'Lokasi'].map((h) => (
                <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading ? (
              <tr><td colSpan={8} className="px-4 py-8 text-center text-gray-400">Memuat...</td></tr>
            ) : displayed.length === 0 ? (
              <tr><td colSpan={8} className="px-4 py-8 text-center text-gray-400">Belum ada submissions</td></tr>
            ) : displayed.map((s) => (
              <tr key={s.id} onClick={() => setDetail(s)}
                className="cursor-pointer hover:bg-gray-50 transition-colors">
                <td className="px-4 py-3 font-medium text-gray-900">{s.spkNumber}</td>
                <td className="px-4 py-3">{s.spkCategory ? <CategoryBadge category={s.spkCategory} /> : '—'}</td>
                <td className="px-4 py-3 text-gray-600 text-xs">{s.workStart ? formatDate(s.workStart) : '—'}</td>
                <td className="px-4 py-3 text-gray-600 text-xs">{formatDate(s.submittedAt)}</td>
                <td className="px-4 py-3 text-gray-600">{s.durationActual ?? '—'}</td>
                <td className="px-4 py-3 text-gray-600 max-w-[180px] truncate">{s.evaluasi || '—'}</td>
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
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <div className="flex items-center gap-2 flex-wrap">
              <DialogTitle>Detail — {detail?.spkNumber}</DialogTitle>
              {detail?.spkCategory && <CategoryBadge category={detail.spkCategory} />}
            </div>
            {detail?.spkDescription && (
              <p className="text-sm text-gray-500 mt-1">{detail.spkDescription}</p>
            )}
          </DialogHeader>

          {detail && (
            <div className="space-y-5 mt-2">
              {/* Timing + executor */}
              <div className="grid grid-cols-2 gap-3 bg-gray-50 border border-gray-200 rounded-lg p-4">
                <InfoField label="Work Start" value={detail.workStart ? formatDate(detail.workStart) : '—'} />
                <InfoField label="Work Finish" value={formatDate(detail.submittedAt)} />
                <InfoField label="Durasi Aktual" value={detail.durationActual != null ? `${detail.durationActual} menit` : '—'} />
                <InfoField label="Dilaksanakan Oleh" value={userMap[detail.spkSubmittedBy] || detail.spkSubmittedBy || '—'} />
              </div>

              {/* Evaluasi */}
              {detail.evaluasi && (
                <div>
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Evaluasi</p>
                  <p className="text-sm text-gray-700 bg-gray-50 border border-gray-200 rounded-lg p-3">{detail.evaluasi}</p>
                </div>
              )}

              {/* GPS */}
              {detail.latitude != null && (
                <div>
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Lokasi GPS</p>
                  <a href={`https://maps.google.com/?q=${detail.latitude},${detail.longitude}`}
                    target="_blank" rel="noreferrer"
                    className="inline-flex items-center gap-1.5 text-sm text-blue-600 hover:underline">
                    <MapPin size={13} />
                    {parseFloat(detail.latitude).toFixed(6)}, {parseFloat(detail.longitude).toFixed(6)}
                  </a>
                </div>
              )}

              {/* Activity results */}
              {detail.activityResultsModel?.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
                    Hasil Aktivitas ({detail.activityResultsModel.length})
                  </p>
                  <div className="border border-gray-200 rounded-lg overflow-hidden">
                    <table className="w-full text-xs">
                      <thead className="bg-gray-50 border-b border-gray-200">
                        <tr>
                          {['Aktivitas', 'Catatan', 'Status', 'Verified'].map((h) => (
                            <th key={h} className="px-3 py-2 text-left font-semibold text-gray-600">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {detail.activityResultsModel.map((a) => (
                          <tr key={a.activityNumber}>
                            <td className="px-3 py-2">
                              <p className="font-semibold text-gray-800">{a.activityNumber}</p>
                              {a.operationText && <p className="text-gray-500 mt-0.5 leading-snug">{a.operationText}</p>}
                            </td>
                            <td className="px-3 py-2 text-gray-600 max-w-[160px]">{a.resultComment || '—'}</td>
                            <td className="px-3 py-2">
                              <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-semibold ${a.isNormal ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
                                {a.isNormal ? 'Normal' : 'Abnormal'}
                              </span>
                            </td>
                            <td className="px-3 py-2">
                              <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-semibold ${a.isVerified ? 'bg-blue-50 text-blue-700' : 'bg-gray-100 text-gray-500'}`}>
                                {a.isVerified ? '✓ Ya' : '—'}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Photos */}
              {detail.photoPaths?.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
                    Foto ({detail.photoPaths.length})
                  </p>
                  <div className="grid grid-cols-3 gap-2">
                    {detail.photoPaths.map((path, i) => (
                      <a key={i} href={`${UPLOADS_BASE}/${path.replace(/^\//, '')}`} target="_blank" rel="noreferrer"
                        className="block aspect-square rounded-lg overflow-hidden border border-gray-200 hover:opacity-80 transition-opacity">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={`${UPLOADS_BASE}/${path.replace(/^\//, '')}`} alt={`Foto ${i + 1}`} className="w-full h-full object-cover" />
                      </a>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          <DialogFooter className="mt-4">
            <Button variant="ghost" onClick={() => setDetail(null)}>Tutup</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function InfoField({ label, value }) {
  return (
    <div>
      <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide">{label}</p>
      <p className="text-sm font-medium text-gray-800 mt-0.5">{value}</p>
    </div>
  );
}
