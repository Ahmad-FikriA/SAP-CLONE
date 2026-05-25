'use client';

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { toast } from 'sonner';
import dynamic from 'next/dynamic';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import {
  MapPin, Loader2, AlertCircle, RefreshCw, Search, X, XCircle, CalendarDays,
  Briefcase, CheckCircle2, FileEdit, FileText, Banknote, Trash2, Eye, Ban,
  CalendarOff, TrendingUp, Plus, AlertTriangle
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import {
  fetchSupervisiJobs,
  fetchSupervisiJobArchive,
  updateSupervisiJob,
  cancelSupervisiJob,
  deleteSupervisiJob,
  updateSupervisiJobLocation,
  updateSupervisiRadiusExemption,
  SUPERVISI_STATUS_META,
} from '@/lib/supervisi-service';
import { canUpdate, canDelete } from '@/lib/auth';
import { SupervisiJobPanel } from '@/components/supervisi/SupervisiJobPanel';
import { SupervisiJobFormDialog } from '@/components/supervisi/SupervisiJobFormDialog';

// Leaflet hanya berjalan di client
const LeafletMap = dynamic(() => import('@/components/map/LeafletMap'), { ssr: false });

const MONTH_NAMES = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
];

// ── Status filter pills ───────────────────────────────────────────────────────
const FILTERS = [
  { id: 'all',       label: 'Semua'   },
  { id: 'active',    label: 'Aktif'   },
  { id: 'completed', label: 'Selesai' },
  { id: 'draft',     label: 'Draft'   },
  { id: 'cancelled', label: 'Dibatalkan' },
];

const SELECT_CLS =
  'px-3 py-1.5 border border-slate-200 rounded-lg text-sm bg-white text-slate-700 ' +
  'focus:outline-none focus:ring-2 focus:ring-blue-500/30 cursor-pointer';

const ARCHIVE_PAGE_SIZE = 20;

function buildArchiveDateRange(year, month) {
  if (!year) return {};
  const normalizedMonth = month ? String(month).padStart(2, '0') : '';
  if (!normalizedMonth) {
    return { dateFrom: `${year}-01-01`, dateTo: `${year}-12-31` };
  }
  const lastDay = new Date(Number(year), Number(normalizedMonth), 0).getDate();
  return {
    dateFrom: `${year}-${normalizedMonth}-01`,
    dateTo: `${year}-${normalizedMonth}-${String(lastDay).padStart(2, '0')}`,
  };
}

// Warna marker per status (hex, untuk divIcon)
const MARKER_COLORS = {
  active:    '#F59E0B', // Kuning
  completed: '#22C55E', // Hijau
  draft:     '#3B82F6', // Biru
  cancelled: '#EF4444', // Merah
};

function markerColor(status) {
  return MARKER_COLORS[status] || '#9CA3AF';
}

// Helper lokasi supervisi untuk marker dan payload update.
function toFiniteNumber(value) {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function normalizeRadius(value) {
  const parsed = toFiniteNumber(value);
  if (parsed == null) return 100;
  return Math.min(Math.max(parsed, 1), 300);
}

function normalizeLatLngForSave(latLng) {
  return {
    lat: Number(latLng.lat.toFixed(7)),
    lng: Number(latLng.lng.toFixed(7)),
  };
}

function formatLatLng(latLng) {
  const latitude = toFiniteNumber(latLng?.lat ?? latLng?.latitude);
  const longitude = toFiniteNumber(latLng?.lng ?? latLng?.longitude);
  if (latitude == null || longitude == null) return '-';
  return `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`;
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function getJobLocations(job) {
  const rawLocations = Array.isArray(job.locations) ? job.locations : [];
  const locations = rawLocations
    .map((loc, index) => {
      const latitude = toFiniteNumber(loc.latitude);
      const longitude = toFiniteNumber(loc.longitude);
      if (latitude == null || longitude == null) return null;
      return {
        id: String(loc.id || `loc-${index + 1}`),
        namaArea: loc.namaArea || job.namaArea || `Lokasi ${index + 1}`,
        latitude,
        longitude,
        radius: normalizeRadius(loc.radius ?? job.radius),
      };
    })
    .filter(Boolean);

  if (locations.length > 0) return locations;

  const latitude = toFiniteNumber(job.latitude);
  const longitude = toFiniteNumber(job.longitude);
  if (latitude == null || longitude == null) return [];

  return [{
    id: 'legacy',
    namaArea: job.namaArea || 'Lokasi 1',
    latitude,
    longitude,
    radius: normalizeRadius(job.radius),
  }];
}

function buildLocationUpdatePayload(job, locationIndex, latitude, longitude) {
  const locations = getJobLocations(job).map((loc, index) => (
    index === locationIndex
      ? { ...loc, latitude, longitude }
      : loc
  ));

  const first = locations[0];
  return {
    locations,
    latitude: first?.latitude ?? null,
    longitude: first?.longitude ?? null,
    radius: first?.radius ?? null,
    namaArea: first?.namaArea || null,
  };
}

function dateOnly(value) {
  return value ? String(value).slice(0, 10) : '';
}

function todayInJakartaDateOnly() {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Jakarta',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date()).reduce((acc, part) => {
    if (part.type !== 'literal') acc[part.type] = part.value;
    return acc;
  }, {});
  return `${parts.year}-${parts.month}-${parts.day}`;
}

function isRadiusExemptionActive(job) {
  const start = dateOnly(job?.radiusExemptionStartDate);
  const end = dateOnly(job?.radiusExemptionEndDate);
  const today = todayInJakartaDateOnly();
  return Boolean(start && end && start <= today && today <= end);
}

// Buat custom divIcon berbentuk pin.
function makePinIcon(L, color) {
  return L.divIcon({
    className: '',
    iconAnchor: [14, 36],
    popupAnchor: [0, -36],
    html: `
      <svg width="28" height="40" viewBox="0 0 28 40" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M14 0C6.268 0 0 6.268 0 14c0 9.333 14 26 14 26s14-16.667 14-26C28 6.268 21.732 0 14 0z"
              fill="${color}" stroke="white" stroke-width="1.5"/>
        <circle cx="14" cy="14" r="5" fill="white"/>
      </svg>`,
  });
}

// ── Pilih center awal peta: koordinat job aktif pertama yg punya lokasi ────────
function getInitialMapCenter(jobs) {
  const active = jobs.find((j) => j.status === 'active' && getJobLocations(j).length > 0);
  if (active) {
    const [first] = getJobLocations(active);
    return [first.latitude, first.longitude];
  }

  const anyWithCoords = jobs.find((j) => getJobLocations(j).length > 0);
  if (anyWithCoords) {
    const [first] = getJobLocations(anyWithCoords);
    return [first.latitude, first.longitude];
  }

  return null; // tidak ada koordinat sama sekali
}

const STATUS_ICON = {
  active:    { Icon: AlertCircle, cls: 'bg-yellow-50 text-yellow-700 border border-yellow-200' },
  completed: { Icon: CheckCircle2, cls: 'bg-green-50 text-green-700 border border-green-200' },
  draft:     { Icon: FileEdit,     cls: 'bg-blue-50 text-blue-700 border border-blue-200' },
  cancelled: { Icon: XCircle,      cls: 'bg-red-50 text-red-700 border border-red-200' },
};

