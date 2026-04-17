'use client';

import { useState, useEffect, useRef } from 'react';
import { toast } from 'sonner';
import { apiGet, apiDelete, apiPost, apiPut } from '@/lib/api';
import { StatusBadge, CategoryBadge } from '@/components/shared/StatusBadge';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import { CATEGORIES, STATUS_LABELS } from '@/lib/constants';
import { Button } from '@/components/ui/button';
import { RefreshCw, Trash2, Wrench, Upload, Plus, X, RotateCcw, Pencil } from 'lucide-react';
import Link from 'next/link';

const STATUS_OPTIONS = ['pending', 'in_progress', 'completed', 'approved', 'rejected'];
const INTERVALS = ['1wk', '2wk', '4wk', '8wk', '12wk', '16wk', '24wk'];
const curYear = new Date().getFullYear();
const YEARS = [curYear - 1, curYear, curYear + 1];
const WEEKS = Array.from({ length: 53 }, (_, i) => i + 1);

function getWeekStart(week, year) {
  const jan4 = new Date(year, 0, 4);
  const jan4Day = jan4.getDay() || 7;
  const mon = new Date(jan4);
  mon.setDate(jan4.getDate() - (jan4Day - 1) + (week - 1) * 7);
  const y = mon.getFullYear(), m = String(mon.getMonth() + 1).padStart(2, '0'), d = String(mon.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}
function fmtDate(d) {
  return new Date(d + 'T00:00:00').toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });
}
function getCurrentWeek() {
  const now = new Date();
  const jan4 = new Date(now.getFullYear(), 0, 4);
  const jan4Day = jan4.getDay() || 7;
  const diff = Math.floor((now - jan4) / 86400000) + (jan4Day - 1);
  return Math.min(53, Math.max(1, Math.ceil((diff + 1) / 7)));
}
function suggestNumber(category, list) {
  const code = { Mekanik: 'M', Listrik: 'L', Sipil: 'S', Otomasi: 'O' }[category] || 'X';
  const prefix = `SPK-${code}-`;
  const max = list.reduce((m, s) => {
    if (!s.spkNumber.startsWith(prefix)) return m;
    const match = s.spkNumber.match(/SPK-[A-Z]+-(\d+)$/);
    return match ? Math.max(m, parseInt(match[1])) : m;
  }, 0);
  return `${prefix}${String(max + 1).padStart(3, '0')}`;
}

