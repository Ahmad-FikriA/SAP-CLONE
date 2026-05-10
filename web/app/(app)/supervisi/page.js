'use client';

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { toast } from 'sonner';
import dynamic from 'next/dynamic';
import {
  MapPin, Loader2, AlertCircle, RefreshCw, Search, X, XCircle, CalendarDays,
  Briefcase, CheckCircle2, FileEdit, FileText, Banknote, Trash2, Eye, Ban,
  CalendarOff
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import {
  fetchSupervisiJobs,
  cancelSupervisiJob,
  deleteSupervisiJob,
  updateSupervisiJobLocation,
  updateSupervisiRadiusExemption,
  SUPERVISI_STATUS_META,
} from '@/lib/supervisi-service';
import { SupervisiJobPanel } from '@/components/supervisi/SupervisiJobPanel';

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
  const [jobToRadiusExempt, setJobToRadiusExempt] = useState(null);
  const [isSavingRadiusExemption, setIsSavingRadiusExemption] = useState(false);
  const [pendingPinMove, setPendingPinMove] = useState(null);
  const [isSavingPinMove, setIsSavingPinMove] = useState(false);
  const [radiusExemptionForm, setRadiusExemptionForm] = useState({
    startDate: '',
    endDate: '',
    reason: '',
  });

  // backward‑compat alias (beberapa tempat masih pakai jobToDelete)
  const jobToDelete    = jobToCancel;
  const setJobToDelete = setJobToCancel;
  const [tableSearch, setTableSearch] = useState('');
  const [tableStatusFilter, setTableStatusFilter] = useState('');

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
      const data = await fetchSupervisiJobs();
      setJobs(Array.isArray(data) ? data : []);
    } catch (e) {
      toast.error('Gagal memuat data supervisi: ' + e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // ── Derive opsi tahun dari data ─────────────────────────────────────────────
  const yearOptions = useMemo(() => {
    const years = new Set(
      jobs
        .map((j) => (j.waktuMulai || j.createdAt)?.slice(0, 4))
        .filter(Boolean),
    );
    years.add(String(currentYear));
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

  // ── Refresh markers ketika validJobs atau filter berubah ─────────────────────
  useEffect(() => {
    if (!mapRef.current || !LRef.current || !mapReadyRef.current) return;
    renderMarkers(mapRef.current, LRef.current, validJobs, filter);
  }, [validJobs, filter]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Callback saat peta siap ─────────────────────────────────────────────────
  const onMapReady = useCallback((map, L) => {
    mapRef.current  = map;
    LRef.current    = L;
    mapReadyRef.current = true;
    if (validJobs.length > 0) renderMarkers(map, L, validJobs, filter);
  }, [validJobs, filter]); // eslint-disable-line react-hooks/exhaustive-deps

  const onMapUnmount = useCallback(() => {
    mapReadyRef.current = false;
    mapRef.current = null;
    LRef.current = null;
  }, []);

  // ── Render / re-render markers ──────────────────────────────────────────────
  const handleLocationDragEnd = useCallback(({ job, locationIndex, marker, previousLatLng, nextLatLng }) => {
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
  }, []);

  function renderMarkers(map, L, allJobs, activeFilter) {
    // Bersihkan marker lama
    markersRef.current.forEach((m) => m.remove());
    markersRef.current = [];

    const visible = activeFilter === 'all'
      ? allJobs
      : allJobs.filter((j) => j.status === activeFilter);

    visible.forEach((job) => {
      const color = markerColor(job.status);
      const icon  = makePinIcon(L, color);
      const meta  = SUPERVISI_STATUS_META[job.status] || SUPERVISI_STATUS_META.draft;

      const points = getJobLocations(job).map((loc, idx) => ({
        lat: loc.latitude,
        lng: loc.longitude,
        area: loc.namaArea,
        locationId: loc.id,
        locationIndex: idx,
      }));

      // Render marker untuk tiap titik
      points.forEach((pt) => {
        let previousLatLng = L.latLng(pt.lat, pt.lng);
        const marker = L.marker([pt.lat, pt.lng], { icon, draggable: true });
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
        marker.on('add', () => {
          const el = marker.getElement();
          if (el) el.style.cursor = 'grab';
        });
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
        marker.addTo(map);
        markersRef.current.push(marker);
      });
    });

    // Fit bounds ke semua marker yang tampil
    if (markersRef.current.length > 0) {
      if (skipNextFitBoundsRef.current) {
        skipNextFitBoundsRef.current = false;
      } else {
        const group = L.featureGroup(markersRef.current);
        map.fitBounds(group.getBounds().pad(0.15), { maxZoom: 14 });
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
  };
  stats.total = stats.active + stats.completed + stats.draft + stats.cancelled;

  // JO yang sudah terbit (bukan draft)
  const totalJoTerbit = stats.active + stats.completed;
  
  // Total Nilai Pekerjaan dari job aktif dan selesai saja (bukan draft/cancelled)
  const totalNilai = validJobs
    .filter((j) => j.status === 'active' || j.status === 'completed')
    .reduce((sum, job) => sum + (parseFloat(job.nilaiPekerjaan) || 0), 0);

  const formatRupiah = (value) => {
    if (!value) return 'Rp 0';
    if (value >= 1e9) {
      return `Rp ${(value / 1e9).toFixed(1)} Miliar`;
    } else if (value >= 1e6) {
      return `Rp ${(value / 1e6).toFixed(1)} Juta`;
    }
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

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

  const handleCancelClick = (job) => setJobToCancel(job);
  const handleHapusClick  = (job) => setJobToHapus(job);
  const handleRadiusExemptionClick = (job) => {
    setJobToRadiusExempt(job);
    setRadiusExemptionForm({
      startDate: dateOnly(job.radiusExemptionStartDate),
      endDate: dateOnly(job.radiusExemptionEndDate),
      reason: job.radiusExemptionReason || '',
    });
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

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto space-y-6">

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

          <button
            onClick={load}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-semibold transition-colors disabled:opacity-50"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            Refresh
          </button>
        </div>
      </div>

      {/* ── Executive Summary ── */}
      {!loading && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Card JO Terbit */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
            <div>
              <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">JO Terbit</p>
              <p className="text-3xl font-extrabold text-slate-900">{totalJoTerbit}</p>
            </div>
            <div className="w-14 h-14 rounded-2xl bg-indigo-50 flex items-center justify-center text-indigo-600">
              <FileText size={28} strokeWidth={2.5} />
            </div>
          </div>

          {/* Card Total Nilai (Premium) */}
          <div className="md:col-span-2 relative overflow-hidden bg-gradient-to-br from-emerald-600 via-teal-700 to-emerald-900 p-6 rounded-2xl shadow-lg flex items-center justify-between group">
            {/* Decorative Ornaments */}
            <div className="absolute -right-8 -top-8 w-40 h-40 bg-white/10 rounded-full blur-2xl group-hover:scale-110 transition-transform duration-700"></div>
            <div className="absolute right-16 -bottom-8 w-32 h-32 bg-emerald-400/20 rounded-full blur-2xl group-hover:scale-110 transition-transform duration-700"></div>
            
            <div className="relative z-10 w-full flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 mb-1.5 opacity-90 text-emerald-50">
                  <Banknote size={18} strokeWidth={2.5} />
                  <p className="text-[11px] font-bold uppercase tracking-wider">Total Nilai Pekerjaan</p>
                </div>
                <p className="text-3xl md:text-4xl font-extrabold text-white tracking-tight drop-shadow-md">
                  {formatRupiah(totalNilai)}
                </p>
              </div>
              <div className="hidden sm:flex w-12 h-12 rounded-full bg-white/20 backdrop-blur-sm items-center justify-center text-white border border-white/30 shadow-inner">
                <Banknote size={24} />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Stat Cards ── */}
      {!loading && (
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
          {[
            { label: 'Total Job',  value: stats.total,     icon: Briefcase,     color: 'bg-slate-50 text-slate-600'  },
            { label: 'Aktif',      value: stats.active,    icon: CheckCircle2,  color: 'bg-yellow-50 text-yellow-600' },
            { label: 'Selesai',    value: stats.completed, icon: CheckCircle2,  color: 'bg-green-50 text-green-600' },
            { label: 'Draft',      value: stats.draft,     icon: FileEdit,      color: 'bg-blue-50 text-blue-600' },
            { label: 'Dibatalkan', value: stats.cancelled, icon: XCircle,       color: 'bg-red-50 text-red-600' },
          ].map(({ label, value, icon: Icon, color }) => (
            <div
              key={label}
              className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow flex items-center gap-4"
            >
              <div className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${color}`}>
                <Icon size={22} />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">{label}</p>
                <p className="text-2xl font-extrabold text-slate-900">{value}</p>
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
      <div className="bg-white p-5 md:p-6 rounded-2xl border border-slate-200 shadow-sm mt-8">
        <div className="space-y-4">
          <div className="flex items-center gap-3 flex-wrap">
            {/* Search */}
          <div className="relative flex-1 min-w-[220px] max-w-sm">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              value={tableSearch}
              onChange={(e) => setTableSearch(e.target.value)}
              placeholder="Cari nomor JO, pekerjaan, PIC..."
              className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/30"
            />
          </div>

          {/* Filter Status */}
          <select
            value={tableStatusFilter}
            onChange={(e) => setTableStatusFilter(e.target.value)}
            className="px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
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

        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
          <table className="w-full text-left text-sm text-gray-600">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                {['Nomor JO', 'Nama Pekerjaan', 'PIC Supervisi', 'Status', 'Aksi'].map((h) => (
                  <th
                    key={h}
                    className="px-4 py-3 text-left text-[11px] font-bold text-gray-500 uppercase tracking-wider"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr>
                  <td colSpan="5" className="px-6 py-8 text-center text-slate-400">
                    <Loader2 size={24} className="animate-spin mx-auto mb-2" />
                    Memuat data...
                  </td>
                </tr>
              ) : tableJobs.length === 0 ? (
                <tr>
                  <td colSpan="5" className="px-4 py-10 text-center">
                    <div className="flex flex-col items-center gap-2 text-gray-400">
                      <Search size={24} className="opacity-40" />
                      <p className="text-sm">Tidak ada pekerjaan ditemukan</p>
                    </div>
                  </td>
                </tr>
              ) : (
                tableJobs.map((job) => {
                  const meta = SUPERVISI_STATUS_META[job.status] || SUPERVISI_STATUS_META.draft;
                  return (
                    <tr
                      key={job.id}
                      className="hover:bg-blue-50/40 transition-colors cursor-pointer group"
                      onClick={() => setSelectedJob(job)}
                    >
                      <td className="px-4 py-3 font-mono text-xs font-bold text-gray-500 whitespace-nowrap">
                        {job.nomorJo || '-'}
                      </td>
                      <td className="px-4 py-3 max-w-[220px]">
                        <p className="font-semibold text-gray-800 truncate">{job.namaKerja || '-'}</p>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-500 max-w-[160px] truncate">
                        {job.picSupervisi || '-'}
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge status={job.status} />
                      </td>
                      <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center gap-1.5">
                          {/* Tombol Detail - selalu tampil */}
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-7 text-xs gap-1.5 opacity-80 hover:opacity-100"
                            onClick={(e) => { e.stopPropagation(); setSelectedJob(job); }}
                          >
                            <Eye size={11} /> Detail
                          </Button>

                          {/* Tombol Batalkan - hanya untuk active */}
                          {job.status === 'active' && (
                            <>
                              <Button
                                variant="outline"
                                size="sm"
                                className={`h-7 text-xs gap-1 opacity-80 hover:opacity-100 ${
                                  isRadiusExemptionActive(job)
                                    ? 'text-emerald-700 border-emerald-200 bg-emerald-50 hover:bg-emerald-100'
                                    : 'text-teal-700 border-teal-200 hover:bg-teal-50 hover:border-teal-300'
                                }`}
                                onClick={(e) => { e.stopPropagation(); handleRadiusExemptionClick(job); }}
                              >
                                <CalendarOff size={11} /> Radius
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-7 text-xs gap-1 text-orange-600 border-orange-200 hover:bg-orange-50 hover:border-orange-300 opacity-80 hover:opacity-100"
                                onClick={(e) => { e.stopPropagation(); handleCancelClick(job); }}
                              >
                                <Ban size={11} /> Batalkan
                              </Button>
                            </>
                          )}

                          {/* Tombol Hapus - hanya untuk cancelled/completed */}
                          {(job.status === 'cancelled' || job.status === 'completed') && (
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-7 text-xs gap-1 text-red-600 border-red-200 hover:bg-red-50 hover:border-red-300 opacity-80 hover:opacity-100"
                              onClick={(e) => { e.stopPropagation(); handleHapusClick(job); }}
                            >
                              <Trash2 size={11} /> Hapus
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
      </div>

      {/* ── Side panel detail ── */}
      <SupervisiJobPanel job={selectedJob} onClose={() => setSelectedJob(null)} />

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
              disabled={isSavingPinMove}
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
              disabled={isCancelling || cancelReason.trim().length < 5}
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
                disabled={isSavingRadiusExemption}
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
              disabled={isSavingRadiusExemption}
              onClick={confirmRadiusExemption}
            >
              {isSavingRadiusExemption ? <Loader2 size={14} className="animate-spin" /> : <CalendarOff size={14} />}
              Simpan
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
              disabled={isHapusing}
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