function StatusBadge({ status }) {
  const meta   = SUPERVISI_STATUS_META[status] || SUPERVISI_STATUS_META.draft;
  const config = STATUS_ICON[status] || STATUS_ICON.draft;
  const Icon = config.Icon;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold ${config.cls}`}>
      <Icon size={10} />
      {meta.label}
    </span>
  );
}

function ArchivePagination({ meta, loading, onPageChange }) {
  const page = Number(meta?.page || 1);
  const totalPages = Number(meta?.totalPages || 1);
  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-t border-slate-100 px-4 py-3 text-sm">
      <p className="text-xs text-slate-500">
        Total <span className="font-semibold text-slate-700">{meta?.total || 0}</span> arsip
      </p>
      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={loading || page <= 1}
          onClick={() => onPageChange(page - 1)}
        >
          Sebelumnya
        </Button>
        <span className="min-w-[84px] text-center text-xs font-semibold text-slate-500">
          {page} / {totalPages}
        </span>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={loading || page >= totalPages}
          onClick={() => onPageChange(page + 1)}
        >
          Berikutnya
        </Button>
      </div>
    </div>
  );
}

function SupervisiArchiveSection({
  jobs,
  meta,
  loading,
  search,
  status,
  onSearchChange,
  onStatusChange,
  onPageChange,
  onViewDetail,
  formatRupiah,
}) {
  return (
    <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
      <div className="p-4 border-b border-slate-100 flex flex-col lg:flex-row gap-3 lg:items-center">
        <div className="relative flex-1 min-w-[220px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Cari JO, pekerjaan, PIC..."
            className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/30"
          />
        </div>
        <select value={status} onChange={(e) => onStatusChange(e.target.value)} className={SELECT_CLS}>
          <option value="">Semua Status Final</option>
          <option value="completed">Selesai</option>
          <option value="cancelled">Dibatalkan</option>
        </select>
      </div>

      <div className="md:hidden divide-y divide-slate-100">
        {loading ? (
          <div className="flex flex-col items-center gap-2 py-10 text-slate-400">
            <Loader2 size={24} className="animate-spin" />
            <p className="text-sm">Memuat arsip supervisi...</p>
          </div>
        ) : jobs.length === 0 ? (
          <div className="py-10 text-center text-sm text-slate-400">Tidak ada arsip supervisi</div>
        ) : jobs.map((job) => {
          const visits = Array.isArray(job.visits) ? job.visits : [];
          const pelanggaran = visits.filter((visit) => visit.isPelanggaran).length;
          return (
            <button
              key={job.id}
              type="button"
              onClick={() => onViewDetail(job)}
              className="w-full text-left p-4 hover:bg-blue-50/40 transition-colors"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-semibold text-slate-800 truncate">{job.namaKerja || '-'}</p>
                  <p className="font-mono text-[11px] text-slate-400 mt-1">{job.nomorJo || '-'}</p>
                </div>
                <StatusBadge status={job.status} />
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-slate-500">
                <span>{String(job.waktuMulai || '').slice(0, 10) || '-'}</span>
                <span className="text-right">{formatRupiah(parseFloat(job.nilaiPekerjaan) || 0)}</span>
                <span>{visits.length} kunjungan</span>
                <span className="text-right">{pelanggaran} pelanggaran</span>
              </div>
            </button>
          );
        })}
      </div>

      <div className="hidden md:block bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-600 min-w-[1100px]">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                {['Nomor JO', 'Pekerjaan', 'PIC', 'Mulai', 'Nilai', 'Visit', 'Pelanggaran', 'Status', 'Aksi'].map((head) => (
                  <th key={head} className="px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-slate-500 whitespace-nowrap">{head}</th>
                ))}
              </tr>
            </thead>
          <tbody className="divide-y divide-slate-100">
            {loading ? (
              <tr>
                <td colSpan="9" className="px-6 py-10 text-center text-slate-400">
                  <Loader2 size={24} className="animate-spin mx-auto mb-2" />
                  Memuat arsip supervisi...
                </td>
              </tr>
            ) : jobs.length === 0 ? (
              <tr>
                <td colSpan="9" className="px-6 py-10 text-center text-slate-400">Tidak ada arsip supervisi</td>
              </tr>
            ) : jobs.map((job) => {
              const visits = Array.isArray(job.visits) ? job.visits : [];
              const pelanggaran = visits.filter((visit) => visit.isPelanggaran).length;
              return (
                <tr key={job.id} className="hover:bg-blue-50/40 transition-colors">
                  <td className="px-4 py-3 font-mono text-xs font-semibold text-slate-500 whitespace-nowrap">{job.nomorJo || '-'}</td>
                  <td className="px-4 py-3 max-w-[240px]"><p className="font-semibold text-slate-800 truncate">{job.namaKerja || '-'}</p></td>
                  <td className="px-4 py-3 max-w-[180px] truncate">{job.picSupervisi || '-'}</td>
                  <td className="px-4 py-3 whitespace-nowrap">{String(job.waktuMulai || '').slice(0, 10) || '-'}</td>
                  <td className="px-4 py-3 whitespace-nowrap">{formatRupiah(parseFloat(job.nilaiPekerjaan) || 0)}</td>
                  <td className="px-4 py-3">{visits.length}</td>
                  <td className="px-4 py-3">{pelanggaran}</td>
                  <td className="px-4 py-3 whitespace-nowrap"><StatusBadge status={job.status} /></td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <Button type="button" variant="outline" size="sm" className="h-8 gap-1.5" onClick={() => onViewDetail(job)}>
                      <Eye size={12} /> Detail
                    </Button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        </div>
      </div>

      <ArchivePagination meta={meta} loading={loading} onPageChange={onPageChange} />
    </div>
  );
}

export default function SupervisiPage() {
  const [jobs,        setJobs]        = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [filter,      setFilter]      = useState('all');
  const [selectedJob, setSelectedJob] = useState(null);
  // State untuk alur BATALKAN (active → cancelled)
  const [jobToCancel, setJobToCancel] = useState(null);
  const [isCancelling, setIsCancelling] = useState(false);
  const [cancelReason,  setCancelReason]  = useState('');

  // State untuk alur HAPUS permanen (cancelled/completed → deleted)
  const [jobToHapus,  setJobToHapus]  = useState(null);
  const [isHapusing,  setIsHapusing]  = useState(false);

  // State untuk alur SELESAI manual
  const [jobToComplete, setJobToComplete] = useState(null);
  const [isCompleting, setIsCompleting] = useState(false);

  const [jobToRadiusExempt, setJobToRadiusExempt] = useState(null);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [jobToEdit, setJobToEdit] = useState(null);
  const [isSavingRadiusExemption, setIsSavingRadiusExemption] = useState(false);
  const [pendingPinMove, setPendingPinMove] = useState(null);
  const [isSavingPinMove, setIsSavingPinMove] = useState(false);
  const [radiusExemptionForm, setRadiusExemptionForm] = useState({
    startDate: '',
    endDate: '',
    reason: '',
  });

  const [mounted, setMounted] = useState(false);
  const [focusedJobId, setFocusedJobId] = useState(null);
  useEffect(() => {
    setMounted(true);
  }, []);

  // backward‑compat alias (beberapa tempat masih pakai jobToDelete)
  const jobToDelete    = jobToCancel;
  const setJobToDelete = setJobToCancel;
  const [tableSearch, setTableSearch] = useState('');
  const [tableStatusFilter, setTableStatusFilter] = useState('');
  const [showFullFormat, setShowFullFormat] = useState(false);
  const [viewMode, setViewMode] = useState('monitoring');
  const [archiveJobs, setArchiveJobs] = useState([]);
  const [archiveLoading, setArchiveLoading] = useState(false);
  const [archiveMeta, setArchiveMeta] = useState({
    page: 1,
    limit: ARCHIVE_PAGE_SIZE,
    total: 0,
    totalPages: 1,
  });
  const [archivePage, setArchivePage] = useState(1);
  const [archiveSearchInput, setArchiveSearchInput] = useState('');
  const [archiveSearch, setArchiveSearch] = useState('');
  const [archiveStatus, setArchiveStatus] = useState('');
  const canUpdateSupervisi = canUpdate('supervisi');
  const canDeleteSupervisi = canDelete('supervisi');


  // ── Filter tahun & bulan ────────────────────────────────────────────────────
  const currentYear  = new Date().getFullYear();
  const [yearFilter,  setYearFilter]  = useState(String(currentYear));
  const [monthFilter, setMonthFilter] = useState('');   // '' = semua bulan

  // Refs untuk akses Leaflet dari luar komponen
  const mapRef     = useRef(null);
  const LRef       = useRef(null);
  const markersRef = useRef([]);
  const mapReadyRef = useRef(false); // apakah peta sudah mount
  const skipNextFitBoundsRef = useRef(false);
  const pendingPinMoveRef = useRef(null);

  // ── Fetch data ──────────────────────────────────────────────────────────────
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const range = buildArchiveDateRange(yearFilter, monthFilter);
      const data = await fetchSupervisiJobs(range);
      setJobs(Array.isArray(data) ? data : []);
    } catch (e) {
      toast.error('Gagal memuat data supervisi: ' + e.message);
    } finally {
      setLoading(false);
    }
  }, [yearFilter, monthFilter]);

  useEffect(() => {
    if (viewMode === 'monitoring') load();
  }, [viewMode, load]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setArchiveSearch(archiveSearchInput);
    }, 300);
    return () => clearTimeout(timer);
  }, [archiveSearchInput]);

  const loadArchive = useCallback(async () => {
    setArchiveLoading(true);
    try {
      const range = buildArchiveDateRange(yearFilter, monthFilter);
      const result = await fetchSupervisiJobArchive({
        page: archivePage,
        limit: ARCHIVE_PAGE_SIZE,
        q: archiveSearch.trim(),
        status: archiveStatus,
        ...range,
      });
      setArchiveJobs(Array.isArray(result.items) ? result.items : []);
      setArchiveMeta(result.meta);
    } catch (e) {
      toast.error('Gagal memuat arsip supervisi: ' + e.message);
    } finally {
      setArchiveLoading(false);
    }
  }, [archivePage, archiveSearch, archiveStatus, yearFilter, monthFilter]);

  useEffect(() => {
    setArchivePage(1);
  }, [archiveSearch, archiveStatus, yearFilter, monthFilter]);

  useEffect(() => {
    if (viewMode !== 'archive') return;
    loadArchive();
  }, [viewMode, loadArchive]);

  // ── Derive opsi tahun dari data ─────────────────────────────────────────────
  const yearOptions = useMemo(() => {
    const years = new Set(
      jobs
        .map((j) => (j.waktuMulai || j.createdAt)?.slice(0, 4))
        .filter(Boolean),
    );
    for (let year = currentYear; year >= currentYear - 10; year -= 1) {
      years.add(String(year));
    }
    return [...years].sort((a, b) => b - a);
  }, [jobs, currentYear]);

  // ── Derived data ────────────────────────────────────────────────────────────
  const validJobs = useMemo(() => {
    return jobs.filter((j) => {
      const date = j.waktuMulai || j.createdAt || '';
      if (yearFilter  && !date.startsWith(yearFilter)) return false;
      if (monthFilter && date.slice(5, 7) !== monthFilter.padStart(2, '0')) return false;
      return true;
    });
  }, [jobs, yearFilter, monthFilter]);

  // ── Refresh markers ketika validJobs, filter, atau focusedJobId berubah ──
  useEffect(() => {
    if (!mapRef.current || !LRef.current || !mapReadyRef.current) return;
    renderMarkers(mapRef.current, LRef.current, validJobs, filter, focusedJobId);
  }, [validJobs, filter, focusedJobId, canUpdateSupervisi]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Callback saat peta siap ─────────────────────────────────────────────────
  const onMapReady = useCallback((map, L) => {
    mapRef.current  = map;
    LRef.current    = L;
    mapReadyRef.current = true;

    // Add map click listener to reset focus when clicking on the map background
    map.on('click', (e) => {
      if (e.originalEvent.target.id === map.getContainer().id || e.originalEvent.target.classList.contains('leaflet-container')) {
        setFocusedJobId(null);
      }
    });

    if (validJobs.length > 0) renderMarkers(map, L, validJobs, filter, focusedJobId);
  }, [validJobs, filter, focusedJobId, canUpdateSupervisi]); // eslint-disable-line react-hooks/exhaustive-deps

  const onMapUnmount = useCallback(() => {
    mapReadyRef.current = false;
    mapRef.current = null;
    LRef.current = null;
  }, []);

  // ── Render / re-render markers ──────────────────────────────────────────────
  const handleLocationDragEnd = useCallback(({ job, locationIndex, marker, previousLatLng, nextLatLng }) => {
    if (!canUpdateSupervisi) {
      marker.setLatLng(previousLatLng);
      toast.error('Anda tidak memiliki akses untuk memperbarui lokasi supervisi.');
      return;
    }

    if (!job?.id) {
      marker.setLatLng(previousLatLng);
      toast.error('Job supervisi tidak valid.');
      return;
    }

    if (pendingPinMoveRef.current) {
      marker.setLatLng(previousLatLng);
      toast.error('Selesaikan konfirmasi pemindahan pin yang sedang terbuka.');
      return;
    }

    const previous = normalizeLatLngForSave(previousLatLng);
    const next = normalizeLatLngForSave(nextLatLng);
    if (previous.lat === next.lat && previous.lng === next.lng) return;

    marker.dragging?.disable();
    const location = getJobLocations(job)[locationIndex];
    const pendingMove = {
      job,
      locationIndex,
      marker,
      previousLatLng,
      nextLatLng,
      locationName: location?.namaArea || `Lokasi ${locationIndex + 1}`,
    };

    pendingPinMoveRef.current = pendingMove;
    setPendingPinMove(pendingMove);
  }, [canUpdateSupervisi]);

  function renderMarkers(map, L, allJobs, activeFilter, currentFocusedId) {
    // Bersihkan marker lama
    markersRef.current.forEach((m) => m.remove());
    markersRef.current = [];

    const visible = activeFilter === 'all'
      ? allJobs
      : allJobs.filter((j) => j.status === activeFilter);

    const isAnyFocused = currentFocusedId !== null;

    visible.forEach((job) => {
      const isFocused = currentFocusedId === job.id;
      
      // Jika ada job lain yang di-focus, warnai abu-abu
      const color = isAnyFocused && !isFocused
        ? '#9CA3AF'
        : markerColor(job.status);
        
      const icon  = makePinIcon(L, color);
      const meta  = SUPERVISI_STATUS_META[job.status] || SUPERVISI_STATUS_META.draft;

      let locations = getJobLocations(job);

      // JIKA tidak ada job yang di-focus, hanya tampilkan lokasi pertama (index 0) untuk cegah spam!
      // JIKA ada job yang di-focus:
      //   - Untuk job yang di-focus: tampilkan SEMUA lokasi!
      //   - Untuk job lain: hanya tampilkan lokasi pertama (index 0).
      if (!isFocused && locations.length > 1) {
        locations = [locations[0]];
      }

      const points = locations.map((loc, idx) => ({
        lat: loc.latitude,
        lng: loc.longitude,
        area: loc.namaArea,
        radius: normalizeRadius(loc.radius ?? job.radius),
        locationId: loc.id,
        locationIndex: idx,
      }));

      // Render marker untuk tiap titik
      points.forEach((pt) => {
        let previousLatLng = L.latLng(pt.lat, pt.lng);
        const marker = L.marker([pt.lat, pt.lng], { 
          icon, 
          draggable: canUpdateSupervisi && !isAnyFocused,
          jobId: job.id
        });
        
        const popupContent = `
          <div style="min-width:200px;font-family:system-ui,sans-serif">
            <p style="font-size:10px;font-weight:700;color:#6B7280;letter-spacing:.05em;text-transform:uppercase;margin-bottom:4px">
              ${escapeHtml(meta.label)}
            </p>
            <p style="font-size:13px;font-weight:700;color:#111827;line-height:1.3;margin:0 0 4px">
              ${escapeHtml(job.namaKerja || '-')}
            </p>
            <p style="font-size:11px;color:#6B7280;margin:0 0 2px">JO: ${escapeHtml(job.nomorJo || '-')}</p>
            ${job.picSupervisi ? `<p style="font-size:11px;color:#6B7280;margin:0 0 2px">PIC: ${escapeHtml(job.picSupervisi)}</p>` : ''}
            ${pt.area ? `<p style="font-size:11px;color:#6B7280;margin:0">Area: ${escapeHtml(pt.area)}</p>` : ''}
            <button
              onclick="window.__supervisiSelectJob(${job.id})"
              style="margin-top:10px;padding:5px 12px;background:#1d4ed8;color:#fff;border:none;border-radius:6px;font-size:11px;font-weight:600;cursor:pointer;width:100%"
            >
              Lihat Detail ->
            </button>
          </div>`;

        marker.bindPopup(popupContent, { maxWidth: 260 });
        
        // Klik pada marker memicu focus
        marker.on('click', (e) => {
          L.DomEvent.stopPropagation(e);
          setFocusedJobId(job.id);
        });

        marker.on('add', () => {
          const el = marker.getElement();
          if (el) el.style.cursor = canUpdateSupervisi && !isAnyFocused ? 'grab' : 'pointer';
        });

        if (canUpdateSupervisi && !isAnyFocused) {
          marker.on('dragstart', () => {
            previousLatLng = marker.getLatLng();
            map.closePopup();
            const el = marker.getElement();
            if (el) el.style.cursor = 'grabbing';
          });
          marker.on('dragend', () => {
            const el = marker.getElement();
            if (el) el.style.cursor = 'grab';
            handleLocationDragEnd({
              job,
              locationIndex: pt.locationIndex,
              marker,
              previousLatLng,
              nextLatLng: marker.getLatLng(),
            });
          });
        }
        
        marker.addTo(map);
        markersRef.current.push(marker);

        // JIKA job ini sedang di-focus, render lingkaran radius untuk semua lokasinya!
        if (isFocused) {
          const circle = L.circle([pt.lat, pt.lng], {
            radius: pt.radius,
            color: color,
            fillColor: color,
            fillOpacity: 0.10,
            weight: 1.5,
            dashArray: '4 4',
            jobId: job.id
          });
          circle.addTo(map);
          markersRef.current.push(circle);
        }
      });
    });

    // Fit bounds ke semua marker yang tampil
    if (markersRef.current.length > 0) {
      if (skipNextFitBoundsRef.current) {
        skipNextFitBoundsRef.current = false;
      } else {
        // Jika ada job yang di-focus, fit bounds ke lokasi job tersebut saja
        if (currentFocusedId) {
          const focusedItems = markersRef.current.filter((m) => m.options?.jobId === currentFocusedId);
          if (focusedItems.length > 0) {
            const group = L.featureGroup(focusedItems);
            map.fitBounds(group.getBounds().pad(0.25), { maxZoom: 15 });
          }
        } else {
          // Jika tidak ada yang di-focus, fit bounds ke semua marker
          const group = L.featureGroup(markersRef.current.filter(m => m instanceof L.Marker));
          if (group.getLayers().length > 0) {
            map.fitBounds(group.getBounds().pad(0.15), { maxZoom: 14 });
          }
        }
      }
    }
  }

  const closePinMoveDialog = () => {
    if (isSavingPinMove) return;
    const pendingMove = pendingPinMoveRef.current;
    if (pendingMove) {
      pendingMove.marker.setLatLng(pendingMove.previousLatLng);
      pendingMove.marker.dragging?.enable();
    }
    pendingPinMoveRef.current = null;
    setPendingPinMove(null);
  };

  const confirmPinMove = async () => {
    const pendingMove = pendingPinMoveRef.current;
    if (!pendingMove) return;
    if (!canUpdateSupervisi) {
      closePinMoveDialog();
      toast.error('Anda tidak memiliki akses untuk memperbarui lokasi supervisi.');
      return;
    }

    const { job, locationIndex, marker, previousLatLng, nextLatLng } = pendingMove;
    const next = normalizeLatLngForSave(nextLatLng);

    setIsSavingPinMove(true);
    try {
      const payload = buildLocationUpdatePayload(
        job,
        locationIndex,
        next.lat,
        next.lng,
      );
      const savedJob = await updateSupervisiJobLocation(job.id, payload);

      const applyUpdatedLocation = (current) => ({
        ...current,
        ...(savedJob || {}),
        ...payload,
      });

      skipNextFitBoundsRef.current = true;
      setJobs((prev) => prev.map((item) => (
        item.id === job.id ? applyUpdatedLocation(item) : item
      )));
      setSelectedJob((prev) => (
        prev?.id === job.id ? applyUpdatedLocation(prev) : prev
      ));
      pendingPinMoveRef.current = null;
      setPendingPinMove(null);
      toast.success('Lokasi job supervisi diperbarui.');
    } catch (err) {
      marker.setLatLng(previousLatLng);
      pendingPinMoveRef.current = null;
      setPendingPinMove(null);
      toast.error(err?.message || 'Gagal memperbarui lokasi job supervisi.');
    } finally {
      marker.dragging?.enable();
      setIsSavingPinMove(false);
    }
  };

  // ── Global handler untuk tombol popup ───────────────────────────────────────
  useEffect(() => {
    window.__supervisiSelectJob = (id) => {
      const job = jobs.find((j) => j.id === id);
      if (job) {
        setSelectedJob(job);
        setFocusedJobId(job.id);
        mapRef.current?.closePopup();
      }
    };
    return () => { delete window.__supervisiSelectJob; };
  }, [jobs]);

  const filteredJobs = filter === 'all' ? validJobs : validJobs.filter((j) => j.status === filter);

  let mapPointsCount = 0;
  const noCoordsJobs = [];

  filteredJobs.forEach(job => {
    const validLocations = getJobLocations(job);
    if (validLocations.length > 0) {
      mapPointsCount += validLocations.length;
    } else {
      noCoordsJobs.push(job);
    }
  });

  const stats = {
    active:    validJobs.filter((j) => j.status === 'active').length,
    completed: validJobs.filter((j) => j.status === 'completed').length,
    draft:     validJobs.filter((j) => j.status === 'draft').length,
    cancelled: validJobs.filter((j) => j.status === 'cancelled').length,
    pelanggaran: validJobs.reduce((count, job) => (
      count + (Array.isArray(job.visits) ? job.visits.filter((visit) => visit.isPelanggaran).length : 0)
    ), 0),
  };
  stats.total = stats.active + stats.completed + stats.draft + stats.cancelled;

  // JO yang sudah terbit (bukan draft)
  const totalJoTerbit = stats.active + stats.completed;
  
  // Total Nilai Pekerjaan dari job aktif dan selesai saja (bukan draft/cancelled)
  const totalNilai = validJobs
    .filter((j) => j.status === 'active' || j.status === 'completed')
    .reduce((sum, job) => sum + (parseFloat(job.nilaiPekerjaan) || 0), 0);

  const formatRupiah = (value, shorten = true) => {
    if (!value) return 'Rp 0';
    if (shorten) {
      if (value >= 1e9) {
        return `Rp ${(value / 1e9).toFixed(1)} Miliar`;
      } else if (value >= 1e6) {
        return `Rp ${(value / 1e6).toFixed(1)} Juta`;
      }
    }
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  // ── Chart data ────────────────────────────────────────────────────────────────
  const nilaiChartData = useMemo(() => {
    const relevantJobs = jobs
      .filter((j) => {
        if (j.status !== 'active' && j.status !== 'completed') return false;
        const date = j.waktuMulai || j.createdAt || '';
        if (yearFilter && !date.startsWith(yearFilter)) return false;
        return true;
      })
      .sort((a, b) => {
        const da = a.waktuMulai || a.createdAt || '';
        const db = b.waktuMulai || b.createdAt || '';
        return da.localeCompare(db);
      });

    if (monthFilter) {
      const daysInMonth = new Date(
        parseInt(yearFilter || new Date().getFullYear()),
        parseInt(monthFilter), 0
      ).getDate();
      const prefix = `${yearFilter || new Date().getFullYear()}-${monthFilter.padStart(2, '0')}`;
      const dailyMap = {};
      relevantJobs.forEach((j) => {
        const d = (j.waktuMulai || j.createdAt || '').slice(0, 10);
        if (!d.startsWith(prefix)) return;
        dailyMap[d] = (dailyMap[d] || 0) + (parseFloat(j.nilaiPekerjaan) || 0);
      });
      let cumulative = 0;
      return Array.from({ length: daysInMonth }, (_, i) => {
        const day = String(i + 1).padStart(2, '0');
        const key = `${prefix}-${day}`;
        cumulative += dailyMap[key] || 0;
        return { label: `${i + 1}`, nilai: cumulative, raw: cumulative };
      });
    }

    const monthlyMap = {};
    relevantJobs.forEach((j) => {
      const d = j.waktuMulai || j.createdAt || '';
      const key = d.slice(0, 7);
      if (!key) return;
      monthlyMap[key] = (monthlyMap[key] || 0) + (parseFloat(j.nilaiPekerjaan) || 0);
    });
    const sortedKeys = Object.keys(monthlyMap).sort();
    let cumulative = 0;
    return sortedKeys.map((key) => {
      cumulative += monthlyMap[key];
      const [, mm] = key.split('-');
      return {
        label: MONTH_NAMES[parseInt(mm) - 1]?.slice(0, 3) || mm,
        nilai: cumulative,
        raw: cumulative,
      };
    });
  }, [jobs, yearFilter, monthFilter]);

  const nilaiChange = useMemo(() => {
    if (nilaiChartData.length < 2) return null;
    const last = nilaiChartData[nilaiChartData.length - 1]?.raw || 0;
    const first = nilaiChartData[0]?.raw || 0;
    const diff = last - first;

    // Awal periode bisa 0 (umum pada chart kumulatif harian).
    // Agar kenaikan tetap terbaca, gunakan fallback 100% / -100% saat basis 0.
    if (first === 0) {
      if (diff > 0) return 100;
      if (diff < 0) return -100;
      return 0;
    }

    return (diff / first) * 100;
  }, [nilaiChartData]);



  // Center awal peta = koordinat job aktif pertama (setelah data loaded)
  const initialCenter = loading ? null : getInitialMapCenter(validJobs);

  // Table filtering
  const tableJobs = validJobs.filter((j) => {
    if (tableStatusFilter && j.status !== tableStatusFilter) return false;
    if (tableSearch) {
      const q = tableSearch.toLowerCase();
      return (
        j.nomorJo?.toLowerCase().includes(q) ||
        j.namaKerja?.toLowerCase().includes(q) ||
        j.picSupervisi?.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const handleCancelClick = (job) => {
    if (!canUpdateSupervisi) {
      toast.error('Anda tidak memiliki akses untuk membatalkan pekerjaan supervisi.');
      return;
    }
    setJobToCancel(job);
  };
  const handleHapusClick  = (job) => {
    if (!canDeleteSupervisi) {
      toast.error('Anda tidak memiliki akses untuk menghapus pekerjaan supervisi.');
      return;
    }
    setJobToHapus(job);
  };
  const handleRadiusExemptionClick = (job) => {
    if (!canUpdateSupervisi) {
      toast.error('Anda tidak memiliki akses untuk mengubah radius supervisi.');
      return;
    }
    setJobToRadiusExempt(job);
    setRadiusExemptionForm({
      startDate: dateOnly(job.radiusExemptionStartDate),
      endDate: dateOnly(job.radiusExemptionEndDate),
      reason: job.radiusExemptionReason || '',
    });
  };

  const handleCreateJobClick = () => {
    if (!canUpdateSupervisi) {
      toast.error('Anda tidak memiliki akses untuk membuat pekerjaan supervisi.');
      return;
    }
    setShowCreateDialog(true);
  };

  const handleCreatedJob = (savedJob) => {
    if (savedJob?.id) {
      setJobs((prev) => {
        const idx = prev.findIndex(j => j.id === savedJob.id);
        if (idx >= 0) {
          const next = [...prev];
          next[idx] = savedJob;
          return next;
        }
        return [savedJob, ...prev];
      });
    }
    load();
  };

  const applyUpdatedJob = (savedJob) => {
    if (!savedJob?.id) return;
    setJobs((prev) => prev.map((item) => (
      item.id === savedJob.id ? { ...item, ...savedJob } : item
    )));
    setSelectedJob((prev) => (
      prev?.id === savedJob.id ? { ...prev, ...savedJob } : prev
    ));
  };

  const closeRadiusExemptionDialog = () => {
    setJobToRadiusExempt(null);
    setRadiusExemptionForm({ startDate: '', endDate: '', reason: '' });
  };

  const confirmRadiusExemption = async () => {
    if (!jobToRadiusExempt) return;
    if (!canUpdateSupervisi) {
      toast.error('Anda tidak memiliki akses untuk mengubah radius supervisi.');
      return;
    }

    const startDate = radiusExemptionForm.startDate;
    const endDate = radiusExemptionForm.endDate;
    if (!startDate || !endDate) {
      toast.error('Tanggal mulai dan akhir wajib diisi.');
      return;
    }
    if (endDate < startDate) {
      toast.error('Tanggal akhir tidak boleh lebih awal dari tanggal mulai.');
      return;
    }

    setIsSavingRadiusExemption(true);
    try {
      const savedJob = await updateSupervisiRadiusExemption(jobToRadiusExempt.id, {
        radiusExemptionStartDate: startDate,
        radiusExemptionEndDate: endDate,
        radiusExemptionReason: radiusExemptionForm.reason.trim(),
      });
      applyUpdatedJob(savedJob);
      toast.success('Kewajiban radius berhasil dinonaktifkan untuk rentang tanggal tersebut.');
      closeRadiusExemptionDialog();
    } catch (err) {
      toast.error(err?.message || 'Gagal menyimpan pengecualian radius.');
    } finally {
      setIsSavingRadiusExemption(false);
    }
  };

  const clearRadiusExemption = async () => {
    if (!jobToRadiusExempt) return;
    if (!canUpdateSupervisi) {
      toast.error('Anda tidak memiliki akses untuk mengubah radius supervisi.');
      return;
    }

    setIsSavingRadiusExemption(true);
    try {
      const savedJob = await updateSupervisiRadiusExemption(jobToRadiusExempt.id, {
        radiusExemptionStartDate: null,
        radiusExemptionEndDate: null,
        radiusExemptionReason: null,
      });
      applyUpdatedJob(savedJob);
      toast.success('Kewajiban radius kembali aktif.');
      closeRadiusExemptionDialog();
    } catch (err) {
      toast.error(err?.message || 'Gagal mengaktifkan kembali kewajiban radius.');
    } finally {
      setIsSavingRadiusExemption(false);
    }
  };

  const confirmCancelJob = async () => {
    if (!jobToCancel) return;
    if (!canUpdateSupervisi) {
      toast.error('Anda tidak memiliki akses untuk membatalkan pekerjaan supervisi.');
      return;
    }

    const reason = cancelReason.trim();
    if (reason.length < 5) return;
    setIsCancelling(true);
    try {
      await cancelSupervisiJob(jobToCancel.id, reason);
      toast.success('Pekerjaan supervisi berhasil dibatalkan.');
      if (selectedJob?.id === jobToCancel.id) setSelectedJob(null);
      setJobToCancel(null);
      setCancelReason('');
      load();
    } catch (err) {
      toast.error(err?.message || 'Gagal membatalkan pekerjaan supervisi.');
    } finally {
      setIsCancelling(false);
    }
  };

  const confirmHapusJob = async () => {
    if (!jobToHapus) return;
    if (!canDeleteSupervisi) {
      toast.error('Anda tidak memiliki akses untuk menghapus pekerjaan supervisi.');
      return;
    }

    setIsHapusing(true);
    try {
      await deleteSupervisiJob(jobToHapus.id);
      toast.success('Pekerjaan supervisi berhasil dihapus permanen.');
      if (selectedJob?.id === jobToHapus.id) setSelectedJob(null);
      setJobToHapus(null);
      load();
    } catch (err) {
      toast.error(err?.message || 'Gagal menghapus pekerjaan supervisi.');
    } finally {
      setIsHapusing(false);
    }
  };

  const confirmCompleteJob = async () => {
    if (!jobToComplete) return;
    if (!canUpdateSupervisi) {
      toast.error('Anda tidak memiliki akses untuk menyelesaikan pekerjaan supervisi.');
      return;
    }

    setIsCompleting(true);
    try {
      await updateSupervisiJob(jobToComplete.id, { status: 'completed' });
      toast.success('Pekerjaan supervisi berhasil diselesaikan.');
      if (selectedJob?.id === jobToComplete.id) {
        setSelectedJob(prev => prev ? { ...prev, status: 'completed' } : null);
      }
      setJobToComplete(null);
      load();
    } catch (err) {
      toast.error(err?.message || 'Gagal menyelesaikan pekerjaan supervisi.');
    } finally {
      setIsCompleting(false);
    }
  };

  return (
    <div className="p-4 md:p-6 lg:p-8 max-w-7xl mx-auto space-y-6">

      {/* ── Page Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <div className="p-1.5 bg-blue-600 rounded-lg">
              <MapPin size={16} className="text-white" />
            </div>
            <h2 className="text-2xl font-bold text-slate-800 tracking-tight">
              Monitoring Supervisi
            </h2>
          </div>
          <p className="text-slate-500 text-sm ml-9">
            Peta lokasi titik pekerjaan supervisi lapangan
          </p>
        </div>

        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
          <div className="inline-flex rounded-lg border border-slate-200 bg-slate-50 p-1">
            {[
              { id: 'monitoring', label: 'Monitoring' },
              { id: 'archive', label: 'Arsip' },
            ].map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setViewMode(item.id)}
                className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-colors ${
                  viewMode === item.id
                    ? 'bg-white text-blue-700 shadow-sm'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>

          {/* Filter Periode */}
          <div className="flex items-center gap-2">
            <CalendarDays size={18} className="text-slate-400" />
            <select
              value={yearFilter}
              onChange={(e) => setYearFilter(e.target.value)}
              className={SELECT_CLS}
            >
              <option value="">Semua Tahun</option>
              {yearOptions.map((y) => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
            <select
              value={monthFilter}
              onChange={(e) => setMonthFilter(e.target.value)}
              className={SELECT_CLS}
            >
              <option value="">Semua Bulan</option>
              {MONTH_NAMES.map((m, i) => (
                <option key={i} value={String(i + 1).padStart(2, '0')}>{m}</option>
              ))}
            </select>
          </div>

          {viewMode === 'monitoring' && (
            <button
              onClick={handleCreateJobClick}
              disabled={!canUpdateSupervisi}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#0a2540] hover:bg-[#0d3154] text-white text-sm font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Plus size={14} />
              Tambah Jadwal
            </button>
          )}

          <button
            onClick={viewMode === 'archive' ? loadArchive : load}
            disabled={viewMode === 'archive' ? archiveLoading : loading}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-semibold transition-colors disabled:opacity-50"
          >
            <RefreshCw size={14} className={(viewMode === 'archive' ? archiveLoading : loading) ? 'animate-spin' : ''} />
            Refresh
          </button>
        </div>
      </div>

      {viewMode === 'monitoring' ? (
      <>

      {/* ── Total Nilai Card (full-width, crypto-style) ── */}
      {!loading && (
        <div className="relative overflow-hidden rounded-2xl shadow-xl" style={{ background: 'linear-gradient(135deg, #064e3b 0%, #065f46 40%, #047857 100%)' }}>
          {/* BG orbs */}
          <div className="absolute -right-16 -top-16 w-72 h-72 bg-white/5 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute right-32 -bottom-12 w-48 h-48 bg-emerald-300/10 rounded-full blur-2xl pointer-events-none" />
          <div className="absolute left-1/2 top-0 w-96 h-32 bg-teal-400/5 rounded-full blur-3xl pointer-events-none" />

          <div className="relative z-10 p-6 pb-0">
            {/* Header row: label kiri, nilai besar, % change */}
            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3 mb-5">
              <div>
                <div className="flex items-center gap-2 mb-1.5">
                  <div className="flex items-center gap-1.5 text-emerald-300">
                    <Banknote size={13} strokeWidth={2.5} />
                    <p className="text-[10px] font-bold uppercase tracking-widest">Total Nilai Pekerjaan</p>
                  </div>
                  <button 
                    onClick={() => setShowFullFormat(!showFullFormat)}
                    className="text-[9px] font-bold uppercase tracking-widest bg-white/10 hover:bg-white/20 text-emerald-100 px-2 py-0.5 rounded transition-colors"
                  >
                    {showFullFormat ? 'Ringkas' : 'Detail'}
                  </button>
                </div>
                <p 
                  className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight leading-none drop-shadow cursor-pointer hover:opacity-90 transition-opacity"
                  onClick={() => setShowFullFormat(!showFullFormat)}
                  title="Klik untuk ubah format angka"
                >
                  {formatRupiah(totalNilai, !showFullFormat)}
                </p>
                {nilaiChange !== null && (
                  <div className={`flex items-center gap-1 mt-2 text-xs font-semibold ${
                    nilaiChange >= 0 ? 'text-emerald-300' : 'text-red-300'
                  }`}>
                    <TrendingUp size={11} className={nilaiChange < 0 ? 'rotate-180' : ''} />
                    {nilaiChange >= 0 ? '+' : ''}{nilaiChange.toFixed(1)}%
                  </div>
                )}
              </div>
              <p className="text-[10px] text-emerald-200/60 font-semibold shrink-0">
                {nilaiChartData.length > 0 ? `${nilaiChartData.length} periode` : ''}
              </p>
            </div>

            {/* Chart — fixed height + min-height untuk hindari width -1 error */}
            <div style={{ width: '100%', height: '160px', minHeight: '160px' }}>
              {mounted && nilaiChartData.length >= 2 ? (
                <ResponsiveContainer width="99%" height="100%" minWidth={0}>
                  <AreaChart data={nilaiChartData} margin={{ top: 8, right: 4, left: 4, bottom: 0 }}>
                    <defs>
                      <linearGradient id="nilaiGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#6ee7b7" stopOpacity={0.45} />
                        <stop offset="100%" stopColor="#6ee7b7" stopOpacity={0.02} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 6" stroke="rgba(255,255,255,0.08)" vertical={false} />
                    <XAxis
                      dataKey="label"
                      tick={{ fill: 'rgba(255,255,255,0.45)', fontSize: 10, fontWeight: 600 }}
                      axisLine={false} tickLine={false}
                      interval="preserveStartEnd"
                    />
                    <YAxis
                      tick={{ fill: 'rgba(255,255,255,0.35)', fontSize: 9 }}
                      axisLine={false} tickLine={false} width={70}
                      tickFormatter={(v) => {
                        if (v >= 1e9) return `${(v/1e9).toFixed(1)}M`;
                        if (v >= 1e6) return `${(v/1e6).toFixed(0)}Jt`;
                        if (v >= 1e3) return `${(v/1e3).toFixed(0)}rb`;
                        return v;
                      }}
                    />
                    <Tooltip
                      content={({ active, payload, label }) => {
                        if (!active || !payload?.length) return null;
                        return (
                          <div style={{ background:'rgba(5,30,50,0.95)', border:'1px solid rgba(110,231,183,0.3)', borderRadius:'12px', padding:'10px 14px', backdropFilter:'blur(12px)' }}>
                            <p style={{ color:'rgba(110,231,183,0.8)', fontSize:'10px', fontWeight:700, textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:'4px' }}>{label}</p>
                            <p style={{ color:'#ffffff', fontSize:'15px', fontWeight:800 }}>{formatRupiah(payload[0].value)}</p>
                          </div>
                        );
                      }}
                    />
                    <Area
                      type="monotone" dataKey="nilai"
                      stroke="#6ee7b7" strokeWidth={2.5}
                      fill="url(#nilaiGradient)"
                      dot={false}
                      activeDot={{ r: 5, fill: '#6ee7b7', stroke: 'rgba(110,231,183,0.3)', strokeWidth: 3 }}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex flex-col items-center justify-center h-full gap-2">
                  <TrendingUp size={28} className="text-emerald-400/40" />
                  <p className="text-sm text-emerald-300/60 font-medium">
                    {nilaiChartData.length === 0 ? 'Belum ada data pekerjaan pada periode ini' : 'Butuh minimal 2 periode untuk menampilkan chart'}
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Stat Cards ── */}
      {!loading && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7 gap-2.5 md:gap-3">
          {[
            { label: 'JO Terbit',  value: totalJoTerbit,  icon: FileText,     color: 'bg-indigo-50 text-indigo-600', textColor: 'text-indigo-700' },
            { label: 'Total Job',  value: stats.total,    icon: Briefcase,    color: 'bg-slate-50 text-slate-600',   textColor: 'text-slate-800'  },
            { label: 'Aktif',      value: stats.active,   icon: CheckCircle2, color: 'bg-amber-50 text-amber-600',   textColor: 'text-amber-700'  },
            { label: 'Selesai',    value: stats.completed,icon: CheckCircle2, color: 'bg-green-50 text-green-600',   textColor: 'text-green-700'  },
            { label: 'Draft',      value: stats.draft,    icon: FileEdit,     color: 'bg-blue-50 text-blue-600',     textColor: 'text-blue-700'   },
            { label: 'Dibatalkan', value: stats.cancelled,icon: XCircle,      color: 'bg-red-50 text-red-600',       textColor: 'text-red-700'    },
            { label: 'Pelanggaran 3x', value: stats.pelanggaran, icon: AlertTriangle, color: 'bg-rose-50 text-rose-600', textColor: 'text-rose-700' },
          ].map(({ label, value, icon: Icon, color, textColor }) => (
            <div key={label} className="bg-white p-3 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow flex items-center gap-3 min-w-0">
              <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${color}`}>
                <Icon size={18} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider leading-tight truncate" title={label}>{label}</p>
                <p className={`text-lg font-extrabold leading-none mt-1 ${textColor}`}>{value}</p>
              </div>
            </div>
          ))}
        </div>
      )}


      {/* ── Peta + Filter dalam satu card ── */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">

        {/* Filter bar */}
        <div className="px-5 py-3 border-b border-slate-100 flex items-center gap-2 overflow-x-auto">
          {FILTERS.map(({ id, label }) => {
            const active = filter === id;
            return (
              <button
                key={id}
                id={`filter-supervisi-${id}`}
                onClick={() => setFilter(id)}
                className={`px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-colors ${
                  active
                    ? 'bg-blue-600 text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {label}
                {id !== 'all' && !loading && (
                  <span className="ml-1.5 opacity-70">
                    ({validJobs.filter((j) => j.status === id).length})
                  </span>
                )}
              </button>
            );
          })}

          {!loading && (
            <span className="ml-auto text-xs text-slate-400 whitespace-nowrap shrink-0">
              {mapPointsCount} titik di peta
              {noCoordsJobs.length > 0 && ` · ${noCoordsJobs.length} tanpa koordinat`}
            </span>
          )}
        </div>

        {/* Peta */}
        <div className="relative" style={{ minHeight: '460px' }}>
          {loading ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-slate-400 bg-slate-50">
              <Loader2 size={30} className="animate-spin" />
              <p className="text-sm font-medium">Memuat data supervisi...</p>
            </div>
          ) : (
            <div
              className="absolute inset-0"
              style={{ isolation: 'isolate', zIndex: 0 }}
            >
              <LeafletMap
                onMapReady={onMapReady}
                onMapUnmount={onMapUnmount}
                className="h-full w-full"
                center={initialCenter ?? [-6.2, 106.8]}
                zoom={initialCenter ? 13 : 10}
              />
            </div>
          )}
        </div>

        {/* Panel job tanpa koordinat */}
        {!loading && noCoordsJobs.length > 0 && (
          <div className="border-t border-slate-100 p-5">
            <div className="flex items-center gap-2 mb-3">
              <AlertCircle size={14} className="text-amber-500 shrink-0" />
              <p className="text-sm font-semibold text-slate-700">
                {noCoordsJobs.length} job belum memiliki koordinat lokasi
              </p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
              {noCoordsJobs.map((job) => {
                const meta = SUPERVISI_STATUS_META[job.status] || SUPERVISI_STATUS_META.draft;
                return (
                  <button
                    key={job.id}
                    onClick={() => setSelectedJob(job)}
                    className="text-left bg-slate-50 rounded-xl px-3 py-2.5 border border-slate-200 hover:border-blue-300 hover:bg-blue-50/40 transition-colors"
                  >
                    <div className="flex items-center gap-1.5 mb-1">
                      <span className={`w-1.5 h-1.5 rounded-full ${meta.dot}`} />
                      <span className={`text-[10px] font-bold uppercase tracking-wide ${meta.color.split(' ')[1]}`}>
                        {meta.label}
                      </span>
                    </div>
                    <p className="text-xs font-semibold text-slate-800 truncate">{job.namaKerja || '—'}</p>
                    <p className="text-[11px] text-slate-400">{job.nomorJo}</p>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* ── Tabel List Job ── */}
      <div className="bg-white p-4 md:p-6 rounded-2xl border border-slate-200 shadow-sm mt-8">
        <div className="space-y-4">
          <div className="flex items-center gap-2 flex-wrap">
            {/* Search */}
            <div className="relative flex-1 min-w-[180px] max-w-sm">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                value={tableSearch}
                onChange={(e) => setTableSearch(e.target.value)}
                placeholder="Cari nomor JO, pekerjaan..."
                className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/30"
              />
            </div>

            {/* Filter Status */}
            <select
              value={tableStatusFilter}
              onChange={(e) => setTableStatusFilter(e.target.value)}
              className="px-2.5 py-2 border border-gray-200 rounded-lg text-sm bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
            >
              <option value="">Semua Status</option>
              <option value="active">Aktif</option>
              <option value="completed">Selesai</option>
              <option value="draft">Draft</option>
              <option value="cancelled">Dibatalkan</option>
            </select>

          {(tableSearch || tableStatusFilter) && (
            <button
              onClick={() => { setTableSearch(''); setTableStatusFilter(''); }}
              className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-800 px-2.5 py-2 rounded-lg border border-gray-200 bg-white hover:bg-gray-50 transition-colors"
            >
              <X size={12} /> Reset
            </button>
          )}

          <Button
            variant="outline"
            size="sm"
            onClick={load}
            className="ml-auto"
            disabled={loading}
          >
            <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
          </Button>
          </div>

          <p className="text-xs text-gray-400">
            Menampilkan <span className="font-semibold text-gray-600">{tableJobs.length}</span> dari {validJobs.length} Pekerjaan Supervisi
          </p>


          {/* Mobile card list */}
          <div className="md:hidden space-y-3">
            {loading ? (
              <div className="flex flex-col items-center gap-2 py-8 text-slate-400">
                <Loader2 size={24} className="animate-spin" />
                <p className="text-sm">Memuat data...</p>
              </div>
            ) : tableJobs.length === 0 ? (
              <div className="flex flex-col items-center gap-2 py-8 text-gray-400">
                <Search size={24} className="opacity-40" />
                <p className="text-sm">Tidak ada pekerjaan ditemukan</p>
              </div>
            ) : tableJobs.map((job) => {
              const meta = SUPERVISI_STATUS_META[job.status] || SUPERVISI_STATUS_META.draft;
              return (
                <div
                  key={job.id}
                  className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm cursor-pointer active:bg-blue-50/40 transition-colors"
                  onClick={() => { setSelectedJob(job); setFocusedJobId(job.id); }}
                >
                  <div className="flex items-start justify-between gap-2 mb-1.5">
                    <p className="font-semibold text-gray-800 leading-snug flex-1">{job.namaKerja || '—'}</p>
                    <StatusBadge status={job.status} />
                  </div>
                  <p className="font-mono text-[11px] text-gray-400 mb-3">{job.nomorJo || '—'}</p>
                  {job.picSupervisi && (
                    <p className="text-xs text-gray-500 mb-3 truncate">{job.picSupervisi}</p>
                  )}
                  <div className="flex gap-1.5 flex-wrap" onClick={(e) => e.stopPropagation()}>
                    <Button variant="outline" size="sm" className="h-7 text-xs gap-1" onClick={(e) => { e.stopPropagation(); setSelectedJob(job); }}>
                      <Eye size={11} /> Detail
                    </Button>
                    {job.status === 'draft' && canUpdateSupervisi && (
                      <Button variant="outline" size="sm" className="h-7 text-xs gap-1.5 text-blue-600 border-blue-200 hover:bg-blue-50 hover:border-blue-300 opacity-80 hover:opacity-100" onClick={(e) => { e.stopPropagation(); setJobToEdit(job); setShowCreateDialog(true); }}>
                        <FileEdit size={11} /> Lanjutkan
                      </Button>
                    )}
                    {job.status === 'active' && canUpdateSupervisi && (
                      <>
                        <Button variant="outline" size="sm" className="h-7 text-xs gap-1 text-blue-600 border-blue-200 hover:bg-blue-50" onClick={(e) => { e.stopPropagation(); setJobToEdit(job); setShowCreateDialog(true); }}>
                          <FileEdit size={11} /> Edit
                        </Button>
                        <Button variant="outline" size="sm" className="h-7 text-xs gap-1 text-green-600 border-green-200 hover:bg-green-50" onClick={(e) => { e.stopPropagation(); setJobToComplete(job); }}>
                          <CheckCircle2 size={11} /> Selesai
                        </Button>
                        <Button variant="outline" size="sm"
                          className={`h-7 text-xs gap-1 ${ isRadiusExemptionActive(job) ? 'text-emerald-700 border-emerald-200 bg-emerald-50' : 'text-teal-700 border-teal-200' }`}
                          onClick={(e) => { e.stopPropagation(); handleRadiusExemptionClick(job); }}
                        >
                          {isRadiusExemptionActive(job) ? (
                            <><CalendarOff size={11} /> Radius Off</>
                          ) : (
                            <><MapPin size={11} /> Radius On</>
                          )}
                        </Button>
                        <Button variant="outline" size="sm" className="h-7 text-xs gap-1 text-orange-600 border-orange-200"
                          onClick={(e) => { e.stopPropagation(); handleCancelClick(job); }}
                        >
                          <Ban size={11} /> Batalkan
                        </Button>
                      </>
                    )}
                    {canDeleteSupervisi && (job.status === 'draft' || job.status === 'cancelled' || job.status === 'completed') && (
                      <Button variant="outline" size="sm" className="h-7 text-xs gap-1 text-red-600 border-red-200"
                        onClick={(e) => { e.stopPropagation(); handleHapusClick(job); }}
                      >
                        <Trash2 size={11} />
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Desktop table */}
          <div className="hidden md:block bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-gray-600 min-w-[1200px]">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  {['Nomor JO', 'Nama Pekerjaan', 'PIC Supervisi', 'Status', 'Aksi'].map((h) => (
                    <th key={h} className="px-4 py-3 text-left text-[11px] font-bold text-gray-500 uppercase tracking-wider whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {loading ? (
                  <tr><td colSpan="5" className="px-6 py-8 text-center text-slate-400"><Loader2 size={24} className="animate-spin mx-auto mb-2" />Memuat data...</td></tr>
                ) : tableJobs.length === 0 ? (
                  <tr><td colSpan="5" className="px-4 py-10 text-center"><div className="flex flex-col items-center gap-2 text-gray-400"><Search size={24} className="opacity-40" /><p className="text-sm">Tidak ada pekerjaan ditemukan</p></div></td></tr>
                ) : tableJobs.map((job) => {
                  const meta = SUPERVISI_STATUS_META[job.status] || SUPERVISI_STATUS_META.draft;
                  return (
                    <tr key={job.id} className="hover:bg-blue-50/40 transition-colors cursor-pointer group" onClick={() => { setSelectedJob(job); setFocusedJobId(job.id); }}>
                      <td className="px-4 py-3 font-mono text-xs font-bold text-gray-500 whitespace-nowrap">{job.nomorJo || '-'}</td>
                      <td className="px-4 py-3 max-w-[220px]"><p className="font-semibold text-gray-800 truncate">{job.namaKerja || '-'}</p></td>
                      <td className="px-4 py-3 text-sm text-gray-500 max-w-[160px] truncate">{job.picSupervisi || '-'}</td>
                      <td className="px-4 py-3 whitespace-nowrap"><StatusBadge status={job.status} /></td>
                      <td className="px-4 py-3 whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center gap-1.5">
                          <Button variant="outline" size="sm" className="h-7 text-xs gap-1.5 opacity-80 hover:opacity-100" onClick={(e) => { e.stopPropagation(); setSelectedJob(job); }}><Eye size={11} /> Detail</Button>
                          {job.status === 'draft' && canUpdateSupervisi && (
                            <Button variant="outline" size="sm" className="h-7 text-xs gap-1.5 text-blue-600 border-blue-200 hover:bg-blue-50 hover:border-blue-300 opacity-80 hover:opacity-100" onClick={(e) => { e.stopPropagation(); setJobToEdit(job); setShowCreateDialog(true); }}><FileEdit size={11} /> Lanjutkan</Button>
                          )}
                          {job.status === 'active' && canUpdateSupervisi && (
                            <>
                              <Button variant="outline" size="sm" className="h-7 text-xs gap-1 text-blue-600 border-blue-200 hover:bg-blue-50 hover:border-blue-300 opacity-80 hover:opacity-100" onClick={(e) => { e.stopPropagation(); setJobToEdit(job); setShowCreateDialog(true); }}><FileEdit size={11} /> Edit</Button>
                              <Button variant="outline" size="sm" className="h-7 text-xs gap-1 text-green-600 border-green-200 hover:bg-green-50 hover:border-green-300 opacity-80 hover:opacity-100" onClick={(e) => { e.stopPropagation(); setJobToComplete(job); }}><CheckCircle2 size={11} /> Selesai</Button>
                              <Button variant="outline" size="sm" className={`h-7 text-xs gap-1 opacity-80 hover:opacity-100 ${ isRadiusExemptionActive(job) ? 'text-emerald-700 border-emerald-200 bg-emerald-50 hover:bg-emerald-100' : 'text-teal-700 border-teal-200 hover:bg-teal-50 hover:border-teal-300' }`} onClick={(e) => { e.stopPropagation(); handleRadiusExemptionClick(job); }}>
                                {isRadiusExemptionActive(job) ? (
                                  <><CalendarOff size={11} /> Radius Off</>
                                ) : (
                                  <><MapPin size={11} /> Radius On</>
                                )}
                              </Button>
                              <Button variant="outline" size="sm" className="h-7 text-xs gap-1 text-orange-600 border-orange-200 hover:bg-orange-50 hover:border-orange-300 opacity-80 hover:opacity-100" onClick={(e) => { e.stopPropagation(); handleCancelClick(job); }}><Ban size={11} /> Batalkan</Button>
                            </>
                          )}
                          {canDeleteSupervisi && (job.status === 'draft' || job.status === 'cancelled' || job.status === 'completed') && (
                            <Button variant="outline" size="sm" className="h-7 text-xs gap-1 text-red-600 border-red-200 hover:bg-red-50 hover:border-red-300 opacity-80 hover:opacity-100" onClick={(e) => { e.stopPropagation(); handleHapusClick(job); }}><Trash2 size={11} /> Hapus</Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
          </div>
        </div>

      {/* ── Side panel detail ── */}
      </>
      ) : (
        <SupervisiArchiveSection
          jobs={archiveJobs}
          meta={archiveMeta}
          loading={archiveLoading}
          search={archiveSearchInput}
          status={archiveStatus}
          onSearchChange={setArchiveSearchInput}
          onStatusChange={setArchiveStatus}
          onPageChange={setArchivePage}
          onViewDetail={setSelectedJob}
          formatRupiah={formatRupiah}
        />
      )}

      <SupervisiJobPanel job={selectedJob} onClose={() => { setSelectedJob(null); setFocusedJobId(null); }} />

      <SupervisiJobFormDialog
        open={showCreateDialog}
        onOpenChange={(open) => {
          setShowCreateDialog(open);
          if (!open) setTimeout(() => setJobToEdit(null), 300); // clear after close animation
        }}
        onSaved={handleCreatedJob}
        jobToEdit={jobToEdit}
      />

      {/* Konfirmasi pemindahan pin lokasi */}
      <Dialog
        open={!!pendingPinMove}
        onOpenChange={(open) => {
          if (!open) closePinMoveDialog();
        }}
      >
        <DialogContent className="max-w-md" showCloseButton={!isSavingPinMove}>
          <DialogHeader>
            <DialogTitle className="text-blue-700 flex items-center gap-2">
              <MapPin size={18} /> Pindahkan Pin Lokasi?
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-gray-600 mt-1">
            Pin <span className="font-semibold text-slate-700">{pendingPinMove?.locationName || 'Lokasi'}</span> untuk pekerjaan <span className="font-semibold text-slate-700">{pendingPinMove?.job?.namaKerja || '-'}</span> akan dipindahkan.
          </p>
          <div className="mt-3 rounded-xl border border-blue-100 bg-blue-50/60 px-3 py-2.5 space-y-1.5 text-xs">
            <div className="flex items-start justify-between gap-3">
              <span className="font-semibold text-slate-500">Koordinat lama</span>
              <span className="font-mono text-slate-700 text-right">{formatLatLng(pendingPinMove?.previousLatLng)}</span>
            </div>
            <div className="flex items-start justify-between gap-3">
              <span className="font-semibold text-slate-500">Koordinat baru</span>
              <span className="font-mono text-blue-700 text-right">{formatLatLng(pendingPinMove?.nextLatLng)}</span>
            </div>
          </div>
          <DialogFooter className="mt-5 gap-2">
            <Button
              variant="outline"
              disabled={isSavingPinMove}
              onClick={closePinMoveDialog}
            >
              Batal
            </Button>
            <Button
              className="gap-2 bg-blue-700 hover:bg-blue-800 text-white"
              disabled={isSavingPinMove || !canUpdateSupervisi}
              onClick={confirmPinMove}
            >
              {isSavingPinMove ? <Loader2 size={14} className="animate-spin" /> : <MapPin size={14} />}
              Ya, Pindahkan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Cancel Confirmation Modal ── */}
      <Dialog
        open={!!jobToCancel}
        onOpenChange={(open) => {
          if (!open && !isCancelling) {
            setJobToCancel(null);
            setCancelReason('');
          }
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-orange-700 flex items-center gap-2">
              <Ban size={18} /> Batalkan Pekerjaan?
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-gray-600 mt-1">
            Pekerjaan <span className="font-semibold text-slate-700">"{jobToCancel?.namaKerja}"</span> akan dibatalkan. Status berubah menjadi <span className="font-semibold text-orange-600">Dibatalkan</span> dan tidak bisa diaktifkan kembali.
          </p>
          <div className="mt-4">
            <label className="block text-xs font-bold uppercase tracking-wide text-gray-500 mb-1.5">
              Alasan Pembatalan <span className="text-red-500">*</span>
            </label>
            <textarea
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-700 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-orange-300 focus:border-orange-400 resize-none bg-gray-50"
              rows={3}
              placeholder="Jelaskan alasan pembatalan pekerjaan ini..."
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
              disabled={isCancelling}
            />
            {cancelReason.trim().length > 0 && cancelReason.trim().length < 5 && (
              <p className="text-xs text-red-500 mt-1">Alasan terlalu singkat (min. 5 karakter)</p>
            )}
          </div>
          <DialogFooter className="mt-5 gap-2">
            <Button
              variant="outline"
              disabled={isCancelling}
              onClick={() => { setJobToCancel(null); setCancelReason(''); }}
            >
              Kembali
            </Button>
            <Button
              className="gap-2 bg-orange-600 hover:bg-orange-700 text-white"
              disabled={isCancelling || cancelReason.trim().length < 5 || !canUpdateSupervisi}
              onClick={confirmCancelJob}
            >
              {isCancelling ? <Loader2 size={14} className="animate-spin" /> : <Ban size={14} />}
              Ya, Batalkan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Hapus Permanen Confirmation Modal ── */}
      {/* Radius Exemption Modal */}
      <Dialog
        open={!!jobToRadiusExempt}
        onOpenChange={(open) => {
          if (!open && !isSavingRadiusExemption) closeRadiusExemptionDialog();
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-teal-700 flex items-center gap-2">
              <CalendarOff size={18} /> Nonaktifkan Kewajiban Radius
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-gray-600 mt-1">
            Eksekutor dapat submit laporan hadir tanpa wajib berada di dalam radius selama rentang tanggal yang dipilih.
          </p>
          <div className="mt-4 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wide text-gray-500 mb-1.5">
                  Mulai
                </label>
                <input
                  type="date"
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-teal-300 focus:border-teal-400 bg-gray-50"
                  value={radiusExemptionForm.startDate}
                  onChange={(e) => setRadiusExemptionForm((prev) => ({ ...prev, startDate: e.target.value }))}
                  disabled={isSavingRadiusExemption}
                />
              </div>
              <div>
                <label className="block text-xs font-bold uppercase tracking-wide text-gray-500 mb-1.5">
                  Akhir
                </label>
                <input
                  type="date"
                  min={radiusExemptionForm.startDate || undefined}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-teal-300 focus:border-teal-400 bg-gray-50"
                  value={radiusExemptionForm.endDate}
                  onChange={(e) => setRadiusExemptionForm((prev) => ({ ...prev, endDate: e.target.value }))}
                  disabled={isSavingRadiusExemption}
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-bold uppercase tracking-wide text-gray-500 mb-1.5">
                Alasan
              </label>
              <textarea
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-700 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-teal-300 focus:border-teal-400 resize-none bg-gray-50"
                rows={3}
                placeholder="Contoh: area proyek sulit dijangkau GPS selama pekerjaan emergency."
                value={radiusExemptionForm.reason}
                onChange={(e) => setRadiusExemptionForm((prev) => ({ ...prev, reason: e.target.value }))}
                disabled={isSavingRadiusExemption}
              />
            </div>
            {jobToRadiusExempt?.radiusExemptionStartDate && jobToRadiusExempt?.radiusExemptionEndDate && (
              <div className="bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2">
                <p className="text-xs text-emerald-700">
                  Saat ini nonaktif {dateOnly(jobToRadiusExempt.radiusExemptionStartDate)} sampai {dateOnly(jobToRadiusExempt.radiusExemptionEndDate)}.
                </p>
              </div>
            )}
          </div>
          <DialogFooter className="mt-5 gap-2">
            {jobToRadiusExempt?.radiusExemptionStartDate && jobToRadiusExempt?.radiusExemptionEndDate && (
              <Button
                variant="outline"
                disabled={isSavingRadiusExemption || !canUpdateSupervisi}
                onClick={clearRadiusExemption}
                className="text-slate-700"
              >
                Aktifkan Lagi
              </Button>
            )}
            <Button
              variant="outline"
              disabled={isSavingRadiusExemption}
              onClick={closeRadiusExemptionDialog}
            >
              Batal
            </Button>
            <Button
              className="gap-2 bg-teal-700 hover:bg-teal-800 text-white"
              disabled={isSavingRadiusExemption || !canUpdateSupervisi}
              onClick={confirmRadiusExemption}
            >
              {isSavingRadiusExemption ? <Loader2 size={14} className="animate-spin" /> : <CalendarOff size={14} />}
              Simpan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Selesai Confirmation Modal */}
      <Dialog
        open={!!jobToComplete}
        onOpenChange={(open) => { if (!open && !isCompleting) setJobToComplete(null); }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-emerald-700 flex items-center gap-2">
              <CheckCircle2 size={18} /> Selesaikan Pekerjaan?
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-gray-600 mt-2">
            Apakah Anda yakin ingin menyelesaikan pekerjaan <span className="font-semibold text-slate-700">"{jobToComplete?.namaKerja}"</span> secara manual?
          </p>
          <div className="mt-3 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2">
            <p className="text-xs text-emerald-700">
              <span className="font-bold">Info:</span> Status akan berubah menjadi <span className="font-bold text-emerald-800">Selesai</span> dan pekerjaan ini akan diarsipkan secara rapi.
            </p>
          </div>
          <DialogFooter className="mt-6 gap-2">
            <Button variant="outline" disabled={isCompleting} onClick={() => setJobToComplete(null)}>
              Batal
            </Button>
            <Button
              disabled={isCompleting || !canUpdateSupervisi}
              onClick={confirmCompleteJob}
              className="gap-2 bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              {isCompleting ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
              Ya, Selesaikan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Hapus Permanen Confirmation Modal */}
      <Dialog
        open={!!jobToHapus}
        onOpenChange={(open) => { if (!open && !isHapusing) setJobToHapus(null); }}
      >
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-red-700 flex items-center gap-2">
              <Trash2 size={18} /> Hapus Permanen?
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-gray-600 mt-2">
            Data pekerjaan <span className="font-semibold text-slate-700">"{jobToHapus?.namaKerja}"</span> akan <span className="font-bold text-red-600">dihapus permanen</span> dari sistem dan tidak bisa dikembalikan.
          </p>
          {jobToHapus?.status === 'cancelled' && jobToHapus?.cancelReason && (
            <div className="mt-3 bg-orange-50 border border-orange-200 rounded-lg px-3 py-2">
              <p className="text-xs text-orange-700"><span className="font-bold">Alasan dibatalkan:</span> {jobToHapus.cancelReason}</p>
            </div>
          )}
          <DialogFooter className="mt-6 gap-2">
            <Button variant="outline" disabled={isHapusing} onClick={() => setJobToHapus(null)}>
              Batal
            </Button>
            <Button
              variant="destructive"
              disabled={isHapusing || !canDeleteSupervisi}
              onClick={confirmHapusJob}
              className="gap-2"
            >
              {isHapusing ? <Loader2 size={14} className="animate-spin" /> : null}
              Ya, Hapus Permanen
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
