'use client';

import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { apiGet, apiPost } from '@/lib/api';
import { CATEGORIES } from '@/lib/constants';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { ChevronDown, Check, Printer, X } from 'lucide-react';
import { cn } from '@/lib/utils';

// ── Date helpers ──────────────────────────────────────────────────────────────
function getWeekDateRange(week, year) {
  const jan4 = new Date(year, 0, 4);
  const jan4Day = jan4.getDay() || 7;
  const week1Mon = new Date(jan4);
  week1Mon.setDate(jan4.getDate() - (jan4Day - 1));
  const start = new Date(week1Mon);
  start.setDate(week1Mon.getDate() + (week - 1) * 7);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  return { start, end };
}
function fmtDate(d) {
  return d.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });
}
function getCurrentWeek() {
  const now = new Date();
  const jan4 = new Date(now.getFullYear(), 0, 4);
  const jan4Day = jan4.getDay() || 7;
  const diff = Math.floor((now - jan4) / 86400000) + (jan4Day - 1);
  return Math.min(53, Math.max(1, Math.ceil((diff + 1) / 7)));
}

// ── Shared print style constants ──────────────────────────────────────────────
export const HEADER_BG    = '#1b3a5c';
export const BORDER       = '1px solid #a0a0a0';
export const TITLE_BORDER = '2px solid #1b3a5c';
export const EQUIP_ROW_BG = '#e8eef7';
export const SIG_HDR_BG   = '#f0f4f8';

const curYear    = new Date().getFullYear();
const YEARS      = Array.from({ length: 13 }, (_, i) => curYear - 2 + i);
const WEEKS      = Array.from({ length: 53 }, (_, i) => i + 1);
const EQ_PAGE_SIZE = 20;

// ── LK columns (matches submission export exactly) ────────────────────────────
const LK_COLS = [
  { label: 'Order / No. Aktivitas', w: '13%' },
  { label: 'Deskripsi / Uraian Pekerjaan', w: '24%' },
  { label: 'Interval', w: '7%' },
  { label: 'Equipment', w: '14%' },
  { label: 'Lokasi', w: '12%' },
  { label: 'Latitude', w: '7%' },
  { label: 'Longitude', w: '7%' },
  { label: 'Result Comment', w: '8%' },
  { label: 'Durasi Aktual (mnt)', w: '5%' },
  { label: 'Durasi Rencana (mnt)', w: '5%' },
  { label: 'Verifikasi', w: '5%' },
];

