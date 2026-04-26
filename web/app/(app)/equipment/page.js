'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { toast } from 'sonner';
import { apiGet, apiPost, apiPut, apiDelete, apiUpload } from '@/lib/api';
import { CategoryBadge } from '@/components/shared/StatusBadge';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import { CATEGORIES } from '@/lib/constants';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { MapPin, Plus, RefreshCw, Upload, BarChart2, Download, QrCode } from 'lucide-react';
import Link from 'next/link';
import dynamic from 'next/dynamic';

const MapWithMarkers = dynamic(() => import('@/components/map/EquipmentMap'), { ssr: false });
const QRCode = dynamic(() => import('react-qr-code'), { ssr: false });

const PAGE_SIZE = 20;
const EMPTY_FORM = { equipmentId: '', equipmentName: '', functionalLocation: '', funcLocId: '', category: '', plantId: '', latitude: '', longitude: '' };

export default function EquipmentPage() {
  const [equipment, setEquipment]   = useState([]);
  const [plants, setPlants]         = useState([]);
  const [total, setTotal]           = useState(0);
  const [page, setPage]             = useState(0);
  const [loading, setLoading]       = useState(true);
  const [search, setSearch]         = useState('');
  const [category, setCategory]     = useState('');
  const [plantFilter, setPlantFilter] = useState('');
  const [panelOpen, setPanelOpen]   = useState(false);
  const [editingId, setEditingId]   = useState(null);
  const [form, setForm]             = useState(EMPTY_FORM);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [qrTarget, setQrTarget] = useState(null); // equipment shown in QR dialog
  const fileRef = useRef(null);
  const mapCallbackRef = useRef(null);  // refreshes markers
  const flyToRef = useRef(null);        // pans map to a coordinate

  useEffect(() => {
    apiGet('/maps').then(setPlants).catch(() => {});
    loadMapMarkers();
  }, []);

  useEffect(() => {
    load(0);
  }, [category, plantFilter, search]); // eslint-disable-line react-hooks/exhaustive-deps

  // Loads ALL equipment with coordinates for the map — independent of table filters/pagination
  async function loadMapMarkers() {
    try {
      const data = await apiGet('/equipment?limit=9999');
      const items = data.data || data;
      if (mapCallbackRef.current) mapCallbackRef.current(items);
    } catch { /* silent — map just shows fewer pins */ }
  }

  async function load(p = page) {
    setLoading(true);
    try {
      const params = new URLSearchParams({ limit: PAGE_SIZE, offset: p * PAGE_SIZE });
      if (category) params.set('category', category);
      if (plantFilter) params.set('plantId', plantFilter);
      if (search) params.set('search', search);
      const data = await apiGet(`/equipment?${params}`);
      const items = data.data || data;
      setEquipment(items);
      setTotal(data.total || items.length);
      setPage(p);
    } catch (e) {
      toast.error('Gagal memuat: ' + e.message);
    } finally {
      setLoading(false);
    }
  }

  function openCreate() {
    setEditingId(null);
    setForm({ ...EMPTY_FORM, plantId: plantFilter });
    setPanelOpen(true);
  }

  function openEdit(eq) {
    setEditingId(eq.equipmentId);
    setForm({
      equipmentId: eq.equipmentId,
      equipmentName: eq.equipmentName,
      functionalLocation: eq.functionalLocation || '',
      funcLocId: eq.funcLocId || '',
      category: eq.category,
      plantId: eq.plantId || '',
      latitude: eq.latitude ?? '',
      longitude: eq.longitude ?? '',
    });
    setPanelOpen(true);
  }

  function pinToMap(eq) {
    if (eq.latitude == null || eq.longitude == null) {
      toast.error('Equipment ini tidak memiliki koordinat');
      return;
    }
    if (flyToRef.current) flyToRef.current(eq.latitude, eq.longitude, 17);
    else toast.error('Peta belum siap');
  }

  async function saveEquipment() {
    const { equipmentId, equipmentName, category: cat } = form;
    if (!equipmentId || !equipmentName || !cat) {
      toast.error('ID, Nama, dan Kategori wajib diisi.');
      return;
    }
    const body = {
      ...form,
      latitude: form.latitude !== '' ? parseFloat(form.latitude) : null,
      longitude: form.longitude !== '' ? parseFloat(form.longitude) : null,
    };
    try {
      if (editingId) {
        await apiPut(`/equipment/${editingId}`, body);
        toast.success(`Equipment ${equipmentId} diperbarui`);
      } else {
        await apiPost('/equipment', body);
        toast.success(`Equipment ${equipmentId} ditambahkan`);
      }
      setPanelOpen(false);
      load(0);
      loadMapMarkers();
    } catch (e) { toast.error(e.message); }
  }

  async function handleDelete() {
    try {
      await apiDelete(`/equipment/${deleteTarget.equipmentId}`);
      toast.success('Equipment dihapus');
      setDeleteTarget(null);
      load(0);
      loadMapMarkers();
    } catch (e) { toast.error(e.message); }
  }

  async function exportCoordinates() {
    try {
      const data = await apiGet('/equipment?limit=9999');
      const items = data.data || data;
      const withCoords = items.filter((eq) => eq.latitude != null && eq.longitude != null);
      if (!withCoords.length) { toast.error('Tidak ada equipment dengan koordinat'); return; }
      const header = ['equipmentId', 'equipmentName', 'category', 'functionalLocation', 'plantId', 'latitude', 'longitude'];
      const rows = withCoords.map((eq) => [
        eq.equipmentId, eq.equipmentName, eq.category || '',
        eq.functionalLocation || eq.funcLocId || '', eq.plantId || '',
        eq.latitude, eq.longitude,
      ]);
      const csv = [header, ...rows]
        .map((r) => r.map((v) => `"${String(v ?? '').replace(/"/g, '""')}"`).join(','))
        .join('\n');
      const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = 'equipment-koordinat.csv'; a.click();
      URL.revokeObjectURL(url);
      toast.success(`${withCoords.length} equipment diekspor`);
    } catch (e) { toast.error('Gagal ekspor: ' + e.message); }
  }

  async function importExcel(e) {
    const file = e.target.files[0];
    if (!file) return;
    e.target.value = '';
    const fd = new FormData();
    fd.append('file', file);
    try {
      const data = await apiUpload('/equipment/import-excel', fd);
      toast.success(data.message || 'Import selesai');
      load(0);
      loadMapMarkers();
    } catch (err) { toast.error('Import gagal: ' + err.message); }
  }

  // Called by map when user clicks — fills form lat/lng
  const onMapCoord = useCallback((lat, lng) => {
    setForm((f) => ({ ...f, latitude: lat.toFixed(6), longitude: lng.toFixed(6) }));
  }, []);

  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-xl font-semibold text-gray-800">Equipment</h2>
          <p className="text-sm text-gray-500">{total} equipment</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button variant="outline" size="sm" onClick={() => load(0)}><RefreshCw size={13} /></Button>
          <Button variant="outline" size="sm" onClick={exportCoordinates} className="gap-1.5">
            <Download size={13} /> Export Koordinat
          </Button>
          <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()} className="gap-1.5">
            <Upload size={13} /> Import Excel
          </Button>
          <input ref={fileRef} type="file" accept=".xlsx" onChange={importExcel} className="hidden" />
          <Button size="sm" onClick={openCreate} className="gap-1.5"><Plus size={14} /> Tambah</Button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-3 flex-wrap">
        <input value={search} onChange={(e) => setSearch(e.target.value)}
          placeholder="Cari ID, nama, atau funcloc..." className="flex-1 max-w-sm px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30" />
        <select value={category} onChange={(e) => setCategory(e.target.value)}
          className="px-2.5 py-2 border border-gray-200 rounded-lg text-sm bg-white">
          <option value="">Semua Kategori</option>
          {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <select value={plantFilter} onChange={(e) => setPlantFilter(e.target.value)}
          className="px-2.5 py-2 border border-gray-200 rounded-lg text-sm bg-white">
          <option value="">Semua Plant</option>
          {plants.map((p) => <option key={p.plantId} value={p.plantId}>{p.plantName}</option>)}
        </select>
      </div>

      {/* Map — isolated stacking context so Leaflet z-index doesn't bleed over Dialog */}
      <div className="relative z-0 bg-white border border-gray-200 rounded-xl overflow-hidden">
        <MapWithMarkers
          equipment={equipment}
          plants={plants}
          plantId={plantFilter}
          onMapReady={(updateFn, flyToFn) => {
            mapCallbackRef.current = updateFn;
            flyToRef.current = flyToFn;
          }}
          onClickCoord={panelOpen ? onMapCoord : null}
          className="h-[26rem] w-full"
        />
      </div>

      {/* Table */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              {['Equipment ID', 'Nama', 'Functional Location', 'Kategori', 'Plant', 'Aksi'].map((h) => (
                <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading ? (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-400">Memuat...</td></tr>
            ) : equipment.length === 0 ? (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-400">Tidak ada data</td></tr>
            ) : equipment.map((eq) => (
              <tr key={eq.equipmentId} className="hover:bg-gray-50">
                <td className="px-4 py-3 font-mono text-xs font-semibold text-gray-800">{eq.equipmentId}</td>
                <td className="px-4 py-3 text-gray-700">{eq.equipmentName}</td>
                <td className="px-4 py-3 text-gray-500 text-xs">
                  {eq.functionalLocation || eq.funcLocId || '—'}
                </td>
                <td className="px-4 py-3"><CategoryBadge category={eq.category} /></td>
                <td className="px-4 py-3 text-gray-500 text-xs">{eq.plantId || '—'}</td>
                <td className="px-4 py-3">
                  <div className="flex gap-1.5">
                    {(eq.latitude != null && eq.longitude != null) && (
                      <Button variant="outline" size="sm" className="h-7 text-xs gap-1" onClick={() => pinToMap(eq)}
                        title="Tampilkan di peta">
                        <MapPin size={11} /> Pin
                      </Button>
                    )}
                    <Button variant="outline" size="sm" className="h-7 text-xs gap-1" onClick={() => setQrTarget(eq)} title="Tampilkan QR Code">
                      <QrCode size={11} /> QR
                    </Button>
                    <Link href={`/equipment/history?id=${eq.equipmentId}`}>
                      <Button variant="outline" size="sm" className="h-7 text-xs gap-1" title="Riwayat pengukuran">
                        <BarChart2 size={11} /> Riwayat
                      </Button>
                    </Link>
                    <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => openEdit(eq)}>Edit</Button>
                    <Button variant="destructive" size="sm" className="h-7 text-xs" onClick={() => setDeleteTarget(eq)}>Hapus</Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center gap-2 justify-end">
          <Button variant="outline" size="sm" disabled={page === 0} onClick={() => load(page - 1)}>Prev</Button>
          <span className="text-sm text-gray-600">{page + 1} / {totalPages}</span>
          <Button variant="outline" size="sm" disabled={page >= totalPages - 1} onClick={() => load(page + 1)}>Next</Button>
        </div>
      )}

      {/* Create/Edit dialog */}
      <Dialog open={panelOpen} onOpenChange={setPanelOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingId ? 'Edit Equipment' : 'Tambah Equipment'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Equipment ID *" value={form.equipmentId} onChange={(v) => setForm({ ...form, equipmentId: v })} disabled={!!editingId} />
              <Field label="Nama Equipment *" value={form.equipmentName} onChange={(v) => setForm({ ...form, equipmentName: v })} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Functional Location" value={form.functionalLocation} onChange={(v) => setForm({ ...form, functionalLocation: v })} placeholder="e.g. PS I Cidanau" />
              <Field label="FuncLoc ID" value={form.funcLocId} onChange={(v) => setForm({ ...form, funcLocId: v })} placeholder="e.g. A-A1-01" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Kategori *</label>
                <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30">
                  <option value="">Pilih...</option>
                  {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Plant</label>
                <select value={form.plantId} onChange={(e) => setForm({ ...form, plantId: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30">
                  <option value="">Tidak ada plant</option>
                  {plants.map((p) => <option key={p.plantId} value={p.plantId}>{p.plantName}</option>)}
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Latitude" value={form.latitude} onChange={(v) => setForm({ ...form, latitude: v })} placeholder="e.g. -6.2000" />
              <Field label="Longitude" value={form.longitude} onChange={(v) => setForm({ ...form, longitude: v })} placeholder="e.g. 106.8000" />
            </div>
            <p className="text-xs text-blue-500 flex items-center gap-1">
              <MapPin size={11} /> Klik langsung pada peta untuk mengisi koordinat otomatis
            </p>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setPanelOpen(false)}>Batal</Button>
            <Button onClick={saveEquipment}>{editingId ? 'Simpan' : 'Tambah'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}
        title={`Hapus ${deleteTarget?.equipmentId}?`} description="Aksi ini tidak dapat diurungkan."
        onConfirm={handleDelete} confirmLabel="Hapus" destructive />

      {/* QR Code dialog — technician scans from screen if physical barcode is missing */}
      <Dialog open={!!qrTarget} onOpenChange={(o) => !o && setQrTarget(null)}>
        <DialogContent className="max-w-xs text-center">
          <DialogHeader>
            <DialogTitle className="text-base">QR Code Equipment</DialogTitle>
          </DialogHeader>
          {qrTarget && (
            <div className="flex flex-col items-center gap-4 py-2">
              <div className="bg-white p-4 rounded-xl border border-gray-200 inline-block">
                <QRCode value={String(qrTarget.equipmentId)} size={220} bgColor="#ffffff" fgColor="#1a1a2e" />
              </div>
              <div>
                <p className="font-mono font-bold text-gray-800 text-sm">{qrTarget.equipmentId}</p>
                <p className="text-xs text-gray-500 mt-0.5">{qrTarget.equipmentName}</p>
              </div>
              <p className="text-xs text-gray-400">Arahkan kamera aplikasi ke QR code di atas</p>
            </div>
          )}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setQrTarget(null)}>Tutup</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Field({ label, value, onChange, placeholder, disabled, type = 'text' }) {
  return (
    <div>
      <label className="block text-xs font-semibold text-gray-600 mb-1">{label}</label>
      <input type={type} value={value} onChange={onChange ? (e) => onChange(e.target.value) : undefined} placeholder={placeholder}
        disabled={disabled}
        className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 disabled:bg-gray-50 disabled:text-gray-400" />
    </div>
  );
}
