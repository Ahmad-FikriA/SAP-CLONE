'use client';

import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { apiGet, apiBlob } from '@/lib/api';
import { formatDate } from '@/lib/date-utils';
import { CATEGORIES } from '@/lib/constants';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { CategoryBadge } from '@/components/shared/StatusBadge';
import { RefreshCw, Download, MapPin, X, CheckCircle } from 'lucide-react';

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
  return Array.from({ length: 53 }, (_, i) => i + 1);
}

function detectMeasurementUnit(operationText) {
  if (!operationText) return null;
  const t = operationText;
  const l = t.toLowerCase();
  if (t.includes('°C') || t.includes('ºC')) return '°C';
  if (t.includes('mm/s')) return 'mm/s';
  if (t.includes('m3/h')) return 'm3/h';
  if (/bar/i.test(t)) return 'bar';
  if (t.includes('NTU')) return 'NTU';
  if (t.includes('pH')) return 'pH';
  if (/\bOhm\b/i.test(t)) return 'Ohm';
  if (/[.\s]\s*%/.test(t)) return '%';
  if (/[.(]\s*A\s*[).]|\.\.\s*A\b/.test(t)) return 'A';
  if (/[.(]\s*V\s*[).]|\.\.\s*V\b/.test(t)) return 'V';
  if (l.includes('temperatur') || l.includes('suhu')) return '°C';
  if (l.includes('vibrasi') || l.includes('vibration')) return 'mm/s';
  if (l.includes('tekanan') || l.includes('pressure')) return 'bar';
  if (l.includes('ampere') || l.includes('arus')) return 'A';
  if (l.includes('tegangan') || l.includes('voltage')) return 'V';
  if (l.includes('turbid') || l.includes('kekeruhan')) return 'NTU';
  return null;
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
  const [lightbox, setLightbox] = useState(null);
  const [page, setPage]             = useState(1);
  const [total, setTotal]           = useState(0);
  const [totalPages, setTotalPages] = useState(0);

  useEffect(() => {
    apiGet('/users').then(users => {
      setUserMap(Object.fromEntries(users.map(u => [u.id, u.name || u.nik])));
    }).catch(() => {});
  }, []);

  useEffect(() => {
    load();
  }, [year, month, week, category, page]); // eslint-disable-line react-hooks/exhaustive-deps

  async function load() {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (year)  params.set('year', year);
      if (week)  params.set('week', week);
      else if (month) params.set('month', month);
      if (category) params.set('category', category);
      params.set('page', String(page));
      params.set('limit', '20');
      const res = await apiGet(`/submissions?${params}`);
      setSubs(res.data);
      setTotal(res.total);
      setTotalPages(res.totalPages);
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

  const years = buildYears();
  const weeks = buildWeeks();

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-xl font-semibold text-gray-800">Submissions Log</h2>
          <p className="text-sm text-gray-500">
            {total === 0
              ? 'Tidak ada submissions'
              : `Menampilkan ${(page - 1) * 20 + 1}–${Math.min(page * 20, total)} dari ${total} submissions`
            }
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
          <select value={year} onChange={(e) => { setYear(e.target.value); setPage(1); }}
            className="px-2.5 py-1.5 border border-gray-200 rounded-md text-sm bg-white min-w-[80px]">
            {years.map((y) => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide">Minggu</label>
          <select value={week} onChange={(e) => { setWeek(e.target.value); if (e.target.value) setMonth(''); setPage(1); }}
            className="px-2.5 py-1.5 border border-gray-200 rounded-md text-sm bg-white min-w-[110px]">
            <option value="">Semua Minggu</option>
            {weeks.map((w) => <option key={w} value={w}>Minggu {w}</option>)}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label className={`text-[11px] font-semibold uppercase tracking-wide ${week ? 'text-gray-300' : 'text-gray-500'}`}>
            Bulan {week ? <span className="normal-case font-normal">(nonaktif saat minggu dipilih)</span> : ''}
          </label>
          <select value={month} onChange={(e) => { setMonth(e.target.value); if (e.target.value) setWeek(''); setPage(1); }}
            className={`px-2.5 py-1.5 border rounded-md text-sm bg-white min-w-[120px] transition-colors ${week ? 'border-gray-100 text-gray-300 cursor-not-allowed bg-gray-50' : 'border-gray-200'}`}
            disabled={!!week}>
            {MONTHS.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide">Kategori</label>
          <select value={category} onChange={(e) => { setCategory(e.target.value); setPage(1); }}
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
            ) : subs.length === 0 ? (
              <tr><td colSpan={8} className="px-4 py-8 text-center text-gray-400">Belum ada submissions</td></tr>
            ) : subs.map((s) => (
              <tr key={s.id} onClick={() => setDetail(s)}
                className="cursor-pointer hover:bg-gray-50 transition-colors">
                <td className="px-4 py-3 font-medium text-gray-900">{s.spkNumber}</td>
                <td className="px-4 py-3">{s.spkCategory ? <CategoryBadge category={s.spkCategory} /> : '—'}</td>
                <td className="px-4 py-3 text-gray-600 text-xs">{s.workStart ? formatDate(s.workStart) : '—'}</td>
                <td className="px-4 py-3 text-gray-600 text-xs">{s.submittedAt ? formatDate(s.submittedAt) : '—'}</td>
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

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-4 py-3">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage(p => p - 1)}
            disabled={page === 1}
            className="gap-1.5"
          >
            ← Prev
          </Button>
          <span className="text-sm text-gray-600 font-medium">
            Halaman {page} dari {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage(p => p + 1)}
            disabled={page === totalPages}
            className="gap-1.5"
          >
            Next →
          </Button>
        </div>
      )}

      {/* Detail dialog */}
      <Dialog open={!!detail} onOpenChange={(open) => !open && setDetail(null)}>
        <DialogContent className="w-[95vw] max-w-5xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <div className="flex items-center gap-2 flex-wrap">
              <DialogTitle className="font-mono">{detail?.spkNumber}</DialogTitle>
              {detail?.spkCategory && <CategoryBadge category={detail.spkCategory} />}
            </div>
            {detail?.spkDescription && (
              <p className="text-sm text-gray-500 mt-1">{detail.spkDescription}</p>
            )}
          </DialogHeader>

          {detail && (
            <div className="space-y-4 mt-2">

              {/* Equipment */}
              {detail.spkEquipmentModels?.length > 0 && (
                <DetailSection title="Equipment">
                  <div className="divide-y divide-gray-100">
                    {detail.spkEquipmentModels.map((e) => (
                      <div key={e.equipmentId} className="py-2.5 flex items-center justify-between text-sm">
                        <div>
                          <span className="font-medium text-gray-800">{e.equipmentName || e.equipmentId}</span>
                          <span className="ml-2 text-xs text-gray-400 font-mono">{e.functionalLocation}</span>
                        </div>
                        <span className="text-xs text-gray-400">{e.plantName || '—'}</span>
                      </div>
                    ))}
                  </div>
                </DetailSection>
              )}

              {/* Activity Results */}
              {detail.activityResultsModel?.length > 0 && (
                <DetailSection title={`Hasil Kegiatan (${detail.activityResultsModel.length} aktivitas)`}>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-gray-200">
                          {['No. Aktivitas', 'Uraian Pekerjaan', 'Rencana', 'Komentar Hasil', 'Nilai Ukur', 'Status'].map((h) => (
                            <th key={h} className="text-left py-2 pr-4 text-xs font-semibold text-gray-500 uppercase tracking-wide last:text-center">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {detail.activityResultsModel.map((a) => (
                          <tr key={a.activityNumber} className="hover:bg-gray-50">
                            <td className="py-2 pr-4 font-mono text-xs text-gray-500">{a.activityNumber}</td>
                            <td className="py-2 pr-4 text-gray-700 max-w-[200px]">{a.operationText || '—'}</td>
                            <td className="py-2 pr-4 text-gray-500 whitespace-nowrap">{a.durationPlan ? `${a.durationPlan} mnt` : '—'}</td>
                            <td className="py-2 pr-4 text-gray-600 max-w-[180px]">{a.resultComment || <span className="text-gray-300">—</span>}</td>
                            <td className="py-2 pr-4 font-mono text-sm text-gray-700 whitespace-nowrap">
                              {a.measurementValue != null ? (() => {
                                const unit = a.measurementUnit || detectMeasurementUnit(a.operationText);
                                return `${a.measurementValue}${unit ? ' ' + unit : ''}`;
                              })() : <span className="text-gray-300">—</span>}
                            </td>
                            <td className="py-2 text-center">
                              {a.isNormal == null
                                ? <span className="text-gray-300">—</span>
                                : a.isNormal
                                  ? <span className="px-2 py-0.5 rounded text-xs font-semibold bg-green-100 text-green-700">Normal</span>
                                  : <span className="px-2 py-0.5 rounded text-xs font-semibold bg-red-100 text-red-600">Tidak Normal</span>
                              }
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </DetailSection>
              )}

              {/* Field Notes */}
              <DetailSection title="Catatan Lapangan">
                <div className="grid grid-cols-3 gap-4 text-sm">
                  <DetailInfo label="Work Start" value={detail.workStart ? formatDate(detail.workStart) : '—'} />
                  <DetailInfo label="Work Finish" value={detail.submittedAt ? formatDate(detail.submittedAt) : '—'} />
                  <DetailInfo label="Durasi Aktual" value={detail.durationActual != null ? `${detail.durationActual} menit` : '—'} />
                  <DetailInfo label="Dilaksanakan Oleh" value={userMap[detail.spkSubmittedBy] || detail.spkSubmittedBy || '—'} />
                  <DetailInfo label="Interval" value={detail.spkInterval || '—'} />
                  <DetailInfo label="Jadwal" value={detail.spkScheduledDate ? formatDate(detail.spkScheduledDate) : '—'} />
                  {detail.latitude != null && (
                    <div>
                      <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-0.5">Lokasi GPS</p>
                      <a href={`https://maps.google.com/?q=${detail.latitude},${detail.longitude}`}
                        target="_blank" rel="noreferrer"
                        className="inline-flex items-center gap-1.5 text-sm text-blue-600 hover:underline">
                        <MapPin size={13} />
                        {parseFloat(detail.latitude).toFixed(5)}, {parseFloat(detail.longitude).toFixed(5)}
                      </a>
                    </div>
                  )}
                  {detail.evaluasi && (
                    <div className="col-span-3">
                      <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-0.5">Evaluasi</p>
                      <p className="text-sm text-gray-700">{detail.evaluasi}</p>
                    </div>
                  )}
                </div>
              </DetailSection>

              {/* Photos */}
              <DetailSection title={`Foto Lapangan (${(detail.photoPaths || []).length})`}>
                {!detail.photoPaths?.length ? (
                  <p className="text-sm text-gray-400 py-1">Tidak ada foto</p>
                ) : (
                  <div className="grid grid-cols-4 gap-3">
                    {detail.photoPaths.map((path, i) => (
                      <button key={path} onClick={() => setLightbox(path)}
                        className="aspect-square rounded-lg overflow-hidden border border-gray-200 hover:border-blue-400 transition-colors">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={`${UPLOADS_BASE}/${path.replace(/^\//, '')}`} alt={`Foto ${i + 1}`}
                          className="w-full h-full object-cover"
                          onError={e => { e.target.style.display = 'none'; }} />
                      </button>
                    ))}
                  </div>
                )}
              </DetailSection>

              {/* Approval History */}
              <DetailSection title="Riwayat Persetujuan">
                <div className="space-y-2 text-sm">
                  <ApprovalRow
                    label="Submit"
                    by={userMap[detail.spkSubmittedBy] || detail.spkSubmittedBy}
                    at={detail.submittedAt}
                    done={!!detail.submittedAt}
                  />
                  <ApprovalRow
                    label={detail.spkCategory ? `Kasie ${detail.spkCategory}` : 'Kasie'}
                    by={userMap[detail.spkKasieApprovedBy] || detail.spkKasieApprovedBy}
                    at={detail.spkKasieApprovedAt}
                    done={!!detail.spkKasieApprovedAt}
                  />
                  <ApprovalRow
                    label="Kadis Perawatan"
                    by={userMap[detail.spkKadisPerawatanApprovedBy] || detail.spkKadisPerawatanApprovedBy}
                    at={detail.spkKadisPerawatanApprovedAt}
                    done={!!detail.spkKadisPerawatanApprovedAt}
                  />
                  <ApprovalRow
                    label="Kadis"
                    by={userMap[detail.spkKadisApprovedBy] || detail.spkKadisApprovedBy}
                    at={detail.spkKadisApprovedAt}
                    done={!!detail.spkKadisApprovedAt}
                  />
                </div>
              </DetailSection>

            </div>
          )}

          <DialogFooter className="mt-4">
            <Button variant="ghost" onClick={() => setDetail(null)}>Tutup</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Lightbox */}
      {lightbox && (
        <div className="fixed inset-0 z-[100] bg-black/80 flex items-center justify-center"
          onClick={() => setLightbox(null)}>
          <button className="absolute top-4 right-4 text-white/70 hover:text-white"
            onClick={() => setLightbox(null)}>
            <X size={24} />
          </button>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={`${UPLOADS_BASE}/${lightbox.replace(/^\//, '')}`}
            alt="Foto lapangan"
            className="max-h-[90vh] max-w-[90vw] object-contain rounded-lg"
            onClick={e => e.stopPropagation()}
          />
        </div>
      )}
    </div>
  );
}

function DetailSection({ title, children }) {
  return (
    <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
      <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">{title}</h4>
      {children}
    </div>
  );
}

function DetailInfo({ label, value }) {
  return (
    <div>
      <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-0.5">{label}</p>
      <p className="text-sm text-gray-700 break-words">{value}</p>
    </div>
  );
}

function ApprovalRow({ label, by, at, done }) {
  return (
    <div className="flex items-center gap-3 py-1.5">
      <div className={`w-4 h-4 rounded-full flex items-center justify-center shrink-0 ${done ? 'bg-green-500' : 'bg-gray-200'}`}>
        {done && <CheckCircle size={10} className="text-white" />}
      </div>
      <span className="w-48 text-gray-600 font-medium">{label}</span>
      {done ? (
        <span className="text-gray-500">{by || '—'} · {at ? formatDate(at) : '—'}</span>
      ) : (
        <span className="text-gray-300">Belum disetujui</span>
      )}
    </div>
  );
}
