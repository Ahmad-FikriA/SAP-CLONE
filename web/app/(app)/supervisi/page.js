'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { toast } from 'sonner';
import dynamic from 'next/dynamic';
import {
  MapPin, Loader2, AlertCircle, RefreshCw,
  Briefcase, CheckCircle2, FileEdit, FileText, Banknote
} from 'lucide-react';
import { fetchSupervisiJobs, SUPERVISI_STATUS_META } from '@/lib/supervisi-service';
import { SupervisiJobPanel } from '@/components/supervisi/SupervisiJobPanel';

// Leaflet hanya berjalan di client
const LeafletMap = dynamic(() => import('@/components/map/LeafletMap'), { ssr: false });

// ── Status filter pills ───────────────────────────────────────────────────────
const FILTERS = [
  { id: 'all',       label: 'Semua'   },
  { id: 'active',    label: 'Aktif'   },
  { id: 'completed', label: 'Selesai' },
  { id: 'draft',     label: 'Draft'   },
];

// Warna marker per status (hex, untuk divIcon)
const MARKER_COLORS = {
  active:    '#22C55E',
  completed: '#3B82F6',
  draft:     '#9CA3AF',
};

function markerColor(status) {
  return MARKER_COLORS[status] || '#9CA3AF';
}

// ── Buat custom divIcon berbentuk pin ─────────────────────────────────────────
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
  const active = jobs.find((j) => j.status === 'active' && j.latitude && j.longitude);
  if (active) return [parseFloat(active.latitude), parseFloat(active.longitude)];

  const anyWithCoords = jobs.find((j) => j.latitude && j.longitude);
  if (anyWithCoords) return [parseFloat(anyWithCoords.latitude), parseFloat(anyWithCoords.longitude)];

  return null; // tidak ada koordinat sama sekali
}

