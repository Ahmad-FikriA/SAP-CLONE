'use client';

import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { apiGet, apiPost } from '@/lib/api';
import { KADIS_AREAS } from '@/lib/constants';
import { FileUploadZone } from '@/components/shared/FileUploadZone';
import { Button } from '@/components/ui/button';
import { CategoryBadge } from '@/components/shared/StatusBadge';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Printer, X } from 'lucide-react';

const BASE = process.env.NEXT_PUBLIC_API_URL;
const INTERVALS = ['1wk', '2wk', '3wk', '4wk', '8wk', '12wk', '16wk', '24wk'];

const RESOLUTION_LABELS = { auto: 'Auto', ambiguous: 'Pilih', unknown: 'Manual', exists: 'Sudah Ada' };
const RESOLUTION_COLORS = {
  auto: 'bg-green-100 text-green-700',
  ambiguous: 'bg-yellow-100 text-yellow-700',
  unknown: 'bg-orange-100 text-orange-700',
  exists: 'bg-gray-100 text-gray-500',
};

const HEADER_BG    = '#1b3a5c';
const BORDER       = '1px solid #a0a0a0';
const TITLE_BORDER = '2px solid #1b3a5c';
const EQUIP_ROW_BG = '#e8eef7';
const SIG_HDR_BG   = '#f0f4f8';