export default function SpkPage() {
  const [spkList, setSpkList]       = useState([]);
  const [loading, setLoading]       = useState(true);
  const [category, setCategory]     = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [selected, setSelected]     = useState([]);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);

  // Side panel
  const [panelOpen, setPanelOpen]   = useState(false);
  const [editingSpk, setEditingSpk] = useState(null); // null = create, obj = edit
  const [form, setForm]             = useState({ spkNumber: '', description: '', category: 'Mekanik', status: 'pending', scheduledDate: '', interval: '' });
  const [panelYear, setPanelYear]   = useState(curYear);
  const [panelWeek, setPanelWeek]   = useState(getCurrentWeek());
  const [activeIntervals, setActiveIntervals] = useState([]);
  const [selectedInterval, setSelectedInterval] = useState('');
  const [allEquipment, setAllEquipment] = useState([]);
  const [allMappings, setAllMappings]   = useState([]);
  const [eqSearch, setEqSearch]     = useState('');
  const [selectedEqIds, setSelectedEqIds] = useState([]);
  const [activities, setActivities] = useState([]); // [{ equipmentId, operationText, durationPlan }]
  const [loadingIntervals, setLoadingIntervals] = useState(false);
  const [saving, setSaving]         = useState(false);
  const actIdxRef = useRef(0);

  useEffect(() => { load(); }, [category]); // eslint-disable-line react-hooks/exhaustive-deps

  async function load() {
    setLoading(true);
    try {
      const data = await apiGet('/spk' + (category ? `?category=${category}` : ''));
      setSpkList(data);
      setSelected([]);
    } catch (e) { toast.error('Gagal memuat: ' + e.message); }
    finally { setLoading(false); }
  }

  async function handleDelete() {
    try {
      await apiDelete(`/spk/${deleteTarget.spkNumber}`);
      toast.success(`SPK ${deleteTarget.spkNumber} dihapus`);
      setDeleteTarget(null);
      load();
    } catch (e) { toast.error(e.message); }
  }

  async function handleBulkDelete() {
    try {
      await apiPost('/spk/bulk-delete', { ids: selected });
      toast.success(`${selected.length} SPK dihapus`);
      setBulkDeleteOpen(false);
      load();
    } catch (e) { toast.error(e.message); }
  }

  async function handleReset(spk) {
    if (!window.confirm(`Reset SPK ${spk.spkNumber} ke status pending?`)) return;
    try {
      const resetActs = (spk.activitiesModel || []).map((a) => ({ ...a, resultComment: null, durationActual: null, isVerified: false }));
      await apiPut(`/spk/${spk.spkNumber}`, { status: 'pending', durationActual: null, activitiesModel: resetActs });
      toast.success(`SPK ${spk.spkNumber} direset`);
      load();
    } catch (e) { toast.error(e.message); }
  }

  function toggleSelect(spkNumber) {
    setSelected((prev) => prev.includes(spkNumber) ? prev.filter((x) => x !== spkNumber) : [...prev, spkNumber]);
  }
  function toggleAll(checked) {
    setSelected(checked ? displayed.map((s) => s.spkNumber) : []);
  }

  // ── Panel open/close ────────────────────────────────────────────────────────
  async function openCreate() {
    const [eqRes, mapRes] = await Promise.all([
      apiGet('/equipment?limit=9999').catch(() => ({ data: [] })),
      apiGet('/equipment-mappings').catch(() => []),
    ]);
    setAllEquipment(eqRes.data || eqRes);
    setAllMappings(Array.isArray(mapRes) ? mapRes : []);
    setEditingSpk(null);
    const week = getCurrentWeek();
    setPanelYear(curYear); setPanelWeek(week);
    setForm({ spkNumber: suggestNumber('Mekanik', spkList), description: '', category: 'Mekanik', status: 'pending', scheduledDate: '', interval: '' });
    setSelectedEqIds([]); setActivities([]); setSelectedInterval(''); setEqSearch('');
    await fetchIntervals(curYear, week);
    setPanelOpen(true);
  }

  async function openEdit(spk) {
    const [eqRes, mapRes] = await Promise.all([
      apiGet('/equipment?limit=9999').catch(() => ({ data: [] })),
      apiGet('/equipment-mappings').catch(() => []),
    ]);
    setAllEquipment(eqRes.data || eqRes);
    setAllMappings(Array.isArray(mapRes) ? mapRes : []);
    setEditingSpk(spk);
    setForm({ spkNumber: spk.spkNumber, description: spk.description || '', category: spk.category || 'Mekanik', status: spk.status || 'pending', scheduledDate: spk.scheduledDate || '', interval: spk.interval || '' });
    const eqIds = (spk.equipmentModels || []).map((e) => e.equipmentId);
    setSelectedEqIds(eqIds);
    setActivities((spk.activitiesModel || []).map((a) => ({ _id: actIdxRef.current++, equipmentId: a.equipmentId, operationText: a.operationText || '', durationPlan: a.durationPlan ?? '' })));
    setSelectedInterval(spk.interval || '');
    setEqSearch('');
    setPanelOpen(true);
  }

  async function fetchIntervals(year, week) {
    setLoadingIntervals(true);
    try {
      const data = await apiGet(`/preventive-schedule?year=${year}&week=${week}`);
      const ivs = data.activeIntervals || [];
      setActiveIntervals(ivs);
      if (ivs.length) setSelectedInterval(ivs[0]);
    } catch { setActiveIntervals([]); }
    finally { setLoadingIntervals(false); }
  }

  function onWeekChange(year, week) {
    setPanelYear(year); setPanelWeek(week);
    fetchIntervals(year, week);
  }

  // When interval changes in create mode, auto-populate activities from mappings
  function onIntervalSelect(iv) {
    setSelectedInterval(iv);
    if (!editingSpk) {
      const newActs = [];
      selectedEqIds.forEach((eqId) => {
        const mapping = allMappings.find((m) => m.equipmentId === eqId && m.interval === iv);
        if (mapping?.activities?.length) {
          mapping.activities.forEach((step) => {
            newActs.push({ _id: actIdxRef.current++, equipmentId: eqId, operationText: step.operationText || '', durationPlan: 30 });
          });
        }
      });
      setActivities(newActs);
    }
  }

  // When equipment selection changes in create mode, refresh activities
  function onEqToggle(eqId) {
    setSelectedEqIds((prev) => {
      const next = prev.includes(eqId) ? prev.filter((x) => x !== eqId) : [...prev, eqId];
      // Auto-populate activities for newly added equipment
      if (!editingSpk && !prev.includes(eqId) && selectedInterval) {
        const mapping = allMappings.find((m) => m.equipmentId === eqId && m.interval === selectedInterval);
        if (mapping?.activities?.length) {
          setActivities((acts) => [
            ...acts,
            ...mapping.activities.map((step) => ({ _id: actIdxRef.current++, equipmentId: eqId, operationText: step.operationText || '', durationPlan: 30 })),
          ]);
        }
      }
      if (prev.includes(eqId)) {
        // Remove activities for deselected equipment
        setActivities((acts) => acts.filter((a) => a.equipmentId !== eqId));
      }
      return next;
    });
  }

  function addActivity(eqId) {
    setActivities((prev) => [...prev, { _id: actIdxRef.current++, equipmentId: eqId, operationText: '', durationPlan: '' }]);
  }
  function removeActivity(id) {
    setActivities((prev) => prev.filter((a) => a._id !== id));
  }
  function updateActivity(id, field, value) {
    setActivities((prev) => prev.map((a) => a._id === id ? { ...a, [field]: value } : a));
  }

  async function saveSpk() {
    const { spkNumber, description, category: cat, status, scheduledDate } = form;
    if (!spkNumber || !description) { toast.error('SPK Number dan Deskripsi wajib diisi'); return; }
    if (!editingSpk && !selectedInterval) { toast.error('Pilih interval SPK'); return; }

    const equipmentModels = selectedEqIds.map((id) => {
      const eq = allEquipment.find((e) => e.equipmentId === id);
      return { equipmentId: id, equipmentName: eq?.equipmentName || id, functionalLocation: eq?.functionalLocationId || null };
    });

    let actCounter = 1;
    const activitiesModel = activities
      .filter((a) => a.operationText?.trim())
      .map((a) => ({
        activityNumber: `ACT-${String(actCounter++).padStart(3, '0')}`,
        equipmentId: a.equipmentId,
        operationText: a.operationText.trim(),
        durationPlan: parseFloat(a.durationPlan) || 0,
        resultComment: null, durationActual: null, isVerified: false,
      }));

    const body = {
      spkNumber, description, category: cat, status,
      interval: editingSpk ? (editingSpk.interval || selectedInterval) : selectedInterval,
      scheduledDate: editingSpk ? (scheduledDate || null) : getWeekStart(panelWeek, panelYear),
      durationActual: null, equipmentModels, activitiesModel,
    };

    setSaving(true);
    try {
      if (editingSpk) {
        await apiPut(`/spk/${editingSpk.spkNumber}`, body);
        toast.success(`SPK ${spkNumber} diperbarui`);
      } else {
        await apiPost('/spk', body);
        toast.success(`SPK ${spkNumber} dibuat`);
      }
      setPanelOpen(false);
      load();
    } catch (e) { toast.error(e.message); }
    finally { setSaving(false); }
  }

  const displayed = statusFilter ? spkList.filter((s) => s.status === statusFilter) : spkList;

  // Equipment list for panel (grouped mapped/unmapped in create mode)
  const filteredEq = allEquipment.filter((eq) => {
    const q = eqSearch.toLowerCase();
    return !q || eq.equipmentId?.toLowerCase().includes(q) || eq.equipmentName?.toLowerCase().includes(q);
  });
  const mappedForInterval = !editingSpk && selectedInterval
    ? new Set(allMappings.filter((m) => m.interval === selectedInterval).map((m) => m.equipmentId))
    : null;

  return (
    <div className="flex h-full">
      {/* Main list */}
      <div className={`flex-1 p-6 space-y-4 overflow-y-auto transition-all ${panelOpen ? 'mr-[420px]' : ''}`}>
        <div className="flex items-start justify-between flex-wrap gap-3">
          <div>
            <h2 className="text-xl font-semibold text-gray-800">SPK / Preventive</h2>
            <p className="text-sm text-gray-500">{displayed.length} SPK</p>
          </div>
          <div className="flex gap-2 flex-wrap">
            <Button variant="outline" size="sm" onClick={load}><RefreshCw size={13} /></Button>
            <Link href="/spk/import">
              <Button variant="outline" size="sm" className="gap-1.5"><Upload size={13} /> Import SAP</Button>
            </Link>
            <Link href="/spk/generate">
              <Button variant="outline" size="sm" className="gap-1.5"><Wrench size={13} /> Generate</Button>
            </Link>
            {/* <Button size="sm" onClick={openCreate} className="gap-1.5"><Plus size={14} /> Buat SPK</Button> */}
          </div>
        </div>

        {/* Filters */}
        <div className="flex items-center gap-3 flex-wrap">
          <select value={category} onChange={(e) => setCategory(e.target.value)}
            className="px-2.5 py-2 border border-gray-200 rounded-lg text-sm bg-white">
            <option value="">Semua Kategori</option>
            {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}
            className="px-2.5 py-2 border border-gray-200 rounded-lg text-sm bg-white">
            <option value="">Semua Status</option>
            {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{STATUS_LABELS[s] || s}</option>)}
          </select>
          {selected.length > 0 && (
            <div className="flex items-center gap-2 ml-auto bg-red-50 border border-red-200 rounded-lg px-3 py-1.5">
              <span className="text-sm text-red-700 font-medium">{selected.length} dipilih</span>
              <Button variant="destructive" size="sm" onClick={() => setBulkDeleteOpen(true)} className="gap-1 h-7 text-xs">
                <Trash2 size={12} /> Hapus
              </Button>
            </div>
          )}
        </div>

        {/* Table */}
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="pl-4 pr-2 py-3 w-8">
                  <input type="checkbox" checked={selected.length === displayed.length && displayed.length > 0}
                    onChange={(e) => toggleAll(e.target.checked)} className="rounded border-gray-300" />
                </th>
                {['SPK Number', 'Deskripsi', 'Kategori', 'Interval', 'Status', 'Equipment', 'Aksi'].map((h) => (
                  <th key={h} className="px-3 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr><td colSpan={8} className="px-4 py-8 text-center text-gray-400">Memuat...</td></tr>
              ) : displayed.length === 0 ? (
                <tr><td colSpan={8} className="px-4 py-8 text-center text-gray-400">Tidak ada data</td></tr>
              ) : displayed.map((s) => (
                <tr key={s.spkNumber} className="hover:bg-gray-50">
                  <td className="pl-4 pr-2 py-3">
                    <input type="checkbox" checked={selected.includes(s.spkNumber)}
                      onChange={() => toggleSelect(s.spkNumber)} className="rounded border-gray-300" />
                  </td>
                  <td className="px-3 py-3 font-mono text-xs font-semibold text-gray-800">{s.spkNumber}</td>
                  <td className="px-3 py-3 text-gray-700 max-w-[200px] truncate">{s.description}</td>
                  <td className="px-3 py-3"><CategoryBadge category={s.category} /></td>
                  <td className="px-3 py-3 text-gray-500 text-xs">{s.interval}</td>
                  <td className="px-3 py-3"><StatusBadge status={s.status} /></td>
                  <td className="px-3 py-3 text-gray-500 text-xs">{(s.equipmentModels || []).length}</td>
                  <td className="px-3 py-3">
                    <div className="flex gap-1.5">
                      <Button variant="outline" size="sm" className="h-7 text-xs gap-1" onClick={() => openEdit(s)}>
                        <Pencil size={11} /> Edit
                      </Button>
                      {s.status === 'completed' && (
                        <Button variant="ghost" size="sm" className="h-7 text-xs gap-1 text-amber-600 hover:bg-amber-50" onClick={() => handleReset(s)}>
                          <RotateCcw size={11} /> Reset
                        </Button>
                      )}
                      <Button variant="destructive" size="sm" className="h-7 text-xs"
                        onClick={() => setDeleteTarget(s)}>Hapus</Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Side panel */}
      {panelOpen && (
        <div className="fixed top-0 right-0 h-full w-[420px] bg-white border-l border-gray-200 shadow-xl flex flex-col z-40 overflow-hidden">
          {/* Panel header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 shrink-0">
            <h3 className="text-base font-semibold text-gray-800">{editingSpk ? `Edit SPK` : 'Buat SPK'}</h3>
            <button onClick={() => setPanelOpen(false)} className="p-1 rounded hover:bg-gray-100 text-gray-500"><X size={16} /></button>
          </div>

          <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
            {/* ── SPK Info ── */}
            <section>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Informasi SPK</p>
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <PanelField label="SPK Number *" value={form.spkNumber} disabled={!!editingSpk}
                    onChange={(v) => setForm((f) => ({ ...f, spkNumber: v }))} />
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1">Kategori *</label>
                    <select value={form.category}
                      onChange={(e) => { const v = e.target.value; setForm((f) => ({ ...f, category: v, spkNumber: editingSpk ? f.spkNumber : suggestNumber(v, spkList) })); }}
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30">
                      {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                </div>
                <PanelField label="Deskripsi *" value={form.description} onChange={(v) => setForm((f) => ({ ...f, description: v }))} />
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1">Status</label>
                    <select value={form.status} onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30">
                      {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{STATUS_LABELS[s] || s}</option>)}
                    </select>
                  </div>
                  {editingSpk
                    ? <PanelField label="Tanggal Mulai" type="date" value={form.scheduledDate} onChange={(v) => setForm((f) => ({ ...f, scheduledDate: v }))} />
                    : <PanelField label="Interval" value={form.interval} disabled placeholder={editingSpk?.interval || '—'} />
                  }
                </div>
              </div>
            </section>

            {/* ── Week / Interval (create only) ── */}
            {!editingSpk && (
              <section>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Periode & Interval</p>
                <div className="grid grid-cols-2 gap-3 mb-2">
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1">Tahun</label>
                    <select value={panelYear} onChange={(e) => onWeekChange(Number(e.target.value), panelWeek)}
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white">
                      {YEARS.map((y) => <option key={y} value={y}>{y}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1">Minggu ke-</label>
                    <select value={panelWeek} onChange={(e) => onWeekChange(panelYear, Number(e.target.value))}
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white">
                      {WEEKS.map((w) => <option key={w} value={w}>Minggu {w}</option>)}
                    </select>
                  </div>
                </div>
                <p className="text-xs text-gray-400 mb-2">Mulai: {fmtDate(getWeekStart(panelWeek, panelYear))}</p>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Interval *</label>
                  {loadingIntervals ? (
                    <p className="text-xs text-gray-400">Memuat jadwal...</p>
                  ) : activeIntervals.length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                      {activeIntervals.map((iv) => (
                        <button key={iv} onClick={() => onIntervalSelect(iv)}
                          className={`px-3 py-1 rounded-full text-xs font-semibold border transition-colors ${selectedInterval === iv ? 'bg-blue-600 text-white border-blue-600' : 'border-gray-300 text-gray-600 hover:bg-gray-50'}`}>
                          {iv}
                        </button>
                      ))}
                    </div>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {INTERVALS.map((iv) => (
                        <button key={iv} onClick={() => onIntervalSelect(iv)}
                          className={`px-3 py-1 rounded-full text-xs font-semibold border transition-colors ${selectedInterval === iv ? 'bg-blue-600 text-white border-blue-600' : 'border-gray-300 text-gray-600 hover:bg-gray-50'}`}>
                          {iv}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </section>
            )}

            {/* ── Equipment ── */}
            <section>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Equipment</p>
              <input value={eqSearch} onChange={(e) => setEqSearch(e.target.value)}
                placeholder="Cari equipment..." className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm mb-2 focus:outline-none focus:ring-2 focus:ring-blue-500/30" />
              <div className="border border-gray-200 rounded-lg overflow-hidden max-h-48 overflow-y-auto">
                {filteredEq.length === 0 ? (
                  <p className="px-3 py-4 text-xs text-gray-400 text-center">Tidak ada equipment</p>
                ) : (
                  <>
                    {mappedForInterval && (
                      <>
                        {filteredEq.filter((eq) => mappedForInterval.has(eq.equipmentId)).length > 0 && (
                          <p className="px-3 py-1.5 text-xs font-semibold text-gray-400 uppercase tracking-wide bg-gray-50">Terpetakan — {selectedInterval}</p>
                        )}
                        {filteredEq.filter((eq) => mappedForInterval.has(eq.equipmentId)).map((eq) => (
                          <EqItem key={eq.equipmentId} eq={eq} checked={selectedEqIds.includes(eq.equipmentId)} onToggle={onEqToggle}
                            badge={allMappings.find((m) => m.equipmentId === eq.equipmentId && m.interval === selectedInterval)?.taskListName} />
                        ))}
                        {filteredEq.filter((eq) => !mappedForInterval.has(eq.equipmentId)).length > 0 && (
                          <p className="px-3 py-1.5 text-xs font-semibold text-gray-400 uppercase tracking-wide bg-gray-50 border-t border-gray-100">Tanpa mapping</p>
                        )}
                        {filteredEq.filter((eq) => !mappedForInterval.has(eq.equipmentId)).map((eq) => (
                          <EqItem key={eq.equipmentId} eq={eq} checked={selectedEqIds.includes(eq.equipmentId)} onToggle={onEqToggle} />
                        ))}
                      </>
                    )}
                    {!mappedForInterval && filteredEq.map((eq) => (
                      <EqItem key={eq.equipmentId} eq={eq} checked={selectedEqIds.includes(eq.equipmentId)} onToggle={onEqToggle} />
                    ))}
                  </>
                )}
              </div>
            </section>

            {/* ── Activities per equipment ── */}
            {selectedEqIds.length > 0 && (
              <section>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Aktivitas</p>
                {selectedEqIds.map((eqId) => {
                  const eq = allEquipment.find((e) => e.equipmentId === eqId);
                  const eqActs = activities.filter((a) => a.equipmentId === eqId);
                  return (
                    <div key={eqId} className="mb-4">
                      <p className="text-xs font-semibold text-gray-700 mb-2">
                        {eq?.equipmentName || eqId} <span className="font-normal text-gray-400">({eqId})</span>
                      </p>
                      <div className="space-y-2">
                        {eqActs.map((act) => (
                          <div key={act._id} className="flex gap-2 items-center">
                            <input value={act.operationText} onChange={(e) => updateActivity(act._id, 'operationText', e.target.value)}
                              placeholder="Teks operasi / deskripsi aktivitas"
                              className="flex-1 px-3 py-1.5 border border-gray-200 rounded text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/30" />
                            <input type="number" value={act.durationPlan} onChange={(e) => updateActivity(act._id, 'durationPlan', e.target.value)}
                              placeholder="Menit" className="w-20 px-2 py-1.5 border border-gray-200 rounded text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/30" />
                            <button onClick={() => removeActivity(act._id)} className="p-1 text-gray-400 hover:text-red-500">
                              <X size={13} />
                            </button>
                          </div>
                        ))}
                      </div>
                      <button onClick={() => addActivity(eqId)}
                        className="mt-2 flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800">
                        <Plus size={12} /> Tambah Aktivitas
                      </button>
                    </div>
                  );
                })}
              </section>
            )}
          </div>

          {/* Panel footer */}
          <div className="shrink-0 px-5 py-4 border-t border-gray-200 flex justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={() => setPanelOpen(false)}>Batal</Button>
            <Button size="sm" onClick={saveSpk} disabled={saving}>
              {saving ? 'Menyimpan...' : editingSpk ? 'Simpan' : 'Buat SPK'}
            </Button>
          </div>
        </div>
      )}

      <ConfirmDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}
        title={`Hapus SPK ${deleteTarget?.spkNumber}?`} description="Aksi ini tidak dapat diurungkan."
        onConfirm={handleDelete} confirmLabel="Hapus" destructive />
      <ConfirmDialog open={bulkDeleteOpen} onOpenChange={setBulkDeleteOpen}
        title={`Hapus ${selected.length} SPK?`} description="Aksi ini tidak dapat diurungkan."
        onConfirm={handleBulkDelete} confirmLabel="Hapus Semua" destructive />
    </div>
  );
}

function PanelField({ label, value, onChange, disabled, placeholder, type = 'text' }) {
  return (
    <div>
      <label className="block text-xs font-semibold text-gray-600 mb-1">{label}</label>
      <input type={type} value={value} onChange={onChange ? (e) => onChange(e.target.value) : undefined}
        disabled={disabled} placeholder={placeholder}
        className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 disabled:bg-gray-50 disabled:text-gray-400" />
    </div>
  );
}

function EqItem({ eq, checked, onToggle, badge }) {
  return (
    <label className="flex items-center gap-2.5 px-3 py-2 hover:bg-gray-50 cursor-pointer border-b border-gray-50 last:border-0">
      <input type="checkbox" checked={checked} onChange={() => onToggle(eq.equipmentId)} className="rounded border-gray-300 shrink-0" />
      <span className="flex-1 min-w-0">
        <span className="text-xs font-semibold text-gray-800">{eq.equipmentId}</span>
        <span className="text-xs text-gray-500 ml-1">— {eq.equipmentName}</span>
      </span>
      {badge && (
        <span className="text-xs px-2 py-0.5 rounded-full bg-green-50 text-green-700 border border-green-200 shrink-0">✓ {badge}</span>
      )}
    </label>
  );
}
