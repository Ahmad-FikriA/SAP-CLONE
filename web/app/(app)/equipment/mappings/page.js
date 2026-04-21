'use client';

import { useState, useEffect, useRef } from 'react';
import { toast } from 'sonner';
import { apiGet, apiPost, apiPut, apiDelete, apiUpload } from '@/lib/api';
import { CategoryBadge } from '@/components/shared/StatusBadge';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import { CATEGORIES, INTERVALS } from '@/lib/constants';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Plus, Upload, RefreshCw } from 'lucide-react';

const TABS = ['Mappings', 'Task Lists'];

export default function MappingsPage() {
  const [tab, setTab] = useState('Mappings');
  const [mappings, setMappings] = useState([]);
  const [taskLists, setTaskLists] = useState([]);
  const [equipment, setEquipment] = useState([]);
  const [loading, setLoading] = useState(true);

  // Mapping form
  const [addMappingOpen, setAddMappingOpen] = useState(false);
  const [mappingForm, setMappingForm] = useState({ equipmentId: '', interval: '', taskListId: '' });
  const [deleteMapping, setDeleteMapping] = useState(null);

  // Mapping table filters
  const [mapSearch, setMapSearch] = useState('');
  const [mapInterval, setMapInterval] = useState('');
  const [mapTaskList, setMapTaskList] = useState('');

  // Equipment searchable combobox (in Add Mapping dialog)
  const [eqSearch, setEqSearch] = useState('');
  const [eqDropdownOpen, setEqDropdownOpen] = useState(false);
  const eqDropdownRef = useRef(null);

  // Bulk mapping
  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkInterval, setBulkInterval] = useState('');
  const [bulkTaskListId, setBulkTaskListId] = useState('');
  const [bulkSearch, setBulkSearch] = useState('');
  const [bulkSelected, setBulkSelected] = useState([]);

  // Pagination
  const [mapPage, setMapPage] = useState(1);
  const [tlPage, setTlPage] = useState(1);
  const PAGE_SIZE = 20;

  // Task list search + import
  const [tlSearch, setTlSearch] = useState('');
  const tlFileRef = useRef(null);

  // Task list form
  const [tlPanelOpen, setTlPanelOpen] = useState(false);
  const [tlEditId, setTlEditId] = useState(null);
  const [tlForm, setTlForm] = useState({ taskListId: '', taskListName: '', category: '', workCenter: '', activities: [] });
  const [deleteTl, setDeleteTl] = useState(null);

  useEffect(() => { loadAll(); }, []);
  useEffect(() => { setMapPage(1); }, [mapSearch, mapInterval, mapTaskList]);
  useEffect(() => { setTlPage(1); }, [tlSearch]);

  // Close equipment combobox on outside click
  useEffect(() => {
    function handleClickOutside(e) {
      if (eqDropdownRef.current && !eqDropdownRef.current.contains(e.target)) {
        setEqDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  async function loadAll() {
    setLoading(true);
    try {
      const [m, tl, eq] = await Promise.all([
        apiGet('/equipment-mappings'),
        apiGet('/task-lists'),
        apiGet('/equipment?limit=9999'),
      ]);
      setMappings(m);
      setTaskLists(tl);
      setEquipment(eq.data || eq);
    } catch (e) { toast.error('Gagal memuat: ' + e.message); }
    finally { setLoading(false); }
  }

  // ── Derived filtered lists ─────────────────────────────────────────────────
  const filteredMappings = mappings.filter((m) => {
    const eq = equipment.find((e) => e.equipmentId === m.equipmentId);
    const q = mapSearch.toLowerCase();
    const matchSearch = !q || m.equipmentId.toLowerCase().includes(q) || (eq?.equipmentName || '').toLowerCase().includes(q);
    const matchInterval = !mapInterval || m.interval === mapInterval;
    const matchTl = !mapTaskList || (m.taskListId || '').toLowerCase().includes(mapTaskList.toLowerCase());
    return matchSearch && matchInterval && matchTl;
  });

  const filteredEqForDialog = equipment.filter((eq) => {
    const q = eqSearch.toLowerCase();
    return !q || eq.equipmentId.toLowerCase().includes(q) || eq.equipmentName.toLowerCase().includes(q);
  });

  const mapTotalPages = Math.max(1, Math.ceil(filteredMappings.length / PAGE_SIZE));
  const mapPageSafe = Math.min(mapPage, mapTotalPages);
  const pagedMappings = filteredMappings.slice((mapPageSafe - 1) * PAGE_SIZE, mapPageSafe * PAGE_SIZE);

  // ── Mapping actions ────────────────────────────────────────────────────────
  async function addMapping() {
    const { equipmentId, interval } = mappingForm;
    if (!equipmentId || !interval) { toast.error('Equipment dan interval wajib diisi'); return; }
    try {
      await apiPost('/equipment-mappings', mappingForm);
      toast.success('Mapping ditambahkan');
      setAddMappingOpen(false);
      loadAll();
    } catch (e) { toast.error(e.message); }
  }

  async function handleDeleteMapping() {
    try {
      await apiDelete(`/equipment-mappings/${deleteMapping.id}`);
      toast.success('Mapping dihapus');
      setDeleteMapping(null);
      loadAll();
    } catch (e) { toast.error(e.message); }
  }

  // ── Bulk mapping ───────────────────────────────────────────────────────────
  const bulkFiltered = equipment.filter((eq) => {
    const q = bulkSearch.toLowerCase();
    return !q || eq.equipmentId.toLowerCase().includes(q) || eq.equipmentName.toLowerCase().includes(q);
  });

  async function saveBulk() {
    if (!bulkInterval || !bulkSelected.length) { toast.error('Pilih interval dan equipment'); return; }
    try {
      await apiPost('/equipment-mappings/bulk', { equipmentIds: bulkSelected, interval: bulkInterval, taskListId: bulkTaskListId || null });
      toast.success(`${bulkSelected.length} mapping ditambahkan`);
      setBulkOpen(false);
      setBulkSelected([]);
      loadAll();
    } catch (e) { toast.error(e.message); }
  }

  // ── Task list actions ──────────────────────────────────────────────────────
  function openCreateTl() {
    setTlEditId(null);
    setTlForm({ taskListId: '', taskListName: '', category: '', workCenter: '', activities: [] });
    setTlPanelOpen(true);
  }

  function openEditTl(tl) {
    setTlEditId(tl.taskListId);
    setTlForm({ taskListId: tl.taskListId, taskListName: tl.taskListName, category: tl.category, workCenter: tl.workCenter || '', activities: [...(tl.activities || [])] });
    setTlPanelOpen(true);
  }

  async function saveTl() {
    const { taskListId, taskListName, category } = tlForm;
    if (!taskListId || !taskListName || !category) { toast.error('ID, Nama, dan Kategori wajib'); return; }
    try {
      if (tlEditId) {
        await apiPut(`/task-lists/${tlEditId}`, tlForm);
        toast.success('Task list diperbarui');
      } else {
        await apiPost('/task-lists', tlForm);
        toast.success('Task list ditambahkan');
      }
      setTlPanelOpen(false);
      loadAll();
    } catch (e) { toast.error(e.message); }
  }

  async function handleDeleteTl() {
    try {
      await apiDelete(`/task-lists/${deleteTl.taskListId}`);
      toast.success('Task list dihapus');
      setDeleteTl(null);
      loadAll();
    } catch (e) { toast.error(e.message); }
  }

  async function importTlExcel(e) {
    const file = e.target.files[0];
    if (!file) return;
    e.target.value = '';
    const fd = new FormData();
    fd.append('file', file);
    try {
      const data = await apiUpload('/task-lists/import-excel', fd);
      toast.success(data.message || 'Import selesai');
      loadAll();
    } catch (err) { toast.error('Import gagal: ' + err.message); }
  }

  const filteredTaskLists = taskLists.filter((tl) => {
    const q = tlSearch.toLowerCase();
    return !q || tl.taskListId.toLowerCase().includes(q) || tl.taskListName.toLowerCase().includes(q);
  });

  const tlTotalPages = Math.max(1, Math.ceil(filteredTaskLists.length / PAGE_SIZE));
  const tlPageSafe = Math.min(tlPage, tlTotalPages);
  const pagedTaskLists = filteredTaskLists.slice((tlPageSafe - 1) * PAGE_SIZE, tlPageSafe * PAGE_SIZE);

  function addActivity() {
    setTlForm((f) => ({ ...f, activities: [...f.activities, { stepNumber: f.activities.length + 1, operationText: '' }] }));
  }

  function removeActivity(idx) {
    setTlForm((f) => {
      const acts = f.activities.filter((_, i) => i !== idx).map((a, i) => ({ ...a, stepNumber: i + 1 }));
      return { ...f, activities: acts };
    });
  }

  function updateActivity(idx, text) {
    setTlForm((f) => {
      const acts = [...f.activities];
      acts[idx] = { ...acts[idx], operationText: text };
      return { ...f, activities: acts };
    });
  }

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-xl font-semibold text-gray-800">Task Mapping</h2>
          <p className="text-sm text-gray-500">Kelola mapping equipment ke task list</p>
        </div>
        <Button variant="outline" size="sm" onClick={loadAll}><RefreshCw size={13} /></Button>
      </div>

      {/* Tabs */}
      <div className="flex gap-0 border border-gray-200 rounded-lg overflow-hidden w-fit">
        {TABS.map((t) => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-medium transition-colors ${tab === t ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}>
            {t}
          </button>
        ))}
      </div>

      {tab === 'Mappings' && (
        <div className="space-y-3">
          <div className="flex gap-2">
            <Button size="sm" onClick={() => setAddMappingOpen(true)} className="gap-1.5"><Plus size={13} /> Tambah Mapping</Button>
            <Button variant="outline" size="sm" onClick={() => { setBulkSelected([]); setBulkOpen(true); }}>Bulk Mapping</Button>
          </div>

          {/* Filter bar */}
          <div className="flex gap-2 flex-wrap items-center">
            <input value={mapSearch} onChange={(e) => setMapSearch(e.target.value)}
              placeholder="Cari equipment ID atau nama..."
              className="flex-1 min-w-48 max-w-sm px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30" />
            <select value={mapInterval} onChange={(e) => setMapInterval(e.target.value)}
              className="px-3 py-2 border border-gray-200 rounded-lg text-sm">
              <option value="">Semua interval</option>
              {INTERVALS.map((iv) => <option key={iv} value={iv}>{iv}</option>)}
            </select>
            <input value={mapTaskList} onChange={(e) => setMapTaskList(e.target.value)}
              placeholder="Filter task list..."
              className="w-40 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30" />
            <span className="text-xs text-gray-400">{filteredMappings.length} dari {mappings.length}</span>
          </div>

          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  {['Equipment', 'Interval', 'Task List', 'Aktivitas', 'Aksi'].map((h) => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {loading ? <tr><td colSpan={5} className="px-4 py-8 text-center text-gray-400">Memuat...</td></tr>
                  : filteredMappings.length === 0 ? <tr><td colSpan={5} className="px-4 py-8 text-center text-gray-400">{mappings.length === 0 ? 'Belum ada mapping' : 'Tidak ada hasil'}</td></tr>
                  : pagedMappings.map((m) => {
                    const tl = taskLists.find((t) => t.taskListId === m.taskListId);
                    const eq = equipment.find((e) => e.equipmentId === m.equipmentId);
                    return (
                      <tr key={m.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3">
                          <div className="font-mono text-xs font-semibold text-gray-800">{m.equipmentId}</div>
                          {eq && <div className="text-xs text-gray-400 mt-0.5 max-w-xs truncate">{eq.equipmentName}</div>}
                        </td>
                        <td className="px-4 py-3 text-gray-600">{m.interval}</td>
                        <td className="px-4 py-3 text-gray-500 text-xs">{m.taskListId || '—'}</td>
                        <td className="px-4 py-3 text-gray-500 text-xs">{tl ? tl.activities?.length + ' aktivitas' : '—'}</td>
                        <td className="px-4 py-3">
                          <Button variant="destructive" size="sm" className="h-7 text-xs" onClick={() => setDeleteMapping(m)}>Hapus</Button>
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
          {!loading && mapTotalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100 bg-gray-50">
              <span className="text-xs text-gray-500">Halaman {mapPageSafe} dari {mapTotalPages}</span>
              <div className="flex gap-1.5">
                <Button variant="outline" size="sm" className="h-7 text-xs" disabled={mapPageSafe <= 1} onClick={() => setMapPage((p) => p - 1)}>‹ Prev</Button>
                <Button variant="outline" size="sm" className="h-7 text-xs" disabled={mapPageSafe >= mapTotalPages} onClick={() => setMapPage((p) => p + 1)}>Next ›</Button>
              </div>
            </div>
          )}
        </div>
      )}

      {tab === 'Task Lists' && (
        <div className="space-y-3">
          <div className="flex gap-2 flex-wrap items-center">
            <input value={tlSearch} onChange={(e) => setTlSearch(e.target.value)}
              placeholder="Cari ID atau nama..."
              className="flex-1 max-w-sm px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30" />
            <Button variant="outline" size="sm" onClick={() => tlFileRef.current?.click()} className="gap-1.5">
              <Upload size={13} /> Import Excel
            </Button>
            <input ref={tlFileRef} type="file" accept=".xlsx" onChange={importTlExcel} className="hidden" />
            <Button size="sm" onClick={openCreateTl} className="gap-1.5"><Plus size={13} /> Tambah Task List</Button>
          </div>
          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  {['ID', 'Nama', 'Kategori', 'Work Center', 'Aktivitas', 'Aksi'].map((h) => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {loading ? <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-400">Memuat...</td></tr>
                  : filteredTaskLists.length === 0 ? <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-400">Belum ada task list</td></tr>
                  : pagedTaskLists.map((tl) => (
                    <tr key={tl.taskListId} className="hover:bg-gray-50">
                      <td className="px-4 py-3 font-mono text-xs font-semibold text-gray-800">{tl.taskListId}</td>
                      <td className="px-4 py-3 text-gray-700">{tl.taskListName}</td>
                      <td className="px-4 py-3"><CategoryBadge category={tl.category} /></td>
                      <td className="px-4 py-3 text-gray-500 text-xs">{tl.workCenter || '—'}</td>
                      <td className="px-4 py-3 text-gray-500 text-xs">{(tl.activities || []).length}</td>
                      <td className="px-4 py-3">
                        <div className="flex gap-1.5">
                          <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => openEditTl(tl)}>Edit</Button>
                          <Button variant="destructive" size="sm" className="h-7 text-xs" onClick={() => setDeleteTl(tl)}>Hapus</Button>
                        </div>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          {!loading && tlTotalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100 bg-gray-50">
              <span className="text-xs text-gray-500">Halaman {tlPageSafe} dari {tlTotalPages}</span>
              <div className="flex gap-1.5">
                <Button variant="outline" size="sm" className="h-7 text-xs" disabled={tlPageSafe <= 1} onClick={() => setTlPage((p) => p - 1)}>‹ Prev</Button>
                <Button variant="outline" size="sm" className="h-7 text-xs" disabled={tlPageSafe >= tlTotalPages} onClick={() => setTlPage((p) => p + 1)}>Next ›</Button>
              </div>
            </div>
          )}
          </div>
        </div>
      )}

      {/* Add mapping dialog */}
      <Dialog open={addMappingOpen} onOpenChange={(open) => { setAddMappingOpen(open); if (!open) { setEqSearch(''); setEqDropdownOpen(false); } }}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Tambah Mapping</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Equipment</label>
              <div className="relative" ref={eqDropdownRef}>
                <input
                  value={mappingForm.equipmentId
                    ? `${mappingForm.equipmentId} — ${equipment.find((e) => e.equipmentId === mappingForm.equipmentId)?.equipmentName || ''}`
                    : eqSearch}
                  onChange={(e) => { setEqSearch(e.target.value); setMappingForm({ ...mappingForm, equipmentId: '' }); setEqDropdownOpen(true); }}
                  onFocus={() => setEqDropdownOpen(true)}
                  placeholder="Cari equipment..."
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                />
                {eqDropdownOpen && filteredEqForDialog.length > 0 && (
                  <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                    {filteredEqForDialog.slice(0, 50).map((eq) => (
                      <button key={eq.equipmentId} type="button"
                        className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-blue-50 text-left"
                        onClick={() => { setMappingForm({ ...mappingForm, equipmentId: eq.equipmentId }); setEqSearch(''); setEqDropdownOpen(false); }}>
                        <span className="font-mono text-xs font-semibold text-gray-800 shrink-0">{eq.equipmentId}</span>
                        <span className="text-xs text-gray-400 truncate">{eq.equipmentName}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Interval</label>
              <select value={mappingForm.interval} onChange={(e) => setMappingForm({ ...mappingForm, interval: e.target.value })}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm">
                <option value="">Pilih interval...</option>
                {INTERVALS.map((iv) => <option key={iv} value={iv}>{iv}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Task List (opsional)</label>
              <select value={mappingForm.taskListId} onChange={(e) => setMappingForm({ ...mappingForm, taskListId: e.target.value })}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm">
                <option value="">Tidak ada</option>
                {taskLists.map((tl) => <option key={tl.taskListId} value={tl.taskListId}>{tl.taskListId} — {tl.taskListName}</option>)}
              </select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setAddMappingOpen(false)}>Batal</Button>
            <Button onClick={addMapping}>Tambah</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bulk mapping dialog */}
      <Dialog open={bulkOpen} onOpenChange={setBulkOpen}>
        <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Bulk Mapping</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Interval *</label>
                <select value={bulkInterval} onChange={(e) => setBulkInterval(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm">
                  <option value="">Pilih...</option>
                  {INTERVALS.map((iv) => <option key={iv} value={iv}>{iv}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Task List</label>
                <select value={bulkTaskListId} onChange={(e) => setBulkTaskListId(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm">
                  <option value="">Tidak ada</option>
                  {taskLists.map((tl) => <option key={tl.taskListId} value={tl.taskListId}>{tl.taskListId}</option>)}
                </select>
              </div>
            </div>
            <input value={bulkSearch} onChange={(e) => setBulkSearch(e.target.value)}
              placeholder="Cari equipment..."
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm" />
            <div className="flex items-center gap-2 mb-1">
              <input type="checkbox" checked={bulkSelected.length === bulkFiltered.length && bulkFiltered.length > 0}
                onChange={(e) => setBulkSelected(e.target.checked ? bulkFiltered.map((eq) => eq.equipmentId) : [])}
                className="rounded border-gray-300" />
              <span className="text-xs text-gray-500">{bulkSelected.length} dipilih</span>
            </div>
            <div className="max-h-48 overflow-y-auto border border-gray-200 rounded-lg divide-y divide-gray-100">
              {bulkFiltered.map((eq) => (
                <label key={eq.equipmentId} className="flex items-center gap-2.5 px-3 py-2 hover:bg-gray-50 cursor-pointer">
                  <input type="checkbox" checked={bulkSelected.includes(eq.equipmentId)}
                    onChange={() => setBulkSelected((prev) => prev.includes(eq.equipmentId) ? prev.filter((x) => x !== eq.equipmentId) : [...prev, eq.equipmentId])}
                    className="rounded border-gray-300" />
                  <span className="font-mono text-xs text-gray-700">{eq.equipmentId}</span>
                  <span className="text-xs text-gray-400 truncate">{eq.equipmentName}</span>
                </label>
              ))}
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setBulkOpen(false)}>Batal</Button>
            <Button onClick={saveBulk} disabled={!bulkSelected.length}>Simpan ({bulkSelected.length})</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Task list panel */}
      <Dialog open={tlPanelOpen} onOpenChange={setTlPanelOpen}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{tlEditId ? 'Edit Task List' : 'Tambah Task List'}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Task List ID *</label>
                <input value={tlForm.taskListId} onChange={(e) => setTlForm({ ...tlForm, taskListId: e.target.value })}
                  disabled={!!tlEditId}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm disabled:bg-gray-50" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Nama *</label>
                <input value={tlForm.taskListName} onChange={(e) => setTlForm({ ...tlForm, taskListName: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Kategori *</label>
                <select value={tlForm.category} onChange={(e) => setTlForm({ ...tlForm, category: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm">
                  <option value="">Pilih...</option>
                  {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Work Center</label>
                <input value={tlForm.workCenter} onChange={(e) => setTlForm({ ...tlForm, workCenter: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm" />
              </div>
            </div>
            {/* Activities */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-semibold text-gray-600">Aktivitas</label>
                <Button variant="outline" size="sm" className="h-6 text-xs" onClick={addActivity}>+ Tambah Langkah</Button>
              </div>
              <div className="space-y-1.5">
                {tlForm.activities.map((act, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <span className="text-xs text-gray-400 w-5 text-right shrink-0">{act.stepNumber}.</span>
                    <input value={act.operationText} onChange={(e) => updateActivity(idx, e.target.value)}
                      placeholder="Teks operasi..."
                      className="flex-1 px-2.5 py-1.5 border border-gray-200 rounded text-xs" />
                    <Button variant="ghost" size="sm" className="h-6 w-6 p-0 text-red-400 hover:text-red-600" onClick={() => removeActivity(idx)}>×</Button>
                  </div>
                ))}
                {tlForm.activities.length === 0 && <p className="text-xs text-gray-400 italic">Belum ada aktivitas</p>}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setTlPanelOpen(false)}>Batal</Button>
            <Button onClick={saveTl}>{tlEditId ? 'Simpan' : 'Tambah'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog open={!!deleteMapping} onOpenChange={(o) => !o && setDeleteMapping(null)}
        title="Hapus mapping ini?" onConfirm={handleDeleteMapping} confirmLabel="Hapus" destructive />
      <ConfirmDialog open={!!deleteTl} onOpenChange={(o) => !o && setDeleteTl(null)}
        title={`Hapus task list ${deleteTl?.taskListId}?`} description="Semua mapping terkait akan ikut terhapus."
        onConfirm={handleDeleteTl} confirmLabel="Hapus" destructive />
    </div>
  );
}