export default function SpkImportPage() {
  const [orders, setOrders]           = useState([]);
  const [loading, setLoading]         = useState(false);
  const [confirming, setConfirming]   = useState(false);
  const [printOpen, setPrintOpen]     = useState(false);
  const [mappings, setMappings]       = useState([]);
  const [taskLists, setTaskLists]     = useState([]);
  const [locationCode, setLocationCode] = useState(null);   // raw code from Header tab
  const [apiKadisId, setApiKadisId]   = useState(null);     // detected by backend

  // Fetch task lists + mappings once
  useEffect(() => {
    async function load() {
      try {
        const [maps, tls] = await Promise.all([
          apiGet('/equipment-mappings'),
          apiGet('/task-lists'),
        ]);
        setMappings(Array.isArray(maps) ? maps : []);
        setTaskLists(Array.isArray(tls) ? tls : []);
      } catch { /* non-critical */ }
    }
    load();
  }, []);

  /** Extract level-2 funcLoc prefix from a raw funcLocId string.
   *  e.g. "A-A2-01-003-001" → "A-A2-01" */
  function getLevel2Prefix(funcLocId) {
    if (!funcLocId) return null;
    const parts = funcLocId.split('-');
    return parts.length >= 3 ? parts.slice(0, 3).join('-') : null;
  }

  /** Derive the Kadis area from the orders' functionalLocation fields.
   *  Picks whichever KADIS_AREAS entry's funcLocPrefixes match the most orders.
   *  This is called with `orders` as a computed value — no user input needed. */
  function deriveKadisArea(orderList) {
    const counts = {};
    for (const o of orderList) {
      const fl = o.functionalLocation || '';
      for (const area of KADIS_AREAS) {
        if (area.funcLocPrefixes.some((p) => fl.startsWith(p))) {
          counts[area.id] = (counts[area.id] || 0) + 1;
          break;
        }
      }
    }
    const top = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
    return top ? KADIS_AREAS.find((a) => a.id === top[0]) || null : null;
  }

  async function handleFile(file) {
    if (!file.name.endsWith('.xlsx')) { toast.error('Format harus .xlsx'); return; }
    setLoading(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const token = typeof window !== 'undefined' ? localStorage.getItem('token') : '';
      const res = await fetch(`${BASE}/api/spk/import-excel/preview`, {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: fd,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Preview gagal');
      const loadedOrders = data.orders || [];
      setOrders(loadedOrders);
      setLocationCode(data.locationCode || null);
      setApiKadisId(data.detectedKadisId || null);
    } catch (e) { toast.error('Gagal preview: ' + e.message); }
    finally { setLoading(false); }
  }

  function onIntervalChange(idx, interval) {
    setOrders((prev) => { const next = [...prev]; next[idx] = { ...next[idx], interval }; return next; });
  }

  const pendingCount = orders.filter((o) => !o.alreadyExists && o.intervalResolution !== 'auto' && !o.interval).length;
  const readyCount   = orders.filter((o) => !o.alreadyExists && (o.intervalResolution === 'auto' || o.interval)).length;
  const total        = orders.length;
  const exists       = orders.filter((o) => o.alreadyExists).length;
  const auto         = orders.filter((o) => !o.alreadyExists && o.intervalResolution === 'auto').length;
  const ambiguous    = orders.filter((o) => !o.alreadyExists && o.intervalResolution === 'ambiguous').length;
  const unknown      = orders.filter((o) => !o.alreadyExists && o.intervalResolution === 'unknown').length;

  async function confirmImport() {
    if (pendingCount > 0) { toast.error(`${pendingCount} order belum memilih interval`); return; }
    setConfirming(true);
    try {
      const toImport = orders.filter((o) => !o.alreadyExists);
      const res = await apiPost('/spk/import-excel/confirm', { orders: toImport });
      toast.success(`${res.imported || toImport.length} SPK berhasil diimport`);
      setOrders([]);
    } catch (e) { toast.error('Import gagal: ' + e.message); }
    finally { setConfirming(false); }
  }

  // Enrich each order with task list activities.
  // Sipil orders have taskListId set directly on the order (from SipilFunclocMapping).
  // Regular orders resolve via equipment mapping → taskListId.
  function getOrderActivities(order) {
    // Fast path: taskListId already resolved by the API (Sipil + auto-mapped regular)
    if (order.taskListId) {
      const tl = taskLists.find((t) => t.taskListId === order.taskListId);
      return tl?.activities || [];
    }
    // Fallback: look up through equipment interval mapping
    const eqId    = order.equipmentId || '';
    const interval = order.interval || '';
    if (!eqId || !interval) return [];
    const mapping = mappings.find((m) => m.equipmentId === eqId && m.interval === interval);
    if (!mapping) return [];
    const tl = taskLists.find((t) => t.taskListId === mapping.taskListId);
    return tl?.activities || [];
  }

  const printDate = new Date().toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' });

  function handlePrint() {
    const el = document.getElementById('spk-import-print-doc');
    if (!el) return;
    const style = [
      '* { box-sizing: border-box; margin: 0; padding: 0; }',
      'body { font-family: Arial, sans-serif; font-size: 9pt; background: white; padding: 16px 20px; }',
      'table { border-collapse: collapse; width: 100%; }',
      '@media print { -webkit-print-color-adjust: exact; print-color-adjust: exact; }',
      '@page { margin: 8mm 10mm; size: A4 landscape; }',
    ].join('');
    const blob = new Blob(
      ['<!DOCTYPE html><html><head><title>Import SPK</title><style>', style, '</style></head><body>', el.innerHTML, '</body></html>'],
      { type: 'text/html' }
    );
    const url = URL.createObjectURL(blob);
    const win = window.open(url, '_blank');
    win.addEventListener('load', () => { win.print(); URL.revokeObjectURL(url); });
  }

  // ── LK columns for print (matches generate page exactly) ──────────────────
  const LK_COLS = [
    { label: 'Order / No. Aktivitas', w: '12%' },
    { label: 'Deskripsi / Uraian Pekerjaan', w: '22%' },
    { label: 'Interval', w: '6%' },
    { label: 'Equipment', w: '12%' },
    { label: 'Lokasi', w: '10%' },
    { label: 'Latitude', w: '6%' },
    { label: 'Longitude', w: '6%' },
    { label: 'Result Comment', w: '10%' },
    { label: 'Durasi Aktual (mnt)', w: '5%' },
    { label: 'Durasi Rencana (mnt)', w: '5%' },
    { label: 'Verifikasi', w: '6%' },
  ];

  return (
    <div className="p-6 space-y-4">
      <div>
        <h2 className="text-xl font-semibold text-gray-800">Import SAP Excel</h2>
        <p className="text-sm text-gray-500">Import SPK dari file Excel SAP</p>
      </div>

      {orders.length === 0 ? (
        <div className="max-w-xl">
          <FileUploadZone onFile={handleFile} accept=".xlsx"
            label={loading ? 'Memproses...' : 'Drag & drop file Excel SPK, atau klik untuk memilih'} />
        </div>
      ) : (
        <>
          {/* Stats bar */}
          <div className="flex flex-wrap items-center gap-2">
            {[
              { label: 'Total', value: total, cls: 'bg-gray-100 text-gray-700' },
              { label: 'Sudah Ada', value: exists, cls: 'bg-gray-100 text-gray-500' },
            ].map((s) => (
              <span key={s.label} className={`px-3 py-1 rounded-full text-xs font-semibold ${s.cls}`}>
                {s.label}: {s.value}
              </span>
            ))}

            {/* Kadis area — from Header tab location code (primary) or derived from funcLocs (fallback) */}
            {(() => {
              const kadis = apiKadisId
                ? KADIS_AREAS.find((a) => a.id === apiKadisId)
                : deriveKadisArea(orders);
              if (!kadis) return null;
              return (
                <span className="ml-auto px-3 py-1 rounded-full text-xs font-semibold bg-teal-100 text-teal-700 border border-teal-200">
                  📍 {kadis.label} — {kadis.description}
                  {locationCode && <span className="ml-1.5 opacity-60">({locationCode})</span>}
                </span>
              );
            })()}

            <Button variant="outline" size="sm" onClick={() => setPrintOpen(true)} className="gap-1.5">
              <Printer size={13} /> Print Preview
            </Button>
          </div>

          {pendingCount > 0 && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg px-4 py-2.5 text-sm text-yellow-700">
              {pendingCount} order belum memilih interval. Pilih sebelum konfirmasi.
            </div>
          )}

          {/* Screen table */}
          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
            <table className="w-full text-xs">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  {['Order Number', 'Deskripsi', 'Equipment', 'Kategori', 'Interval', 'Status'].map((h) => (
                    <th key={h} className="px-3 py-2.5 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {orders.map((o, idx) => (
                  <tr key={idx} className={o.alreadyExists ? 'opacity-40' : ''}>
                    <td className="px-3 py-2.5 font-mono font-semibold text-gray-800">{o.orderNumber || o.sapOrderNumber}</td>
                    <td className="px-3 py-2.5 text-gray-700 max-w-[180px] truncate">{o.description}</td>
                    <td className="px-3 py-2.5 text-gray-500">
                      <div className="font-medium flex items-center gap-1.5">
                        {o.displayName || o.equipmentName || o.equipmentId || o.functionalLocation || '—'}
                        {o.equipmentExists === false && (
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-red-100 text-red-600 shrink-0">
                            Tidak di DB
                          </span>
                        )}
                      </div>
                      {(o.equipmentId || o.functionalLocation) && (o.displayName || o.equipmentName) && (
                        <div className="text-xs text-gray-400 mt-0.5">{o.equipmentId || o.functionalLocation}</div>
                      )}
                    </td>
                    <td className="px-3 py-2.5"><CategoryBadge category={o.category} /></td>
                    <td className="px-3 py-2.5">
                      {o.alreadyExists ? <span className="text-gray-400">—</span>
                        : o.intervalResolution === 'auto'
                          ? <span className="px-2 py-0.5 bg-green-100 text-green-700 rounded text-xs font-medium">{o.interval}</span>
                          : (
                            <select value={o.interval || ''} onChange={(e) => onIntervalChange(idx, e.target.value)}
                              className="px-2 py-1 border border-gray-200 rounded text-xs bg-white">
                              <option value="">Pilih...</option>
                              {(o.intervalOptions || INTERVALS).map((iv) => <option key={iv} value={iv}>{iv}</option>)}
                            </select>
                          )}
                    </td>
                    <td className="px-3 py-2.5">
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${RESOLUTION_COLORS[o.alreadyExists ? 'exists' : o.intervalResolution] || ''}`}>
                        {o.alreadyExists ? 'Sudah Ada' : RESOLUTION_LABELS[o.intervalResolution] || o.intervalResolution}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex justify-end gap-3">
            <Button variant="ghost" onClick={() => { setOrders([]); setLocationCode(null); setApiKadisId(null); }}>Batal / Upload Lagi</Button>
            <Button onClick={confirmImport} disabled={confirming || pendingCount > 0}>
              {confirming ? 'Mengimport...' : `Konfirmasi Import (${readyCount} order)`}
            </Button>
          </div>
        </>
      )}

      {/* ── Print Preview Dialog ─────────────────────────────────────── */}
      <Dialog open={printOpen} onOpenChange={setPrintOpen}>
        <DialogContent
          showCloseButton={false}
          className="w-[98vw] max-w-[98vw] sm:max-w-[98vw] h-[97vh] max-h-[97vh] p-0 gap-0 overflow-hidden flex flex-col"
        >
          {/* Toolbar */}
          <div className="flex items-center justify-between px-4 py-2.5 border-b border-gray-200 bg-gray-50 shrink-0">
            <span className="text-sm font-semibold text-gray-700">
              Print Preview — Import SPK · {total} order · {orders.reduce((s, o) => s + getOrderActivities(o).length, 0)} aktivitas
            </span>
            <div className="flex gap-2">
              <Button size="sm" onClick={handlePrint} className="gap-1.5">
                <Printer size={13} /> Cetak
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setPrintOpen(false)}><X size={14} /></Button>
            </div>
          </div>

          {/* Scrollable A4 document */}
          <div className="overflow-y-auto flex-1">
            <div id="spk-import-print-doc" style={{ fontFamily: 'Arial, sans-serif', fontSize: '9pt', padding: '16px 24px', background: 'white', minHeight: '100%' }}>

              {/* ── Title block ── */}
              <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '2px' }}>
                <tbody>
                  <tr>
                    <td style={{ border: TITLE_BORDER, textAlign: 'center', fontWeight: 'bold', fontSize: '12pt', padding: '8px', letterSpacing: '0.5px', width: '75%' }}>
                      IMPORT SPK PREVENTIVE MAINTENANCE
                    </td>
                    <td style={{ border: TITLE_BORDER, borderLeft: 'none', padding: '8px', fontSize: '8.5pt', verticalAlign: 'top', width: '25%' }}>
                      <div>Tanggal: {printDate}</div>
                    </td>
                  </tr>
                  <tr>
                    <td colSpan={2} style={{ border: TITLE_BORDER, borderTop: 'none', padding: '5px 8px', fontSize: '8.5pt' }}>
                      <span style={{ marginRight: '20px' }}>Total: <strong>{total} order</strong></span>
                      <span>Sudah Ada: <strong>{exists}</strong></span>
                    </td>
                  </tr>
                </tbody>
              </table>

              {/* ── Main LK table ── */}
              <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '0' }}>
                <thead>
                  <tr style={{ backgroundColor: HEADER_BG, color: 'white' }}>
                    {LK_COLS.map(({ label, w }) => (
                      <th key={label} style={{ border: BORDER, borderColor: '#2a5080', padding: '5px 5px', textAlign: 'left', fontWeight: 'bold', fontSize: '8pt', width: w }}>
                        {label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {orders.map((o, oIdx) => {
                    const orderNum  = o.orderNumber || o.sapOrderNumber || '';
                    const eqName    = o.displayName || o.equipmentName || o.equipmentId || o.functionalLocation || '—';
                    const eqId      = o.equipmentId || o.functionalLocation || '';
                    const funcloc   = o.funcLocDesc || o.functionalLocation || '—';
                    const lat       = o.latitude != null ? Number(o.latitude).toFixed(6) : '';
                    const lon       = o.longitude != null ? Number(o.longitude).toFixed(6) : '';
                    const interval  = o.interval || '—';
                    const activities = getOrderActivities(o);

                    return [
                      /* Equipment / Order header row */
                      <tr key={`hdr-${oIdx}`} style={{ backgroundColor: EQUIP_ROW_BG }}>
                        <td colSpan={LK_COLS.length} style={{ border: BORDER, padding: '4px 6px', fontWeight: 'bold', fontSize: '8.5pt' }}>
                          {orderNum} &nbsp;|&nbsp; {eqId} — {eqName} &nbsp;|&nbsp; Interval: {interval} &nbsp;|&nbsp; {o.category || ''}
                          {o.alreadyExists && <span style={{ marginLeft: '8px', color: '#888', fontSize: '8pt' }}>(Sudah Ada)</span>}
                        </td>
                      </tr>,

                      /* Activity rows — one per task list activity */
                      ...(activities.length > 0
                        ? activities.map((act, aIdx) => (
                          <tr key={`act-${oIdx}-${aIdx}`} style={{ backgroundColor: oIdx % 2 === 0 ? '#ffffff' : '#f9fbff' }}>
                            <td style={{ border: BORDER, padding: '4px 5px', fontSize: '8pt', color: '#555', textAlign: 'center' }}>{act.activityNumber || act.stepNumber || String((aIdx + 1) * 10).padStart(4, '0')}</td>
                            <td style={{ border: BORDER, padding: '4px 5px', fontSize: '8pt' }}>{act.operationText || act.description || '—'}</td>
                            <td style={{ border: BORDER, padding: '4px 5px', fontSize: '8pt', textAlign: 'center' }}>{interval}</td>
                            <td style={{ border: BORDER, padding: '4px 5px', fontSize: '8pt' }}>{eqName}</td>
                            <td style={{ border: BORDER, padding: '4px 5px', fontSize: '8pt' }}>{funcloc}</td>
                            <td style={{ border: BORDER, padding: '4px 5px', fontSize: '7.5pt', textAlign: 'center' }}>{lat}</td>
                            <td style={{ border: BORDER, padding: '4px 5px', fontSize: '7.5pt', textAlign: 'center' }}>{lon}</td>
                            <td style={{ border: BORDER, padding: '4px 5px' }}></td>
                            <td style={{ border: BORDER, padding: '4px 5px' }}></td>
                            <td style={{ border: BORDER, padding: '4px 5px', fontSize: '8pt', textAlign: 'center' }}>{act.durationPlan || ''}</td>
                            <td style={{ border: BORDER, padding: '4px 5px', textAlign: 'center', fontSize: '11pt' }}>☐</td>
                          </tr>
                        ))
                        : [
                          /* Fallback: single row with the order description if no task list matched */
                          <tr key={`fallback-${oIdx}`} style={{ backgroundColor: oIdx % 2 === 0 ? '#ffffff' : '#f9fbff' }}>
                            <td style={{ border: BORDER, padding: '4px 5px', fontSize: '8pt', color: '#555', textAlign: 'center' }}>—</td>
                            <td style={{ border: BORDER, padding: '4px 5px', fontSize: '8pt', color: '#666', fontStyle: 'italic' }}>{o.description || '—'}</td>
                            <td style={{ border: BORDER, padding: '4px 5px', fontSize: '8pt', textAlign: 'center' }}>{interval}</td>
                            <td style={{ border: BORDER, padding: '4px 5px', fontSize: '8pt' }}>{eqName}</td>
                            <td style={{ border: BORDER, padding: '4px 5px', fontSize: '8pt' }}>{funcloc}</td>
                            <td style={{ border: BORDER, padding: '4px 5px' }}></td>
                            <td style={{ border: BORDER, padding: '4px 5px' }}></td>
                            <td style={{ border: BORDER, padding: '4px 5px' }}></td>
                            <td style={{ border: BORDER, padding: '4px 5px' }}></td>
                            <td style={{ border: BORDER, padding: '4px 5px' }}></td>
                            <td style={{ border: BORDER, padding: '4px 5px', textAlign: 'center', fontSize: '11pt' }}>☐</td>
                          </tr>,
                        ]
                      ),
                    ];
                  })}
                </tbody>
              </table>

              {/* ── Signature footer ── */}
              {(() => {
                const kadisArea = apiKadisId
                  ? KADIS_AREAS.find((a) => a.id === apiKadisId)
                  : deriveKadisArea(orders);
                const kadisLabel = kadisArea ? `Dievaluasi (${kadisArea.label})` : 'Dievaluasi (Kadis)';
                const sigLabels = ['Dilaksanakan', 'Mengetahui (Kasie)', 'Disetujui (Kadis Perawatan)', kadisLabel];
                return (
                  <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '32px' }}>
                    <tbody>
                      <tr>
                        {['Tanggal:', 'Tanggal:', 'Tanggal:', 'Tanggal:'].map((label, i) => (
                          <td key={i} style={{ width: '25%', padding: '0 4px 4px', fontSize: '8.5pt' }}>{label}</td>
                        ))}
                      </tr>
                      <tr>
                        {sigLabels.map((label, i) => (
                          <td key={i} style={{ border: BORDER, textAlign: 'center', padding: '4px', fontWeight: 'bold', fontSize: '8.5pt', backgroundColor: SIG_HDR_BG }}>
                            {label}
                          </td>
                        ))}
                      </tr>
                      <tr>
                        {Array.from({ length: 4 }).map((_, i) => (
                          <td key={i} style={{ border: BORDER, borderTop: 'none', height: '60px', padding: '4px', verticalAlign: 'bottom', textAlign: 'center', fontSize: '8.5pt', color: '#888' }}>
                          </td>
                        ))}
                      </tr>
                    </tbody>
                  </table>
                );
              })()}

              <div style={{ marginTop: '12px', fontSize: '7.5pt', color: '#888', textAlign: 'right' }}>
                Dicetak: {printDate} · MANTIS PPHSE
              </div>

            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
