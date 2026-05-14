'use client';

import { useState, useEffect, useRef, Fragment, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { toast } from 'sonner';
import { apiGet, apiDelete, apiPost, apiPut } from '@/lib/api';
import { StatusBadge, CategoryBadge } from '@/components/shared/StatusBadge';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { CATEGORIES, STATUS_LABELS, KADIS_AREAS, EQUIPMENT_STATUS_LABELS, EQUIPMENT_STATUS_COLORS } from '@/lib/constants';
import { formatDate, formatDateShort } from '@/lib/date-utils';
import { Button } from '@/components/ui/button';
import { RefreshCw, Trash2, Upload, Plus, X, RotateCcw, Pencil, Eye, MapPin, CheckCircle2, Circle } from 'lucide-react';
import { canCreate, canUpdate, canDelete, getUserCategory } from '@/lib/auth';
import Link from 'next/link';

const STATUS_OPTIONS = ['pending', 'awaiting_kasie', 'awaiting_kadis_perawatan', 'awaiting_kadis', 'approved', 'rejected'];

const UPLOADS_BASE = (process.env.NEXT_PUBLIC_API_URL || '').replace(/\/api\/?$/, '');

function kadisStatusLabel(kadisArea) {
  const area = KADIS_AREAS.find(a => a.id === kadisArea);
  return area ? `Menunggu Kadis — ${area.label}` : 'Menunggu Kadis';
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

export default function SpkPage() {
  return <Suspense><SpkPageInner /></Suspense>;
}

function SpkPageInner() {
  const searchParams = useSearchParams();
  const [spkList, setSpkList]       = useState([]);
  const [loading, setLoading]       = useState(true);
  const [userCategory, setUserCategory] = useState(null); // null = unrestricted
  const [category, setCategory]     = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [selected, setSelected]     = useState([]);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const [search, setSearch] = useState(() => searchParams.get('q') || '');
  const [weekFilter, setWeekFilter] = useState('');
  const [yearFilter, setYearFilter] = useState('');
  const [plantFilter, setPlantFilter] = useState('');
  const [plants, setPlants] = useState([]);
  const [hasAbnormal, setHasAbnormal] = useState(false);
  const [lightbox, setLightbox] = useState(null); // photo path string for detail view

  // Side panel
  const [panelOpen, setPanelOpen]   = useState(false);
  const [editingSpk, setEditingSpk] = useState(null); // null = create, obj = edit
  const [form, setForm]             = useState({ spkNumber: '', description: '', category: 'Mekanik', status: 'pending', scheduledDate: '', interval: '' });
  const [allEquipment, setAllEquipment] = useState([]);
  const [eqSearch, setEqSearch]     = useState('');
  const [selectedEqIds, setSelectedEqIds] = useState([]);
  const [activities, setActivities] = useState([]);
  const [saving, setSaving]         = useState(false);
  const actIdxRef = useRef(0);

  // Detail view
  const [detailSpk, setDetailSpk]   = useState(null);
  const [detailFull, setDetailFull] = useState(null); // enriched single-SPK (names resolved)
  const [detailSubs, setDetailSubs] = useState([]);
  const [loadingSubs, setLoadingSubs] = useState(false);

  useEffect(() => { setUserCategory(getUserCategory()); }, []);
  useEffect(() => { apiGet('/maps').then(setPlants).catch(() => {}); }, []);
  useEffect(() => { load(); }, [category, plantFilter]); // eslint-disable-line react-hooks/exhaustive-deps

  async function load() {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (category) params.set('category', category);
      if (plantFilter) params.set('plantId', plantFilter);
      const qs = params.toString();
      const data = await apiGet('/spk' + (qs ? `?${qs}` : ''));
      setSpkList(Array.isArray(data) ? data : []);
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
  async function openEdit(spk) {
    const eqRes = await apiGet('/equipment?limit=9999').catch(() => ({ data: [] }));
    setAllEquipment(eqRes.data || eqRes);
    setEditingSpk(spk);
    setForm({ spkNumber: spk.spkNumber, description: spk.description || '', category: spk.category || 'Mekanik', status: spk.status || 'pending', scheduledDate: spk.scheduledDate || '', interval: spk.interval || '' });
    const eqIds = (spk.equipmentModels || []).map((e) => e.equipmentId);
    setSelectedEqIds(eqIds);
    setActivities((spk.activitiesModel || []).map((a) => ({ _id: actIdxRef.current++, equipmentId: a.equipmentId, operationText: a.operationText || '', durationPlan: a.durationPlan ?? '' })));
    setEqSearch('');
    setPanelOpen(true);
  }

  async function openDetail(spk) {
    setDetailSpk(spk);
    setDetailFull(null);
    setDetailSubs([]);
    setLoadingSubs(true);
    try {
      const [fullData, subsData] = await Promise.all([
        apiGet(`/spk/${spk.spkNumber}`).catch(() => null),
        apiGet(`/submissions?spkNumber=${spk.spkNumber}`).catch(() => []),
      ]);
      setDetailFull(fullData);
      setDetailSubs(Array.isArray(subsData) ? subsData : []);
    } finally { setLoadingSubs(false); }
  }

  function onEqToggle(eqId) {
    setSelectedEqIds((prev) => {
      const next = prev.includes(eqId) ? prev.filter((x) => x !== eqId) : [...prev, eqId];
      if (prev.includes(eqId)) {
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
      interval: editingSpk.interval,
      scheduledDate: scheduledDate || null,
      durationActual: null, equipmentModels, activitiesModel,
    };

    setSaving(true);
    try {
      await apiPut(`/spk/${editingSpk.spkNumber}`, body);
      toast.success(`SPK ${spkNumber} diperbarui`);
      setPanelOpen(false);
      load();
    } catch (e) { toast.error(e.message); }
    finally { setSaving(false); }
  }

  const displayed = spkList.filter((s) => {
    if (statusFilter && s.status !== statusFilter) return false;
    if (weekFilter && String(s.weekNumber) !== weekFilter) return false;
    if (yearFilter && String(s.weekYear) !== yearFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      const matchSpk  = s.spkNumber?.toLowerCase().includes(q);
      const matchDesc = s.description?.toLowerCase().includes(q);
      const matchEq   = (s.equipmentModels || []).some(
        (e) => e.equipmentId?.toLowerCase().includes(q) || e.equipmentName?.toLowerCase().includes(q)
      );
      if (!matchSpk && !matchDesc && !matchEq) return false;
    }
    if (hasAbnormal && !s.abnormalCount) return false;
    return true;
  });

  // Collect unique week numbers and years from current list for filter dropdowns
  const weekOptions  = [...new Set(spkList.map((s) => s.weekNumber).filter(Boolean))].sort((a, b) => a - b);
  const yearOptions  = [...new Set(spkList.map((s) => s.weekYear).filter(Boolean))].sort((a, b) => b - a);

  const filteredEq = allEquipment.filter((eq) => {
    const q = eqSearch.toLowerCase();
    return !q || eq.equipmentId?.toLowerCase().includes(q) || eq.equipmentName?.toLowerCase().includes(q);
  });

  return (
    <div className="flex h-full">
      {/* Main list */}
      <div className={`flex-1 p-6 space-y-4 overflow-y-auto transition-all ${panelOpen ? 'mr-[420px]' : ''}`}>
        <div className="flex items-start justify-between flex-wrap gap-3">
          <div>
            <h2 className="text-xl font-semibold text-gray-800">SPK / Preventive</h2>
            <p className="text-sm text-gray-500">{displayed.length} SPK</p>
          </div>
          <div className="flex gap-2 flex-wrap ">
            <Button variant="outline" size="sm" onClick={load}><RefreshCw size={13} /></Button>
            {canCreate('spk') && (
              <Link href="/spk/import">   
                <Button variant="outline" size="sm" className="gap-1.5 bg-blue-600 hover:bg-blue-700 text-white"><Upload size={13} /> Import SAP</Button>
              </Link>
            )}
          </div>
        </div>

        {/* Filters */}
        <div className="flex items-center gap-3 flex-wrap">
          <input
            value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder="Cari SPK, deskripsi, equipment..."
            className="px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white min-w-[220px] focus:outline-none focus:ring-2 focus:ring-blue-500/30"
          />
          {userCategory ? (
            <span className="px-3 py-2 border border-gray-200 rounded-lg text-sm bg-gray-50 text-gray-700 font-medium select-none">
              {userCategory}
            </span>
          ) : (
            <select value={category} onChange={(e) => setCategory(e.target.value)}
              className="px-2.5 py-2 border border-gray-200 rounded-lg text-sm bg-white">
              <option value="">Semua Kategori</option>
              {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          )}
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}
            className="px-2.5 py-2 border border-gray-200 rounded-lg text-sm bg-white">
            <option value="">Semua Status</option>
            {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{STATUS_LABELS[s] || s}</option>)}
          </select>
          <select value={yearFilter} onChange={(e) => setYearFilter(e.target.value)}
            className="px-2.5 py-2 border border-gray-200 rounded-lg text-sm bg-white">
            <option value="">Semua Tahun</option>
            {yearOptions.map((y) => <option key={y} value={String(y)}>{y}</option>)}
          </select>
          <select value={weekFilter} onChange={(e) => setWeekFilter(e.target.value)}
            className="px-2.5 py-2 border border-gray-200 rounded-lg text-sm bg-white">
            <option value="">Semua Minggu</option>
            {weekOptions.map((w) => <option key={w} value={String(w)}>Minggu {w}</option>)}
          </select>
          {plants.length > 0 && (
            <select value={plantFilter} onChange={(e) => setPlantFilter(e.target.value)}
              className="px-2.5 py-2 border border-gray-200 rounded-lg text-sm bg-white">
              <option value="">Semua Plant</option>
              {plants.map((p) => <option key={p.plantId} value={p.plantId}>{p.plantName}</option>)}
            </select>
          )}
          <button
            onClick={() => setHasAbnormal(v => !v)}
            className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium border transition-colors ${
              hasAbnormal
                ? 'bg-red-50 text-red-700 border-red-300'
                : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300 hover:bg-gray-50'
            }`}
          >
            <span>⚠</span>
            <span>Ada Hasil Abnormal</span>
          </button>
          {(search || statusFilter || weekFilter || yearFilter || (!userCategory && category) || plantFilter || hasAbnormal) && (
            <button
              onClick={() => { setSearch(''); setStatusFilter(''); setWeekFilter(''); setYearFilter(''); if (!userCategory) setCategory(''); setPlantFilter(''); setHasAbnormal(false); }}
              className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-800 px-2 py-1.5 rounded-lg border border-gray-200 bg-white hover:bg-gray-50 transition-colors"
            >
              <X size={12} /> Reset Filter
            </button>
          )}
          {selected.length > 0 && canDelete('spk') && (
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
                <tr key={s.spkNumber} onClick={() => openDetail(s)}
                  className="hover:bg-gray-50 cursor-pointer">
                  <td className="pl-4 pr-2 py-3" onClick={(e) => e.stopPropagation()}>
                    <input type="checkbox" checked={selected.includes(s.spkNumber)}
                      onChange={() => toggleSelect(s.spkNumber)} className="rounded border-gray-300" />
                  </td>
                  <td className="px-3 py-3 font-mono text-xs font-semibold text-gray-800">{s.spkNumber}</td>
                  <td className="px-3 py-3 text-gray-700 max-w-[200px] truncate">{s.description}</td>
                  <td className="px-3 py-3"><CategoryBadge category={s.category} /></td>
                  <td className="px-3 py-3 text-gray-500 text-xs">{s.interval}</td>
                  <td className="px-3 py-3">
                    <div className="flex flex-col gap-1">
                      <StatusBadge status={s.status} label={
                        s.status === 'awaiting_kasie' && s.category ? `Menunggu Kasie ${s.category}`
                        : s.status === 'awaiting_kadis' ? kadisStatusLabel(s.kadisArea)
                        : undefined
                      } />
                      {s.abnormalCount > 0 && (
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-red-100 text-red-700 w-fit">
                          ⚠ {s.abnormalCount} abnormal
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-3 py-3">
                    {(s.equipmentModels || []).length === 0 ? (
                      <span className="text-gray-400 text-xs">—</span>
                    ) : (
                      <div className="flex flex-col gap-0.5">
                        {(s.equipmentModels || []).slice(0, 2).map((eq) => (
                          <span key={eq.equipmentId} className="text-xs text-gray-700 leading-tight">
                            <span className="font-mono text-gray-500">{eq.equipmentId}</span>
                            {eq.equipmentName && <span className="text-gray-600"> — {eq.equipmentName}</span>}
                          </span>
                        ))}
                        {(s.equipmentModels || []).length > 2 && (
                          <span className="text-[10px] text-gray-400">+{(s.equipmentModels || []).length - 2} lainnya</span>
                        )}
                      </div>
                    )}
                  </td>
                  <td className="px-3 py-3" onClick={(e) => e.stopPropagation()}>
                    <div className="flex gap-1.5">
                      <Button variant="outline" size="sm" className="h-7 text-xs gap-1" onClick={() => openDetail(s)}>
                        <Eye size={11} /> Detail
                      </Button>
                      {canUpdate('spk') && (
                        <Button variant="outline" size="sm" className="h-7 text-xs gap-1" onClick={() => openEdit(s)}>
                          <Pencil size={11} /> Edit
                        </Button>
                      )}
                      {canUpdate('spk') && s.status === 'completed' && (
                        <Button variant="ghost" size="sm" className="h-7 text-xs gap-1 text-amber-600 hover:bg-amber-50" onClick={() => handleReset(s)}>
                          <RotateCcw size={11} /> Reset
                        </Button>
                      )}
                      {canDelete('spk') && (
                        <Button variant="destructive" size="sm" className="h-7 text-xs"
                          onClick={() => setDeleteTarget(s)}>Hapus</Button>
                      )}
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
            <h3 className="text-base font-semibold text-gray-800">Edit SPK</h3>
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
                    {userCategory ? (
                      <div className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-gray-50 text-gray-700 font-medium">
                        {userCategory}
                      </div>
                    ) : (
                      <select value={form.category}
                        onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
                        className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30">
                        {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                      </select>
                    )}
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
                  <PanelField label="Tanggal Mulai" type="date" value={form.scheduledDate} onChange={(v) => setForm((f) => ({ ...f, scheduledDate: v }))} />
                </div>
              </div>
            </section>


            {/* ── Equipment ── */}
            <section>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Equipment</p>
              <input value={eqSearch} onChange={(e) => setEqSearch(e.target.value)}
                placeholder="Cari equipment..." className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm mb-2 focus:outline-none focus:ring-2 focus:ring-blue-500/30" />
              <div className="border border-gray-200 rounded-lg overflow-hidden max-h-48 overflow-y-auto">
                {filteredEq.length === 0 ? (
                  <p className="px-3 py-4 text-xs text-gray-400 text-center">Tidak ada equipment</p>
                ) : filteredEq.map((eq) => (
                  <EqItem key={eq.equipmentId} eq={eq} checked={selectedEqIds.includes(eq.equipmentId)} onToggle={onEqToggle} />
                ))}
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
              {saving ? 'Menyimpan...' : 'Simpan'}
            </Button>
          </div>
        </div>
      )}

      {/* ── SPK Detail Dialog ─────────────────────────────────────────── */}
      <Dialog open={!!detailSpk} onOpenChange={(open) => { if (!open) { setDetailSpk(null); setDetailFull(null); } }}>
        <DialogContent className="w-[95vw] max-w-6xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <div className="flex items-center gap-2 flex-wrap">
              <DialogTitle className="font-mono">{detailSpk?.spkNumber}</DialogTitle>
              {detailSpk?.category && <CategoryBadge category={detailSpk.category} />}
              {detailSpk?.status && <StatusBadge status={detailSpk.status} label={
                detailSpk.status === 'awaiting_kasie' && detailSpk.category ? `Menunggu Kasie ${detailSpk.category}`
                : detailSpk.status === 'awaiting_kadis' ? kadisStatusLabel(detailSpk.kadisArea)
                : undefined
              } />}
            </div>
            {detailSpk?.description && (
              <p className="text-sm text-gray-500 mt-1">{detailSpk.description}</p>
            )}
          </DialogHeader>

          {detailSpk && (
            <div className="space-y-6 mt-2">
              {/* Info grid */}
              <div className="grid grid-cols-3 gap-3 bg-gray-50 border border-gray-200 rounded-lg p-4">
                <SpkField label="Interval" value={detailSpk.interval || '—'} />
                <SpkField label="Scheduled Date" value={detailSpk.scheduledDate ? formatDateShort(detailSpk.scheduledDate) : '—'} />
                {detailFull?.taskListId && (
                  <SpkField
                    label="Daftar Kegiatan"
                    value={detailFull.taskListName ? `${detailFull.taskListId} — ${detailFull.taskListName}` : detailFull.taskListId}
                  />
                )}
                <SpkField label="Minggu ke-" value={detailSpk.weekNumber ? `W${detailSpk.weekNumber} / ${detailSpk.weekYear}` : '—'} />
                <SpkField label="Durasi Aktual" value={detailSpk.durationActual != null ? `${detailSpk.durationActual} menit` : '—'} />
                <SpkField label="Disubmit Oleh" value={detailFull?.submittedByName || detailSpk.submittedBy || '—'} />
                <SpkField label="Submitted At" value={detailSpk.submittedAt ? formatDate(detailSpk.submittedAt) : '—'} />
                {detailSpk.orderNumber && <SpkField label="Order Number" value={detailSpk.orderNumber} />}
                <div>
                  <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide">Status Peralatan</p>
                  {(() => {
                    const st = detailSpk.equipmentStatus || 'Running';
                    const colors = EQUIPMENT_STATUS_COLORS[st] || EQUIPMENT_STATUS_COLORS['Running'];
                    return (
                      <span
                        className="mt-0.5 inline-block px-2 py-0.5 rounded text-xs font-semibold"
                        style={{ backgroundColor: colors.bg, color: colors.text }}
                      >
                        {EQUIPMENT_STATUS_LABELS[st] || st}
                      </span>
                    );
                  })()}
                </div>
              </div>

              {/* Evaluasi */}
              {detailSpk.evaluasi && (
                <div>
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Evaluasi</p>
                  <p className="text-sm text-gray-700 bg-gray-50 border border-gray-200 rounded-lg p-3">{detailSpk.evaluasi}</p>
                </div>
              )}

              {/* Equipment */}
              {detailSpk.equipmentModels?.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
                    Equipment ({detailSpk.equipmentModels.length})
                  </p>
                  <div className="border border-gray-200 rounded-lg overflow-hidden overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead className="bg-gray-50 border-b border-gray-200">
                        <tr>
                          {['Equipment ID', 'Nama', 'Functional Location', 'Plant'].map((h) => (
                            <th key={h} className="px-3 py-2 text-left font-semibold text-gray-600">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {detailSpk.equipmentModels.map((eq) => (
                          <tr key={eq.equipmentId}>
                            <td className="px-3 py-2 font-mono font-semibold text-gray-800">{eq.equipmentId}</td>
                            <td className="px-3 py-2 text-gray-700">{eq.equipmentName || '—'}</td>
                            <td className="px-3 py-2 text-gray-500">{eq.functionalLocation || '—'}</td>
                            <td className="px-3 py-2 text-gray-500">{eq.plantName || '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Activities */}
              {detailSpk.activitiesModel?.length > 0 && (() => {
                const subResults = detailSubs[0]?.activityResultsModel || [];
                const resultMap = new Map(subResults.map(r => [r.activityNumber, r]));
                const hasSubData = subResults.length > 0;
                return (
                  <div>
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
                      Aktivitas ({detailSpk.activitiesModel.length})
                    </p>
                    <div className="border border-gray-200 rounded-lg overflow-hidden overflow-x-auto">
                      <table className="w-full text-xs">
                        <thead className="bg-gray-50 border-b border-gray-200">
                          <tr>
                            {['No.', 'Operasi', 'Plan (mnt)', 'Aktual (mnt)', 'Hasil', 'Nilai Ukur', 'Verified', 'Status'].map((h) => (
                              <th key={h} className="px-3 py-2 text-left font-semibold text-gray-600">{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                          {detailSpk.activitiesModel.map((a) => {
                            const res = resultMap.get(a.activityNumber);
                            const unit = res?.measurementUnit || detectMeasurementUnit(a.operationText);
                            return (
                              <tr key={a.activityNumber} className={res?.isNormal === false ? 'bg-red-50/40' : ''}>
                                <td className="px-3 py-2 font-mono text-gray-500">{a.activityNumber}</td>
                                <td className="px-3 py-2 text-gray-700 max-w-[220px]">{a.operationText}</td>
                                <td className="px-3 py-2 text-gray-500">{a.durationPlan ?? '—'}</td>
                                <td className="px-3 py-2 text-gray-500">{a.durationActual ?? '—'}</td>
                                <td className="px-3 py-2 text-gray-500 max-w-[160px] truncate">{a.resultComment || '—'}</td>
                                <td className="px-3 py-2 font-mono font-semibold text-gray-800">
                                  {res?.measurementValue != null ? `${res.measurementValue}${unit ? ` ${unit}` : ''}` : '—'}
                                </td>
                                <td className="px-3 py-2">
                                  <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-semibold ${a.isVerified ? 'bg-blue-50 text-blue-700' : 'bg-gray-100 text-gray-400'}`}>
                                    {a.isVerified ? '✓ Ya' : '—'}
                                  </span>
                                </td>
                                <td className="px-3 py-2">
                                  {hasSubData ? (
                                    <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${res?.isNormal === false ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
                                      {res?.isNormal === false ? 'Tidak Normal' : 'Normal'}
                                    </span>
                                  ) : '—'}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                );
              })()}

              {/* Approval history */}
              {detailFull && (
                <div>
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Riwayat Approval</p>
                  <div className="relative pl-5">
                    {/* vertical line */}
                    <div className="absolute left-[9px] top-3 bottom-3 w-px bg-gray-200" />
                    {[
                      {
                        label: 'Submit Teknisi',
                        name: detailFull.submittedByName || detailFull.submittedBy,
                        at: detailFull.submittedAt,
                        done: !!detailFull.submittedAt,
                      },
                      {
                        label: 'Kasie',
                        name: detailFull.kasieApprovedByName || detailFull.kasieApprovedBy,
                        at: detailFull.kasieApprovedAt,
                        done: !!detailFull.kasieApprovedAt,
                      },
                      {
                        label: 'Kadis Perawatan',
                        name: detailFull.kadisPerawatanApprovedByName || detailFull.kadisPerawatanApprovedBy,
                        at: detailFull.kadisPerawatanApprovedAt,
                        done: !!detailFull.kadisPerawatanApprovedAt,
                      },
                      {
                        label: 'Kadis',
                        name: detailFull.kadisApprovedByName || detailFull.kadisApprovedBy,
                        at: detailFull.kadisApprovedAt,
                        done: !!detailFull.kadisApprovedAt,
                      },
                    ].map((step, i) => (
                      <div key={i} className="relative flex items-start gap-3 mb-3 last:mb-0">
                        <div className={`relative z-10 mt-0.5 shrink-0 w-[18px] h-[18px] rounded-full flex items-center justify-center ${step.done ? 'bg-green-500' : 'bg-gray-200'}`}>
                          {step.done
                            ? <CheckCircle2 size={12} className="text-white" />
                            : <Circle size={10} className="text-gray-400" />
                          }
                        </div>
                        <div>
                          <p className={`text-xs font-semibold ${step.done ? 'text-gray-800' : 'text-gray-400'}`}>{step.label}</p>
                          {step.done ? (
                            <p className="text-xs text-gray-500">
                              {step.name || '—'} &middot; {formatDate(step.at)}
                            </p>
                          ) : (
                            <p className="text-xs text-gray-400">Menunggu</p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Rejection history */}
              {detailFull && (detailFull.rejectionLogs || []).length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Riwayat Penolakan</p>
                  <div className="space-y-2">
                    {(detailFull.rejectionLogs || []).map((log, i) => {
                      const levelLabel = log.rejectedLevel === 'kasie' ? 'Kasie'
                        : log.rejectedLevel === 'kadis_perawatan' ? 'Kadis Perawatan'
                        : 'Kadis';
                      return (
                        <div key={i} className="bg-red-50 border border-red-100 rounded-lg p-3">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-[10px] font-bold bg-red-600 text-white px-1.5 py-0.5 rounded uppercase">
                              {levelLabel}
                            </span>
                            <span className="text-xs text-gray-500">
                              {log.rejectedBy} &middot; {formatDate(log.rejectedAt)}
                            </span>
                          </div>
                          <p className="text-xs text-red-800">{log.rejectionReason}</p>
                          {log.resubmittedAt && (
                            <p className="text-xs text-green-600 mt-1 italic">
                              Kirim ulang: {formatDate(log.resubmittedAt)}
                            </p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Submission history */}
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
                  Riwayat Submission {!loadingSubs && `(${detailSubs.length})`}
                </p>
                {loadingSubs ? (
                  <p className="text-xs text-gray-400 py-3">Memuat...</p>
                ) : detailSubs.length === 0 ? (
                  <p className="text-xs text-gray-400 py-3">Belum ada submission untuk SPK ini.</p>
                ) : (
                  <div className="border border-gray-200 rounded-lg overflow-hidden">
                    <table className="w-full text-xs">
                      <thead className="bg-gray-50 border-b border-gray-200">
                        <tr>
                          {['Work Start', 'Work Finish', 'Durasi (mnt)', 'Lokasi'].map((h) => (
                            <th key={h} className="px-3 py-2 text-left font-semibold text-gray-600">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {detailSubs.map((sub) => (
                          <Fragment key={sub.id}>
                            <tr>
                              <td className="px-3 py-2 text-gray-600">{sub.workStart ? formatDate(sub.workStart) : '—'}</td>
                              <td className="px-3 py-2 text-gray-600">{formatDate(sub.submittedAt)}</td>
                              <td className="px-3 py-2 text-gray-500">{sub.durationActual ?? '—'}</td>
                              <td className="px-3 py-2">
                                {sub.latitude != null ? (
                                  <a href={`https://maps.google.com/?q=${sub.latitude},${sub.longitude}`}
                                    target="_blank" rel="noreferrer"
                                    className="inline-flex items-center gap-1 text-blue-600 hover:underline"
                                    onClick={(e) => e.stopPropagation()}>
                                    <MapPin size={10} />
                                    {parseFloat(sub.latitude).toFixed(4)}, {parseFloat(sub.longitude).toFixed(4)}
                                  </a>
                                ) : '—'}
                              </td>
                            </tr>
                            {(sub.photoPaths || []).length > 0 && (
                              <tr>
                                <td colSpan={4} className="px-3 pb-3 pt-1">
                                  <p className="text-[10px] font-semibold text-gray-400 uppercase mb-1.5">
                                    Foto Lapangan ({sub.photoPaths.length})
                                  </p>
                                  <div className="flex flex-wrap gap-2">
                                    {sub.photoPaths.map((path, i) => (
                                      <button
                                        key={path}
                                        onClick={(e) => { e.stopPropagation(); setLightbox(path); }}
                                        className="w-16 h-16 rounded-lg overflow-hidden border border-gray-200 hover:border-blue-400 transition-colors shrink-0"
                                      >
                                        <img
                                          src={`${UPLOADS_BASE}/${path.replace(/^\//, '')}`}
                                          alt={`Foto ${i + 1}`}
                                          className="w-full h-full object-cover"
                                          onError={(e) => { e.target.style.display = 'none'; }}
                                        />
                                      </button>
                                    ))}
                                  </div>
                                </td>
                              </tr>
                            )}
                            {(sub.evaluasi || sub.lateReason) && (
                              <tr>
                                <td colSpan={4} className="px-3 pb-3 pt-0">
                                  <div className="space-y-1.5">
                                    {sub.evaluasi && (
                                      <div className="bg-gray-50 border border-gray-200 rounded-lg p-2.5">
                                        <p className="text-[10px] font-semibold text-gray-400 uppercase mb-1">Evaluasi Teknisi</p>
                                        <p className="text-xs text-gray-700">{sub.evaluasi}</p>
                                      </div>
                                    )}
                                    {sub.lateReason && (
                                      <div className="bg-amber-50 border border-amber-200 rounded-lg p-2.5">
                                        <p className="text-[10px] font-semibold text-amber-600 uppercase mb-1">Alasan Terlambat</p>
                                        <p className="text-xs text-amber-800">{sub.lateReason}</p>
                                      </div>
                                    )}
                                  </div>
                                </td>
                              </tr>
                            )}
                          </Fragment>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <ConfirmDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}
        title={`Hapus SPK ${deleteTarget?.spkNumber}?`} description="Aksi ini tidak dapat diurungkan."
        onConfirm={handleDelete} confirmLabel="Hapus" destructive />
      <ConfirmDialog open={bulkDeleteOpen} onOpenChange={setBulkDeleteOpen}
        title={`Hapus ${selected.length} SPK?`} description="Aksi ini tidak dapat diurungkan."
        onConfirm={handleBulkDelete} confirmLabel="Hapus Semua" destructive />

      {/* Photo lightbox */}
      {lightbox && (
        <div
          className="fixed inset-0 z-[100] bg-black/80 flex items-center justify-center p-4"
          onClick={() => setLightbox(null)}
        >
          <button
            className="absolute top-4 right-4 text-white/70 hover:text-white"
            onClick={() => setLightbox(null)}
          >
            <X size={24} />
          </button>
          <img
            src={`${UPLOADS_BASE}/${lightbox.replace(/^\//, '')}`}
            alt="Foto lapangan"
            className="max-h-[85vh] max-w-full rounded-lg shadow-2xl object-contain"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </div>
  );
}

function SpkField({ label, value }) {
  return (
    <div>
      <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide">{label}</p>
      <p className="text-sm font-medium text-gray-800 mt-0.5">{value}</p>
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