export default function SupervisiPage() {
  const [jobs,        setJobs]        = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [filter,      setFilter]      = useState('all');
  const [selectedJob, setSelectedJob] = useState(null);

  // Refs untuk akses Leaflet dari luar komponen
  const mapRef     = useRef(null);
  const LRef       = useRef(null);
  const markersRef = useRef([]);
  const mapReadyRef = useRef(false); // apakah peta sudah mount

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

  // ── Refresh markers ketika jobs atau filter berubah ──────────────────────────
  useEffect(() => {
    if (!mapRef.current || !LRef.current || !mapReadyRef.current) return;
    renderMarkers(mapRef.current, LRef.current, jobs, filter);
  }, [jobs, filter]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Callback saat peta siap ─────────────────────────────────────────────────
  const onMapReady = useCallback((map, L) => {
    mapRef.current  = map;
    LRef.current    = L;
    mapReadyRef.current = true;
    if (jobs.length > 0) renderMarkers(map, L, jobs, filter);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Render / re-render markers ──────────────────────────────────────────────
  function renderMarkers(map, L, allJobs, activeFilter) {
    // Bersihkan marker lama
    markersRef.current.forEach((m) => m.remove());
    markersRef.current = [];

    const visible = (activeFilter === 'all'
      ? allJobs
      : allJobs.filter((j) => j.status === activeFilter)
    ).filter((j) => j.status !== 'cancelled');

    visible.forEach((job) => {
      const lat = parseFloat(job.latitude);
      const lng = parseFloat(job.longitude);
      if (isNaN(lat) || isNaN(lng)) return;

      const color = markerColor(job.status);
      const icon  = makePinIcon(L, color);
      const meta  = SUPERVISI_STATUS_META[job.status] || SUPERVISI_STATUS_META.draft;

      const marker = L.marker([lat, lng], { icon });

      const popupContent = `
        <div style="min-width:200px;font-family:system-ui,sans-serif">
          <p style="font-size:10px;font-weight:700;color:#6B7280;letter-spacing:.05em;text-transform:uppercase;margin-bottom:4px">
            ${meta.label}
          </p>
          <p style="font-size:13px;font-weight:700;color:#111827;line-height:1.3;margin:0 0 4px">
            ${job.namaKerja || '—'}
          </p>
          <p style="font-size:11px;color:#6B7280;margin:0 0 2px">📋 ${job.nomorJo || '—'}</p>
          ${job.picSupervisi ? `<p style="font-size:11px;color:#6B7280;margin:0 0 2px">👤 ${job.picSupervisi}</p>` : ''}
          ${job.namaArea     ? `<p style="font-size:11px;color:#6B7280;margin:0">📍 ${job.namaArea}</p>` : ''}
          <button
            onclick="window.__supervisiSelectJob(${job.id})"
            style="margin-top:10px;padding:5px 12px;background:#1d4ed8;color:#fff;border:none;border-radius:6px;font-size:11px;font-weight:600;cursor:pointer;width:100%"
          >
            Lihat Detail →
          </button>
        </div>`;

      marker.bindPopup(popupContent, { maxWidth: 260 });
      marker.addTo(map);
      markersRef.current.push(marker);
    });

    // Fit bounds ke semua marker yang tampil
    if (markersRef.current.length > 0) {
      const group = L.featureGroup(markersRef.current);
      map.fitBounds(group.getBounds().pad(0.15), { maxZoom: 14 });
    }
  }

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

  // ── Derived data ────────────────────────────────────────────────────────────
  const filteredJobs = filter === 'all' ? jobs : jobs.filter((j) => j.status === filter);
  const withCoords   = filteredJobs.filter((j) => j.latitude && j.longitude);
  const noCoords     = filteredJobs.filter((j) => !j.latitude || !j.longitude);

  const stats = {
    active:    jobs.filter((j) => j.status === 'active').length,
    completed: jobs.filter((j) => j.status === 'completed').length,
    draft:     jobs.filter((j) => j.status === 'draft').length,
  };
  stats.total = stats.active + stats.completed + stats.draft;

  // JO yang sudah terbit (bukan draft)
  const totalJoTerbit = stats.active + stats.completed;
  
  // Total Nilai Pekerjaan dari job yang sudah terbit
  const totalNilai = jobs
    .filter((j) => j.status !== 'draft')
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
  const initialCenter = loading ? null : getInitialMapCenter(jobs);

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

        <button
          onClick={load}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-semibold transition-colors disabled:opacity-50 self-start sm:self-auto"
        >
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          Refresh
        </button>
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
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            { label: 'Total Job',  value: stats.total,     icon: Briefcase,     color: 'bg-blue-50 text-blue-600'  },
            { label: 'Aktif',      value: stats.active,    icon: CheckCircle2,  color: 'bg-green-50 text-green-600' },
            { label: 'Selesai',    value: stats.completed, icon: CheckCircle2,  color: 'bg-slate-50 text-slate-500' },
            { label: 'Draft',      value: stats.draft,     icon: FileEdit,      color: 'bg-amber-50 text-amber-600' },
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
                    ({jobs.filter((j) => j.status === id).length})
                  </span>
                )}
              </button>
            );
          })}

          {!loading && (
            <span className="ml-auto text-xs text-slate-400 whitespace-nowrap shrink-0">
              {withCoords.length} titik di peta
              {noCoords.length > 0 && ` · ${noCoords.length} tanpa koordinat`}
            </span>
          )}
        </div>

        {/* Peta */}
        {/*
         * [z-index fix] isolation:isolate mengurung z-index Leaflet di dalam
         * elemen ini sehingga tidak bocor ke Side Panel.
         */}
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
              {/* Render peta hanya setelah data loaded.
                  center diturunkan dari koordinat job aktif pertama.
                  Jika tidak ada koordinat sama sekali, pakai fallback Jakarta. */}
              <LeafletMap
                key={initialCenter ? initialCenter.join(',') : 'no-coords'}
                onMapReady={onMapReady}
                className="h-full w-full"
                center={initialCenter ?? [-6.2, 106.8]}
                zoom={initialCenter ? 13 : 10}
              />
            </div>
          )}
        </div>

        {/* Panel job tanpa koordinat */}
        {!loading && noCoords.length > 0 && (
          <div className="border-t border-slate-100 p-5">
            <div className="flex items-center gap-2 mb-3">
              <AlertCircle size={14} className="text-amber-500 shrink-0" />
              <p className="text-sm font-semibold text-slate-700">
                {noCoords.length} job belum memiliki koordinat lokasi
              </p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
              {noCoords.map((job) => {
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

      {/* ── Side panel detail ── */}
      <SupervisiJobPanel job={selectedJob} onClose={() => setSelectedJob(null)} />
    </div>
  );
}
