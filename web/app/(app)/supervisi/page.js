'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { toast } from 'sonner';
import dynamic from 'next/dynamic';
import { MapPin, Loader2, AlertCircle, RefreshCw } from 'lucide-react';
import { fetchSupervisiJobs, SUPERVISI_STATUS_META } from '@/lib/supervisi-service';
import { SupervisiJobPanel } from '@/components/supervisi/SupervisiJobPanel';

// Leaflet hanya berjalan di client
const LeafletMap = dynamic(() => import('@/components/map/LeafletMap'), { ssr: false });

// ── Status filter pills ───────────────────────────────────────────────────────
const FILTERS = [
  { id: 'all',       label: 'Semua'     },
  { id: 'active',    label: 'Aktif'     },
  { id: 'completed', label: 'Selesai'   },
  { id: 'draft',     label: 'Draft'     },
  { id: 'cancelled', label: 'Dibatalkan'},
];

// Warna marker per status (hex, untuk divIcon)
const MARKER_COLORS = {
  active:    '#22C55E',
  completed: '#3B82F6',
  draft:     '#9CA3AF',
  cancelled: '#EF4444',
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

export default function SupervisiPage() {
  const [jobs,        setJobs]        = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [filter,      setFilter]      = useState('all');
  const [selectedJob, setSelectedJob] = useState(null);

  // Refs untuk akses Leaflet dari luar komponen
  const mapRef    = useRef(null);
  const LRef      = useRef(null);
  const markersRef = useRef([]);   // array layer yang di-add ke peta

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
    if (!mapRef.current || !LRef.current) return;
    renderMarkers(mapRef.current, LRef.current, jobs, filter);
  }, [jobs, filter]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Callback saat peta siap ─────────────────────────────────────────────────
  const onMapReady = useCallback((map, L) => {
    mapRef.current = map;
    LRef.current   = L;
    if (jobs.length > 0) renderMarkers(map, L, jobs, filter);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Render / re-render markers ──────────────────────────────────────────────
  function renderMarkers(map, L, allJobs, activeFilter) {
    // Bersihkan marker lama
    markersRef.current.forEach((m) => m.remove());
    markersRef.current = [];

    const visible = activeFilter === 'all'
      ? allJobs
      : allJobs.filter((j) => j.status === activeFilter);

    visible.forEach((job) => {
      // Job tanpa koordinat → lewati (ditampilkan di panel bawah)
      const lat = parseFloat(job.latitude);
      const lng = parseFloat(job.longitude);
      if (isNaN(lat) || isNaN(lng)) return;

      const color  = markerColor(job.status);
      const icon   = makePinIcon(L, color);
      const meta   = SUPERVISI_STATUS_META[job.status] || SUPERVISI_STATUS_META.draft;

      const marker = L.marker([lat, lng], { icon });

      // Popup singkat
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
            style="margin-top:10px;padding:5px 12px;background:#0a2540;color:#fff;border:none;border-radius:6px;font-size:11px;font-weight:600;cursor:pointer;width:100%"
          >
            Lihat Detail →
          </button>
        </div>`;

      marker.bindPopup(popupContent, { maxWidth: 260 });
      marker.addTo(map);
      markersRef.current.push(marker);
    });

    // Fit bounds jika ada marker
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
    total:     jobs.length,
    active:    jobs.filter((j) => j.status === 'active').length,
    completed: jobs.filter((j) => j.status === 'completed').length,
    draft:     jobs.filter((j) => j.status === 'draft').length,
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* ── Page Header ── */}
      <div className="bg-[#0a2540] text-white px-6 pt-8 pb-6 shrink-0">
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-white/10 flex items-center justify-center">
              <MapPin size={20} className="text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight">Monitoring Supervisi</h1>
              <p className="text-white/50 text-xs mt-0.5">Peta lokasi titik pekerjaan supervisi</p>
            </div>
          </div>
          <button
            onClick={load}
            disabled={loading}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white text-xs font-semibold transition-colors disabled:opacity-50"
          >
            <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
            Refresh
          </button>
        </div>

        {/* Stat cards */}
        {!loading && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-5">
            {[
              { label: 'Total Job',  value: stats.total,     color: 'from-white/10 to-white/5',          text: 'text-white'       },
              { label: 'Aktif',      value: stats.active,    color: 'from-green-500/30 to-green-600/20', text: 'text-green-200'   },
              { label: 'Selesai',    value: stats.completed, color: 'from-blue-500/30 to-blue-600/20',   text: 'text-blue-200'    },
              { label: 'Draft',      value: stats.draft,     color: 'from-white/5 to-white/0',           text: 'text-white/60'    },
            ].map(({ label, value, color, text }) => (
              <div key={label} className={`bg-gradient-to-br ${color} rounded-xl px-4 py-3 border border-white/10`}>
                <p className={`text-2xl font-bold ${text}`}>{value}</p>
                <p className="text-xs text-white/50 mt-0.5">{label}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Filter Pills ── */}
      <div className="bg-white border-b border-gray-200 px-6 py-3 flex items-center gap-2 shrink-0 overflow-x-auto">
        {FILTERS.map(({ id, label }) => {
          const active = filter === id;
          return (
            <button
              key={id}
              id={`filter-supervisi-${id}`}
              onClick={() => setFilter(id)}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-colors ${
                active
                  ? 'bg-[#0a2540] text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {label}
              {id !== 'all' && !loading && (
                <span className="ml-1.5 opacity-70">
                  ({jobs.filter((j) => (id === 'all' ? true : j.status === id)).length})
                </span>
              )}
            </button>
          );
        })}
        {!loading && (
          <span className="ml-auto text-xs text-gray-400 whitespace-nowrap">
            {withCoords.length} titik di peta
            {noCoords.length > 0 && ` · ${noCoords.length} tanpa koordinat`}
          </span>
        )}
      </div>

      {/* ── Peta ── */}
      <div className="flex-1 relative" style={{ minHeight: '480px' }}>
        {loading ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-gray-400 bg-gray-50">
            <Loader2 size={32} className="animate-spin" />
            <p className="text-sm">Memuat data supervisi...</p>
          </div>
        ) : (
          <div className="absolute inset-0">
            <LeafletMap
              onMapReady={onMapReady}
              className="h-full w-full"
              center={[-6.95, 107.57]}
              zoom={11}
            />
          </div>
        )}
      </div>

      {/* ── Panel job tanpa koordinat ── */}
      {!loading && noCoords.length > 0 && (
        <div className="bg-white border-t border-gray-200 p-6 shrink-0">
          <div className="flex items-center gap-2 mb-3">
            <AlertCircle size={15} className="text-amber-500" />
            <p className="text-sm font-semibold text-gray-700">
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
                  className="text-left bg-gray-50 rounded-xl px-3 py-2.5 border border-gray-200 hover:border-gray-300 hover:bg-gray-100 transition-colors"
                >
                  <div className="flex items-center gap-1.5 mb-1">
                    <span className={`w-1.5 h-1.5 rounded-full ${meta.dot}`} />
                    <span className={`text-[10px] font-bold uppercase tracking-wide ${meta.color.split(' ')[1]}`}>
                      {meta.label}
                    </span>
                  </div>
                  <p className="text-xs font-semibold text-gray-800 truncate">{job.namaKerja || '—'}</p>
                  <p className="text-[11px] text-gray-400">{job.nomorJo}</p>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Side panel detail ── */}
      <SupervisiJobPanel job={selectedJob} onClose={() => setSelectedJob(null)} />
    </div>
  );
}
