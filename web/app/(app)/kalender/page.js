'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { toast } from 'sonner';
import {
  Activity,
  CalendarDays,
  CalendarRange,
  CheckCircle2,
  ClipboardList,
  Loader2,
  MapPin,
  RefreshCw,
  X,
} from 'lucide-react';
import { fetchInspeksiSchedules } from '@/lib/inspeksi-service';
import { fetchSupervisiJobs } from '@/lib/supervisi-service';
import { JadwalKalender } from '@/components/kalender/JadwalKalender';
import { InspeksiDetailModal } from '@/components/inspeksi/InspeksiDetailModal';

const FILTER_OPTIONS = [
  { id: 'all', label: 'Semua', icon: CalendarRange },
  { id: 'inspeksi', label: 'Inspeksi', icon: ClipboardList },
  { id: 'supervisi', label: 'Supervisi', icon: MapPin },
];

const ACTIVE_INSPEKSI = new Set(['scheduled', 'in_progress']);

function formatDate(value) {
  if (!value) return '-';
  return new Date(value).toLocaleDateString('id-ID', {
    timeZone: 'Asia/Jakarta',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function firstSupervisiLocation(job) {
  if (Array.isArray(job?.locations) && job.locations.length > 0) {
    return job.locations[0]?.namaArea || job.namaArea || '-';
  }
  return job?.namaArea || '-';
}

export default function KalenderPage() {
  const [inspeksiSchedules, setInspeksiSchedules] = useState([]);
  const [supervisiJobs, setSupervisiJobs] = useState([]);
  const [loadingInspeksi, setLoadingInspeksi] = useState(true);
  const [loadingSupervisi, setLoadingSupervisi] = useState(true);
  const [filter, setFilter] = useState('all');
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailSchedule, setDetailSchedule] = useState(null);

  const loading = loadingInspeksi || loadingSupervisi;

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

  function openDetail(event) {
    setDetailSchedule(event);
    setDetailOpen(true);
  }

  const stats = useMemo(() => {
    const inspeksiAktif = inspeksiSchedules.filter((s) => ACTIVE_INSPEKSI.has(s.status)).length;
    const supervisiAktif = supervisiJobs.filter((j) => j.status === 'active').length;
    const supervisiSelesai = supervisiJobs.filter((j) => j.status === 'completed').length;

    return {
      inspeksiAktif,
      supervisiAktif,
      supervisiSelesai,
      totalAktif: inspeksiAktif + supervisiAktif,
      totalData: inspeksiSchedules.length + supervisiJobs.length,
    };
  }, [inspeksiSchedules, supervisiJobs]);

  const visibleSummary = filter === 'all'
    ? `${stats.inspeksiAktif} inspeksi aktif dan ${stats.supervisiAktif} supervisi aktif`
    : filter === 'inspeksi'
      ? `${stats.inspeksiAktif} jadwal inspeksi aktif`
      : `${stats.supervisiAktif} jadwal supervisi aktif`;

  return (
    <div className="min-h-screen bg-slate-50 p-4 sm:p-6 space-y-6">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-lg bg-[#0a2540] flex items-center justify-center shrink-0">
            <CalendarRange size={20} className="text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">Kalender Jadwal</h1>
            <p className="text-sm text-slate-500 mt-0.5">
              Monitoring jadwal aktif Inspeksi dan Supervisi.
            </p>
          </div>
        </div>

        <button
          onClick={handleRefresh}
          disabled={loading}
          className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-white border border-slate-200 text-sm font-semibold text-slate-700 hover:bg-slate-100 transition-colors disabled:opacity-50"
        >
          <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
          Refresh
        </button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <MetricCard icon={Activity} label="Total Aktif" value={stats.totalAktif} tone="slate" />
        <MetricCard icon={ClipboardList} label="Inspeksi Aktif" value={stats.inspeksiAktif} tone="blue" />
        <MetricCard icon={MapPin} label="Supervisi Aktif" value={stats.supervisiAktif} tone="emerald" />
        <MetricCard icon={CheckCircle2} label="Supervisi Selesai" value={stats.supervisiSelesai} tone="cyan" />
      </div>

      <div className="bg-white border border-slate-200 rounded-lg shadow-sm">
        <div className="px-5 py-4 border-b border-slate-100 flex flex-col xl:flex-row xl:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <CalendarDays size={17} className="text-slate-500" />
              <h2 className="text-base font-bold text-slate-900">Jadwal Aktif</h2>
            </div>
            <p className="text-xs text-slate-500 mt-1">{visibleSummary}</p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {FILTER_OPTIONS.map(({ id, label, icon: Icon }) => {
              const active = filter === id;
              return (
                <button
                  key={id}
                  id={`filter-kalender-${id}`}
                  onClick={() => setFilter(id)}
                  className={`inline-flex items-center gap-2 px-3 py-2 rounded-lg border text-xs font-bold transition-colors ${
                    active
                      ? id === 'supervisi'
                        ? 'bg-emerald-600 text-white border-emerald-600'
                        : id === 'inspeksi'
                          ? 'bg-blue-600 text-white border-blue-600'
                          : 'bg-[#0a2540] text-white border-[#0a2540]'
                      : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  <Icon size={14} />
                  {label}
                </button>
              );
            })}
          </div>
        </div>

        <div className="px-5 py-3 border-b border-slate-100 flex items-center gap-4 text-xs text-slate-500">
          <span className="inline-flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-blue-500" />
            Inspeksi
          </span>
          <span className="inline-flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
            Supervisi
          </span>
          <span className="ml-auto hidden sm:inline text-slate-400">{stats.totalData} total data terhubung</span>
        </div>

        <div className="p-5">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-28 text-slate-400 gap-3">
              <Loader2 size={32} className="animate-spin" />
              <p className="text-sm">Memuat jadwal...</p>
              <div className="flex items-center gap-4 mt-2 text-xs">
                {loadingInspeksi && (
                  <span className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-blue-400 animate-pulse" />
                    Inspeksi
                  </span>
                )}
                {loadingSupervisi && (
                  <span className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                    Supervisi
                  </span>
                )}
              </div>
            </div>
          ) : (
            <JadwalKalender
              inspeksiSchedules={inspeksiSchedules}
              supervisiJobs={supervisiJobs}
              filter={filter}
              onViewDetail={openDetail}
            />
          )}
        </div>
      </div>

      <InspeksiDetailModal
        schedule={detailSchedule}
        open={detailOpen && detailSchedule?.source !== 'supervisi'}
        onClose={() => { setDetailOpen(false); setDetailSchedule(null); }}
      />

      {detailOpen && detailSchedule?.source === 'supervisi' && (
        <SupervisiCalendarDetail
          event={detailSchedule}
          onClose={() => { setDetailOpen(false); setDetailSchedule(null); }}
        />
      )}
    </div>
  );
}

function MetricCard({ icon: Icon, label, value, tone }) {
  const tones = {
    slate: 'bg-slate-900 text-white border-slate-900',
    blue: 'bg-blue-50 text-blue-700 border-blue-100',
    emerald: 'bg-emerald-50 text-emerald-700 border-emerald-100',
    cyan: 'bg-cyan-50 text-cyan-700 border-cyan-100',
  };

  return (
    <div className={`rounded-lg border px-4 py-4 ${tones[tone] || tones.slate}`}>
      <div className="flex items-center gap-2 mb-2">
        <Icon size={15} />
        <p className="text-[10px] font-bold uppercase tracking-wide">{label}</p>
      </div>
      <p className="text-3xl font-extrabold leading-none">{value}</p>
    </div>
  );
}

function SupervisiCalendarDetail({ event, onClose }) {
  const raw = event?._raw || {};

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
        <div className="bg-white rounded-lg shadow-2xl w-full max-w-md pointer-events-auto overflow-hidden">
          <div className="bg-[#0a2540] text-white px-5 py-4 flex items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="text-[10px] font-bold uppercase tracking-widest text-white/50">Detail Supervisi</p>
              <h3 className="text-sm font-bold truncate mt-1">{event.title}</h3>
              <p className="text-xs text-white/60 mt-0.5">{event.nomorJo || '-'}</p>
            </div>
            <button
              onClick={onClose}
              className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-white/10 text-white/70 shrink-0"
              aria-label="Tutup detail"
            >
              <X size={16} />
            </button>
          </div>
          <div className="px-5 py-4 space-y-3 text-sm">
            <DetailRow label="Nomor JO" value={event.nomorJo} />
            <DetailRow label="PIC Supervisi" value={event.assignedTo} />
            <DetailRow label="Lokasi" value={firstSupervisiLocation(raw)} />
            <DetailRow label="Mulai" value={formatDate(event.scheduledDate)} />
            <DetailRow label="Berakhir" value={formatDate(event.scheduledEndDate)} />
          </div>
        </div>
      </div>
    </>
  );
}

function DetailRow({ label, value }) {
  if (!value) return null;
  return (
    <div className="flex gap-3">
      <span className="text-xs font-semibold text-slate-400 w-28 shrink-0">{label}</span>
      <span className="text-slate-800">{value}</span>
    </div>
  );
}