export default function SpkGeneratePage() {
  const [category, setCategory]     = useState('');
  const [year, setYear]             = useState(curYear);
  const [week, setWeek]             = useState(getCurrentWeek());
  const [activeIntervals, setActiveIntervals] = useState([]);
  const [equipment, setEquipment]   = useState([]);
  const [mappings, setMappings]     = useState([]);
  const [taskLists, setTaskLists]   = useState([]);
  const [selectedEq, setSelectedEq] = useState([]);
  const [search, setSearch]         = useState('');
  const [eqPage, setEqPage]         = useState(0);
  const [loadingIntervals, setLoadingIntervals] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [expandedEq, setExpandedEq] = useState({});

  useEffect(() => { setEqPage(0); }, [search, category]);

  useEffect(() => {
    async function fetchIntervals() {
      setLoadingIntervals(true);
      try {
        const data = await apiGet(`/preventive-schedule?year=${year}&week=${week}`);
        setActiveIntervals(data.activeIntervals || []);
      } catch { setActiveIntervals([]); }
      finally { setLoadingIntervals(false); }
    }
    fetchIntervals();
  }, [year, week]);

  useEffect(() => {
    if (!category) { setEquipment([]); setSelectedEq([]); return; }
    async function fetchEquipment() {
      try {
        const [eqRes, mapRes, tlRes] = await Promise.all([
          apiGet(`/equipment?category=${encodeURIComponent(category)}&limit=9999`),
          mappings.length ? Promise.resolve(mappings) : apiGet('/equipment-mappings'),
          taskLists.length ? Promise.resolve(taskLists) : apiGet('/task-lists'),
        ]);
        setEquipment(eqRes.data || eqRes);
        setMappings(Array.isArray(mapRes) ? mapRes : mappings);
        setTaskLists(Array.isArray(tlRes) ? tlRes : taskLists);
        setSelectedEq([]);
      } catch (e) { toast.error('Gagal memuat equipment: ' + e.message); }
    }
    fetchEquipment();
  }, [category]); // eslint-disable-line react-hooks/exhaustive-deps

  function getMappingsForEquipment(eqId) { return mappings.filter((m) => m.equipmentId === eqId); }
  function isMapped(eqId) { return getMappingsForEquipment(eqId).some((m) => activeIntervals.includes(m.interval)); }
  function getTaskList(tlId) { return taskLists.find((tl) => tl.taskListId === tlId); }

  const filtered  = equipment.filter((eq) => {
    const q = search.toLowerCase();
    return !q || eq.equipmentId?.toLowerCase().includes(q) || eq.equipmentName?.toLowerCase().includes(q);
  });
  const mapped    = filtered.filter((eq) => isMapped(eq.equipmentId));
  const unmapped  = filtered.filter((eq) => !isMapped(eq.equipmentId));
  const combined  = [...mapped, ...unmapped];
  const totalPages = Math.ceil(combined.length / EQ_PAGE_SIZE);
  const paged     = combined.slice(eqPage * EQ_PAGE_SIZE, (eqPage + 1) * EQ_PAGE_SIZE);
  const pagedMapped   = paged.filter((eq) => isMapped(eq.equipmentId));
  const pagedUnmapped = paged.filter((eq) => !isMapped(eq.equipmentId));

  function toggleEq(id) {
    setSelectedEq((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);
  }
  function selectAllMapped() { setSelectedEq(mapped.map((eq) => eq.equipmentId)); }
  function clearAll() { setSelectedEq([]); }

  const { start: weekStart, end: weekEnd } = getWeekDateRange(week, year);
  const printDate = new Date().toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' });

  // ── Build LK print groups ─────────────────────────────────────────────────
  // One group per (equipment × interval), each group has activity rows from task list
  const lkGroups = selectedEq.flatMap((eqId) => {
    const eq = equipment.find((e) => e.equipmentId === eqId);
    return activeIntervals
      .filter((iv) => getMappingsForEquipment(eqId).some((m) => m.interval === iv))
      .map((iv) => {
        const mapping  = getMappingsForEquipment(eqId).find((m) => m.interval === iv);
        const taskList = getTaskList(mapping?.taskListId);
        const activities = taskList?.activities || [];
        return { eq, eqId, iv, taskList, activities };
      });
  });
  const totalSpk = lkGroups.length;
  const totalActivities = lkGroups.reduce((s, g) => s + g.activities.length, 0);

  async function generate() {
    if (!category)          { toast.error('Pilih kategori terlebih dahulu'); return; }
    if (!selectedEq.length) { toast.error('Pilih equipment terlebih dahulu'); return; }
    if (!activeIntervals.length) { toast.error('Tidak ada interval aktif untuk minggu ini'); return; }
    setGenerating(true);
    try {
      let totalCreated = 0;
      for (const interval of activeIntervals) {
        const eqWithInterval = selectedEq.filter((id) =>
          getMappingsForEquipment(id).some((m) => m.interval === interval)
        );
        if (!eqWithInterval.length) continue;
        const res = await apiPost('/spk/batch-generate', { week, year, interval, category, equipmentIds: eqWithInterval });
        totalCreated += Array.isArray(res.created) ? res.created.length : (res.created || 0);
      }
      toast.success(`${totalCreated} SPK berhasil dibuat`);
      setSelectedEq([]);
      setPreviewOpen(false);
    } catch (e) { toast.error('Gagal generate: ' + e.message); }
    finally { setGenerating(false); }
  }

  // ── Print via Blob window ─────────────────────────────────────────────────
  function handlePrint() {
    const el = document.getElementById('spk-lk-print-doc');
    if (!el) return;
    const style = [
      '* { box-sizing: border-box; margin: 0; padding: 0; }',
      'body { font-family: Arial, sans-serif; font-size: 9pt; background: white; padding: 16px 20px; }',
      'table { border-collapse: collapse; width: 100%; }',
      '@media print { -webkit-print-color-adjust: exact; print-color-adjust: exact; }',
      '@page { margin: 8mm 10mm; size: A4 landscape; }',
    ].join('');
    const blob = new Blob(
      ['<!DOCTYPE html><html><head><title>Lembar Kerja SPK</title><style>', style, '</style></head><body>', el.innerHTML, '</body></html>'],
      { type: 'text/html' }
    );
    const url = URL.createObjectURL(blob);
    const win = window.open(url, '_blank');
    win.addEventListener('load', () => { win.print(); URL.revokeObjectURL(url); });
  }

  return (
    <div className="p-6 space-y-5">
      <div>
        <h2 className="text-xl font-semibold text-gray-800">Generate SPK</h2>
        <p className="text-sm text-gray-500">Buat SPK batch dari jadwal preventive</p>
      </div>

      {/* Category cards */}
      <div>
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Kategori</p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {CATEGORIES.map((cat) => (
            <button key={cat} onClick={() => setCategory(cat)}
              className={cn('p-4 rounded-xl border-2 text-sm font-semibold transition-colors text-left',
                category === cat ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300')}>
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Week / year */}
      <div className="flex flex-wrap items-end gap-3 p-4 bg-gray-50 border border-gray-200 rounded-xl">
        <div className="flex flex-col gap-1">
          <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Tahun</label>
          <select value={year} onChange={(e) => setYear(parseInt(e.target.value))}
            className="px-2.5 py-1.5 border border-gray-200 rounded-lg text-sm bg-white">
            {YEARS.map((y) => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Minggu</label>
          <select value={week} onChange={(e) => setWeek(parseInt(e.target.value))}
            className="px-2.5 py-1.5 border border-gray-200 rounded-lg text-sm bg-white">
            {WEEKS.map((w) => <option key={w} value={w}>{w}</option>)}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Rentang</label>
          <span className="text-sm text-gray-600 py-1.5">{fmtDate(weekStart)} – {fmtDate(weekEnd)}</span>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Interval Aktif</label>
          <div className="flex gap-1.5 flex-wrap">
            {loadingIntervals ? <span className="text-xs text-gray-400">Memuat...</span>
              : activeIntervals.length === 0 ? <span className="text-xs text-gray-400">Tidak ada</span>
              : activeIntervals.map((iv) => (
                <span key={iv} className="px-2 py-0.5 bg-blue-600 text-white text-xs rounded font-medium">{iv}</span>
              ))}
          </div>
        </div>
      </div>

      {/* Equipment list */}
      {category && (
        <div className="space-y-3">
          <div className="flex items-center gap-3 flex-wrap">
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Cari equipment..."
              className="flex-1 max-w-sm px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30" />
            <Button variant="outline" size="sm" onClick={selectAllMapped}>Pilih Semua Mapped</Button>
            <Button variant="ghost" size="sm" onClick={clearAll}>Hapus Pilihan</Button>
            <span className="text-sm text-gray-600 ml-auto">{selectedEq.length} dipilih</span>
          </div>

          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
            {pagedMapped.length > 0 && (
              <>
                <div className="px-4 py-2 bg-green-50 border-b border-gray-200 text-xs font-semibold text-green-700">
                  Mapped ({mapped.length})
                </div>
                {pagedMapped.map((eq) => (
                  <EquipmentRow key={eq.equipmentId} eq={eq} selected={selectedEq.includes(eq.equipmentId)}
                    onToggle={() => toggleEq(eq.equipmentId)}
                    mappings={getMappingsForEquipment(eq.equipmentId)}
                    activeIntervals={activeIntervals}
                    expanded={!!expandedEq[eq.equipmentId]}
                    onToggleExpand={() => setExpandedEq((p) => ({ ...p, [eq.equipmentId]: !p[eq.equipmentId] }))} />
                ))}
              </>
            )}
            {pagedUnmapped.length > 0 && (
              <>
                <div className="px-4 py-2 bg-gray-50 border-t border-b border-gray-200 text-xs font-semibold text-gray-500">
                  Unmapped ({unmapped.length}) — tidak akan di-generate
                </div>
                {pagedUnmapped.map((eq) => (
                  <EquipmentRow key={eq.equipmentId} eq={eq} selected={false} disabled
                    mappings={getMappingsForEquipment(eq.equipmentId)}
                    activeIntervals={activeIntervals}
                    expanded={!!expandedEq[eq.equipmentId]}
                    onToggleExpand={() => setExpandedEq((p) => ({ ...p, [eq.equipmentId]: !p[eq.equipmentId] }))} />
                ))}
              </>
            )}
            {combined.length === 0 && (
              <div className="px-4 py-8 text-center text-gray-400 text-sm">Tidak ada equipment ditemukan</div>
            )}
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-between">
              <span className="text-xs text-gray-500">
                Menampilkan {eqPage * EQ_PAGE_SIZE + 1}–{Math.min((eqPage + 1) * EQ_PAGE_SIZE, combined.length)} dari {combined.length} equipment
              </span>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" disabled={eqPage === 0} onClick={() => setEqPage((p) => p - 1)}>Prev</Button>
                <span className="text-sm text-gray-600">{eqPage + 1} / {totalPages}</span>
                <Button variant="outline" size="sm" disabled={eqPage >= totalPages - 1} onClick={() => setEqPage((p) => p + 1)}>Next</Button>
              </div>
            </div>
          )}
        </div>
      )}

      <div className="flex justify-end gap-3">
        {selectedEq.length > 0 && (
          <Button variant="outline" onClick={() => setPreviewOpen(true)}>Preview & Print</Button>
        )}
        <Button onClick={generate} disabled={generating || !selectedEq.length || !activeIntervals.length}>
          {generating ? 'Generating...' : `Generate ${selectedEq.length} SPK`}
        </Button>
      </div>

      {/* ── LK Print Preview Dialog ───────────────────────────────────────── */}
      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent showCloseButton={false} className="w-[98vw] max-w-[98vw] sm:max-w-[98vw] h-[97vh] max-h-[97vh] p-0 gap-0 overflow-hidden flex flex-col">
          {/* Toolbar */}
          <div className="flex items-center justify-between px-4 py-2.5 border-b border-gray-200 bg-gray-50 shrink-0">
            <span className="text-sm font-semibold text-gray-700">
              Lembar Kerja Preview — Minggu {week}/{year} · {totalSpk} SPK · {totalActivities} aktivitas
            </span>
            <div className="flex gap-2">
              <Button size="sm" onClick={handlePrint} className="gap-1.5"><Printer size={13} /> Cetak</Button>
              <Button onClick={generate} disabled={generating} size="sm">
                {generating ? 'Generating...' : 'Generate'}
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setPreviewOpen(false)}><X size={14} /></Button>
            </div>
          </div>

          {/* Scrollable A4 document */}
          <div className="overflow-y-auto flex-1">
            <div id="spk-lk-print-doc" style={{ fontFamily: 'Arial, sans-serif', fontSize: '9pt', padding: '16px 24px', background: 'white', minHeight: '100%' }}>

              {/* ── Title block ── */}
              <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '2px' }}>
                <tbody>
                  <tr>
                    <td style={{ border: TITLE_BORDER, textAlign: 'center', fontWeight: 'bold', fontSize: '12pt', padding: '7px', letterSpacing: '0.5px', width: '75%' }}>
                      LEMBAR KERJA PREVENTIVE MAINTENANCE
                    </td>
                    <td style={{ border: TITLE_BORDER, borderLeft: 'none', padding: '7px', fontSize: '9pt', verticalAlign: 'top', width: '25%' }}>
                      <div>Periode: Minggu {week} / {year}</div>
                      <div>{fmtDate(weekStart)} – {fmtDate(weekEnd)}</div>
                    </td>
                  </tr>
                  <tr>
                    <td colSpan={2} style={{ border: TITLE_BORDER, borderTop: 'none', padding: '4px 8px', fontSize: '9pt' }}>
                      <span style={{ marginRight: '20px' }}>Kategori: <strong>{category}</strong></span>
                      <span style={{ marginRight: '20px' }}>Interval Aktif: <strong>{activeIntervals.join(', ') || '—'}</strong></span>
                      <span style={{ marginRight: '20px' }}>Total SPK: <strong>{totalSpk}</strong></span>
                      <span>Total Aktivitas: <strong>{totalActivities}</strong></span>
                    </td>
                  </tr>
                </tbody>
              </table>

              {/* ── LK main table ── */}
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ backgroundColor: HEADER_BG, color: 'white' }}>
                    {LK_COLS.map(({ label, w }) => (
                      <th key={label} style={{ border: BORDER, borderColor: '#2a5080', padding: '5px 5px', textAlign: 'center', fontWeight: 'bold', fontSize: '8pt', width: w, lineHeight: '1.2' }}>
                        {label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {lkGroups.map(({ eq, eqId, iv, taskList, activities }, gi) => (
                    <>
                      {/* Equipment header row */}
                      <tr key={`hdr-${gi}`} style={{ backgroundColor: EQUIP_ROW_BG }}>
                        <td style={{ border: BORDER, padding: '4px 5px', fontWeight: 'bold', fontSize: '9pt' }}>{eqId}</td>
                        <td style={{ border: BORDER, padding: '4px 5px', fontWeight: 'bold', fontSize: '9pt' }}>
                          {taskList ? `${taskList.taskListId} — ${taskList.taskListName}` : '(tidak ada task list)'}
                        </td>
                        <td style={{ border: BORDER, padding: '4px 5px', textAlign: 'center', fontWeight: 'bold' }}>{iv}</td>
                        <td style={{ border: BORDER, padding: '4px 5px' }}>{eq?.equipmentName || eqId}</td>
                        <td colSpan={7} style={{ border: BORDER, padding: '4px 5px', color: '#555' }}>
                          {eq?.functionalLocationId || '—'}
                        </td>
                      </tr>
                      {/* Activity rows */}
                      {activities.length === 0 ? (
                        <tr key={`empty-${gi}`}>
                          <td colSpan={11} style={{ border: BORDER, padding: '4px 5px', color: '#999', fontStyle: 'italic', fontSize: '8pt' }}>
                            Tidak ada aktivitas dalam task list ini
                          </td>
                        </tr>
                      ) : activities.map((act, ai) => (
                        <tr key={`act-${gi}-${ai}`} style={{ backgroundColor: ai % 2 === 0 ? '#ffffff' : '#f9fbff' }}>
                          <td style={{ border: BORDER, padding: '4px 5px', textAlign: 'center', fontSize: '8pt', color: '#555' }}>
                            {act.stepNumber || (ai + 1)}
                          </td>
                          <td style={{ border: BORDER, padding: '4px 5px', fontSize: '9pt' }}>
                            {act.operationText || '—'}
                          </td>
                          <td style={{ border: BORDER, padding: '4px 5px', textAlign: 'center' }}>{iv}</td>
                          <td style={{ border: BORDER, padding: '4px 5px', fontSize: '8.5pt' }}>{eq?.equipmentName || eqId}</td>
                          <td style={{ border: BORDER, padding: '4px 5px', fontSize: '8pt', color: '#555' }}>{eq?.functionalLocationId || '—'}</td>
                          <td style={{ border: BORDER, padding: '4px 5px', fontSize: '8pt', textAlign: 'right', color: '#555' }}>{eq?.latitude ?? ''}</td>
                          <td style={{ border: BORDER, padding: '4px 5px', fontSize: '8pt', textAlign: 'right', color: '#555' }}>{eq?.longitude ?? ''}</td>
                          <td style={{ border: BORDER, padding: '4px 5px' }}></td>
                          <td style={{ border: BORDER, padding: '4px 5px', textAlign: 'center' }}></td>
                          <td style={{ border: BORDER, padding: '4px 5px', textAlign: 'center', fontSize: '8pt' }}>
                            {act.durationPlan || '—'}
                          </td>
                          <td style={{ border: BORDER, padding: '4px 5px', textAlign: 'center' }}>□</td>
                        </tr>
                      ))}
                    </>
                  ))}
                </tbody>
              </table>

              {/* ── Signature footer ── */}
              <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '28px' }}>
                <tbody>
                  <tr>
                    {[`Tanggal: ${fmtDate(weekStart)}`, 'Tanggal:', 'Tanggal:', 'Tanggal:'].map((label, i) => (
                      <td key={i} style={{ width: '25%', padding: '0 4px 4px', fontSize: '9pt' }}>{label}</td>
                    ))}
                  </tr>
                  <tr>
                    {['Dilaksanakan', 'Mengetahui (Kasie)', 'Disetujui (Kadis Perawatan)', 'Dievaluasi (Kadis)'].map((label, i) => (
                      <td key={i} style={{ border: BORDER, textAlign: 'center', padding: '4px', fontWeight: 'bold', fontSize: '9pt', backgroundColor: SIG_HDR_BG }}>
                        {label}
                      </td>
                    ))}
                  </tr>
                  <tr>
                    {Array.from({ length: 4 }).map((_, i) => (
                      <td key={i} style={{ border: BORDER, borderTop: 'none', height: '56px', padding: '4px' }}></td>
                    ))}
                  </tr>
                </tbody>
              </table>

              <div style={{ marginTop: '10px', fontSize: '8pt', color: '#999', textAlign: 'right' }}>
                Dicetak: {printDate} · MANTIS PPHSE
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function EquipmentRow({ eq, selected, onToggle, mappings, activeIntervals, disabled, expanded, onToggleExpand }) {
  const activeMappings = mappings.filter((m) => activeIntervals.includes(m.interval));
  return (
    <div className={cn('border-b border-gray-100', disabled && 'opacity-50')}>
      <div className="flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50">
        <input type="checkbox" checked={selected} onChange={onToggle} disabled={disabled} className="rounded border-gray-300 shrink-0" />
        <button onClick={onToggleExpand} className="shrink-0">
          <ChevronDown size={12} className={cn('text-gray-400 transition-transform', expanded && 'rotate-180')} />
        </button>
        <div className="flex-1 min-w-0">
          <span className="text-xs font-mono font-semibold text-gray-700">{eq.equipmentId}</span>
          <span className="text-xs text-gray-500 ml-2 truncate">{eq.equipmentName}</span>
        </div>
        <div className="flex gap-1 flex-wrap">
          {activeMappings.map((m) => (
            <span key={m.interval} className="px-1.5 py-0.5 bg-blue-100 text-blue-700 text-[10px] font-semibold rounded">{m.interval}</span>
          ))}
        </div>
        {selected && <Check size={14} className="text-blue-600 shrink-0" />}
      </div>
      {expanded && (
        <div className="px-12 pb-2.5 space-y-1">
          {mappings.length === 0
            ? <p className="text-xs text-gray-400 italic">Tidak ada mapping</p>
            : mappings.map((m) => (
              <div key={m.id} className="flex gap-2 text-xs text-gray-600">
                <span className="font-medium w-12 shrink-0">{m.interval}</span>
                <span className="text-gray-400">{m.taskListId || 'No task list'}</span>
              </div>
            ))}
        </div>
      )}
    </div>
  );
}
