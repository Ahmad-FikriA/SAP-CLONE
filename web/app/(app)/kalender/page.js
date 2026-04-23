'use client';

import { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import { CalendarRange, Loader2, RefreshCw } from 'lucide-react';
import { fetchInspeksiSchedules } from '@/lib/inspeksi-service';
import { fetchSupervisiJobs, supervisiJobsToCalendarEvents } from '@/lib/supervisi-service';
import { JadwalKalender } from '@/components/kalender/JadwalKalender';
import { InspeksiDetailModal } from '@/components/inspeksi/InspeksiDetailModal';

// ── Filter options ────────────────────────────────────────────────────────────
const FILTER_OPTIONS = [
  { id: 'all',       label: 'Tampilkan Semua',  emoji: '🗓️'  },
  { id: 'inspeksi',  label: 'Hanya Inspeksi',   emoji: '📋'  },
  { id: 'supervisi', label: 'Hanya Supervisi',  emoji: '👁️'  },
];

export default function KalenderPage() {
  const [inspeksiSchedules, setInspeksiSchedules] = useState([]);
  const [supervisiJobs,     setSupervisiJobs]     = useState([]);
  const [loadingInspeksi,   setLoadingInspeksi]   = useState(true);
  const [loadingSupervisi,  setLoadingSupervisi]  = useState(true);
  const [filter,            setFilter]            = useState('all');
  const [detailOpen,        setDetailOpen]        = useState(false);
  const [detailSchedule,    setDetailSchedule]    = useState(null);

  const loading = loadingInspeksi || loadingSupervisi;

  // ── Fetch paralel ───────────────────────────────────────────────────────────
  const loadInspeksi = useCallback(async () => {
    setLoadingInspeksi(true);
    try {
      const data = await fetchInspeksiSchedules();
      setInspeksiSchedules(Array.isArray(data) ? data : []);
    } catch (e) {
      toast.error('Gagal memuat jadwal inspeksi: ' + e.message);
    } finally {
      setLoadingInspeksi(false);
    }
  }, []);

  const loadSupervisi = useCallback(async () => {
    setLoadingSupervisi(true);
    try {
      const data = await fetchSupervisiJobs();
      setSupervisiJobs(Array.isArray(data) ? data : []);
    } catch (e) {
      toast.error('Gagal memuat jadwal supervisi: ' + e.message);
    } finally {
      setLoadingSupervisi(false);
    }
  }, []);

  useEffect(() => {
    loadInspeksi();
    loadSupervisi();
  }, [loadInspeksi, loadSupervisi]);

  function handleRefresh() {
    loadInspeksi();
    loadSupervisi();
  }

  // ── Detail modal ────────────────────────────────────────────────────────────
  function openDetail(event) {
    // Event dari supervisi: tampilkan info sederhana (tidak pakai InspeksiDetailModal)
    setDetailSchedule(event);
    setDetailOpen(true);
  }

  // ── Statistik gabungan ──────────────────────────────────────────────────────
  const inspeksiAktif   = inspeksiSchedules.filter((s) => ['scheduled', 'in_progress'].includes(s.status)).length;
  const supervisiAktif  = supervisiJobs.filter((j) => j.status === 'active').length;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* ── Page Header ── */}
      <div className="bg-[#0a2540] text-white px-6 pt-8 pb-6">
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-white/10 flex items-center justify-center">
              <CalendarRange size={20} className="text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight">Kalender Jadwal</h1>
              <p className="text-white/50 text-xs mt-0.5">Inspeksi & Supervisi · Jadwal Aktif</p>
            </div>
          </div>
          <button
            onClick={handleRefresh}
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
              { label: 'Inspeksi Aktif',  value: inspeksiAktif,                    color: 'from-blue-500/30 to-blue-600/20',     text: 'text-blue-200'   },
              { label: 'Supervisi Aktif', value: supervisiAktif,                   color: 'from-purple-500/30 to-purple-600/20', text: 'text-purple-200' },
              { label: 'Total Inspeksi',  value: inspeksiSchedules.length,         color: 'from-white/10 to-white/5',            text: 'text-white'      },
              { label: 'Total Supervisi', value: supervisiJobs.length,             color: 'from-white/5 to-white/0',             text: 'text-white/60'   },
            ].map(({ label, value, color, text }) => (
              <div key={label} className={`bg-gradient-to-br ${color} rounded-xl px-4 py-3 border border-white/10`}>
                <p className={`text-2xl font-bold ${text}`}>{value}</p>
                <p className="text-xs text-white/50 mt-0.5">{label}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Filter Toggle ── */}
      <div className="bg-white border-b border-gray-200 px-6 py-3 flex items-center gap-3 flex-wrap">
        <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider mr-1">Filter:</span>
        {FILTER_OPTIONS.map(({ id, label, emoji }) => {
          const active = filter === id;
          return (
            <button
              key={id}
              id={`filter-kalender-${id}`}
              onClick={() => setFilter(id)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors ${
                active
                  ? id === 'all'
                    ? 'bg-[#0a2540] text-white border-[#0a2540]'
                    : id === 'inspeksi'
                      ? 'bg-blue-600 text-white border-blue-600'
                      : 'bg-purple-600 text-white border-purple-600'
                  : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300 hover:bg-gray-50'
              }`}
            >
              <span>{emoji}</span>
              {label}
            </button>
          );
        })}

        {/* Legenda warna */}
        {!loading && (
          <div className="ml-auto hidden sm:flex items-center gap-4 text-[11px] text-gray-500">
            {filter !== 'supervisi' && (
              <>
                <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-blue-500" />Rutin</span>
                <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-orange-500" />K3</span>
              </>
            )}
            {filter !== 'inspeksi' && (
              <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-purple-600" />Supervisi</span>
            )}
          </div>
        )}
      </div>

      {/* ── Kalender ── */}
      <div className="p-6">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-28 text-gray-400 gap-3">
            <Loader2 size={32} className="animate-spin" />
            <p className="text-sm">Memuat jadwal...</p>
            <div className="flex items-center gap-4 mt-2 text-xs">
              {loadingInspeksi  && <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-blue-400 animate-pulse" />Inspeksi</span>}
              {loadingSupervisi && <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-purple-400 animate-pulse" />Supervisi</span>}
            </div>
          </div>
        ) : (
          <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm">
            <div className="flex items-center justify-between mb-5">
              <div>
                <h2 className="text-base font-bold text-gray-800">Kalender Jadwal Aktif</h2>
                <p className="text-xs text-gray-400 mt-0.5">
                  {filter === 'all'
                    ? `${inspeksiAktif} inspeksi · ${supervisiAktif} supervisi aktif`
                    : filter === 'inspeksi'
                      ? `${inspeksiAktif} jadwal inspeksi aktif`
                      : `${supervisiAktif} jadwal supervisi aktif`}
                </p>
              </div>
            </div>

            <JadwalKalender
              inspeksiSchedules={inspeksiSchedules}
              supervisiJobs={supervisiJobs}
              filter={filter}
              onViewDetail={openDetail}
            />
          </div>
        )}
      </div>

      {/* ── Modal detail (untuk inspeksi) ── */}
      <InspeksiDetailModal
        schedule={detailSchedule}
        open={detailOpen && detailSchedule?.source !== 'supervisi'}
        onClose={() => { setDetailOpen(false); setDetailSchedule(null); }}
      />

      {/* Modal sederhana untuk supervisi event dari kalender */}
      {detailOpen && detailSchedule?.source === 'supervisi' && (
        <>
          <div className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm" onClick={() => { setDetailOpen(false); setDetailSchedule(null); }} />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md pointer-events-auto">
              <div className="bg-[#0a2540] text-white px-5 py-4 rounded-t-2xl flex items-center justify-between">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-white/50">Detail Supervisi</p>
                  <h3 className="text-sm font-bold">{detailSchedule.title}</h3>
                  <p className="text-xs text-white/60">{detailSchedule.nomorJo}</p>
                </div>
                <button onClick={() => { setDetailOpen(false); setDetailSchedule(null); }} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-white/10 text-white/70">
                  <span className="text-lg leading-none">×</span>
                </button>
              </div>
              <div className="px-5 py-4 space-y-3 text-sm">
                {[
                  ['Nomor JO',      detailSchedule.nomorJo],
                  ['PIC Supervisi', detailSchedule.assignedTo],
                  ['Lokasi',        detailSchedule.location],
                  ['Mulai',         detailSchedule.scheduledDate],
                  ['Berakhir',      detailSchedule.scheduledEndDate],
                ].map(([label, value]) => value ? (
                  <div key={label} className="flex gap-3">
                    <span className="text-xs font-semibold text-gray-400 w-28 shrink-0">{label}</span>
                    <span className="text-gray-800">{value}</span>
                  </div>
                ) : null)}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
