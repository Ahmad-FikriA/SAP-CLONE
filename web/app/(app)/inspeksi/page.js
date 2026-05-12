'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { toast } from 'sonner';
import { ClipboardList, Loader2, CalendarDays, RefreshCw, Activity, CheckCircle2 } from 'lucide-react';
import {
  fetchInspeksiSchedules,
  deleteInspeksiSchedule,
  fetchInspeksiUsersMap,
} from '@/lib/inspeksi-service';
import { canDelete } from '@/lib/auth';
import { InspeksiSpkTable } from '@/components/inspeksi/InspeksiSpkTable';
import { InspeksiDetailModal } from '@/components/inspeksi/InspeksiDetailModal';

const MONTH_NAMES = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
];

const SELECT_CLS =
  'px-3 py-1.5 border border-slate-200 rounded-lg text-sm bg-white text-slate-700 ' +
  'focus:outline-none focus:ring-2 focus:ring-blue-500/30 cursor-pointer';

export default function InspeksiPage() {
  const [schedules,      setSchedules]      = useState([]);
  const [loading,        setLoading]        = useState(true);
  const [detailOpen,     setDetailOpen]     = useState(false);
  const [detailSchedule, setDetailSchedule] = useState(null);
  const [usersMap,       setUsersMap]       = useState({});

  // ── Filter tahun & bulan ────────────────────────────────────────────────────
  const currentYear  = new Date().getFullYear();
  const [yearFilter,  setYearFilter]  = useState(String(currentYear));
  const [monthFilter, setMonthFilter] = useState('');   // '' = semua bulan

  // ── Ambil data ──────────────────────────────────────────────────────────────
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [data, uMap] = await Promise.all([
        fetchInspeksiSchedules(),
        fetchInspeksiUsersMap(),
      ]);
      setSchedules(Array.isArray(data) ? data : []);
      setUsersMap(uMap);
    } catch (e) {
      toast.error('Gagal memuat jadwal inspeksi: ' + e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // ── Derive opsi tahun dari data ─────────────────────────────────────────────
  const yearOptions = useMemo(() => {
    const years = new Set(
      schedules
        .map((s) => s.scheduledDate?.slice(0, 4))
        .filter(Boolean),
    );
    // Pastikan tahun sekarang selalu ada
    years.add(String(currentYear));
    return [...years].sort((a, b) => b - a);
  }, [schedules, currentYear]);

  // ── Filtered schedules (dipakai oleh stat cards & tabel) ───────────────────
  const filteredSchedules = useMemo(() => {
    return schedules.filter((s) => {
      const date = s.scheduledDate || '';
      if (yearFilter  && !date.startsWith(yearFilter))               return false;
      if (monthFilter && date.slice(5, 7) !== monthFilter.padStart(2, '0')) return false;
      return true;
    });
  }, [schedules, yearFilter, monthFilter]);

  // ── Buka detail ─────────────────────────────────────────────────────────────
  function openDetail(schedule) {
    setDetailSchedule(schedule);
    setDetailOpen(true);
  }

  // ── Hapus jadwal ────────────────────────────────────────────────────────────
  async function handleDelete(schedule) {
    if (!canDelete('inspeksi')) {
      toast.error('Anda tidak memiliki akses untuk menghapus jadwal inspeksi.');
      return;
    }

    try {
      await deleteInspeksiSchedule(schedule.id);
      toast.success(`Jadwal "${schedule.title}" berhasil dihapus.`);
      setSchedules((prev) => prev.filter((s) => s.id !== schedule.id));
    } catch (e) {
      toast.error(`Gagal menghapus jadwal (ID: ${schedule?.id}): ` + e.message);
    }
  }

  // ── Statistik dari data ter-filter ──────────────────────────────────────────
  const stats = {
    total:   filteredSchedules.length,
    aktif:   filteredSchedules.filter((s) => ['scheduled', 'in_progress'].includes(s.status)).length,
    selesai: filteredSchedules.filter((s) => s.status === 'completed').length,
  };

  // Label periode untuk sub-header stat cards
  const periodeLabel = [
    monthFilter ? MONTH_NAMES[Number(monthFilter) - 1] : null,
    yearFilter  || null,
  ].filter(Boolean).join(' ');

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto space-y-8">
      {/* ── Page Header ── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <div className="p-1.5 bg-blue-600 rounded-lg">
              <ClipboardList size={16} className="text-white" />
            </div>
            <h2 className="text-2xl font-bold text-slate-800 tracking-tight">
              Monitoring Inspeksi
            </h2>
          </div>
          <p className="text-slate-500 text-sm ml-9">
            Daftar SPK Inspeksi
          </p>
        </div>

        {/* ── Filter Tahun & Bulan ── */}
        {!loading && (
          <div className="flex items-center gap-2 ml-9 md:ml-0">
            <CalendarDays size={15} className="text-slate-400 shrink-0" />
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
              {MONTH_NAMES.map((name, i) => (
                <option key={i + 1} value={String(i + 1)}>{name}</option>
              ))}
            </select>
            <button
              onClick={load}
              disabled={loading}
              className="flex items-center gap-2 px-3 py-1.5 ml-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-semibold transition-colors disabled:opacity-50"
            >
              <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
              Refresh
            </button>
          </div>
        )}
      </div>

      {/* ── Stat Cards ── */}
      {!loading && (
        <div>
          {periodeLabel && (
            <p className="text-xs text-slate-400 mb-3 font-medium">
              Statistik periode <span className="text-slate-600 font-semibold">{periodeLabel}</span>
            </p>
          )}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            {[
              { label: 'Total SPK', value: stats.total,   icon: ClipboardList, color: 'bg-blue-50 text-blue-600' },
              { label: 'Aktif',     value: stats.aktif,   icon: Activity,      color: 'bg-amber-50 text-amber-600' },
              { label: 'Selesai',   value: stats.selesai, icon: CheckCircle2,  color: 'bg-green-50 text-green-600' },
            ].map(({ label, value, icon: Icon, color }) => (
              <div key={label} className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow flex items-center gap-4">
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${color}`}>
                  <Icon size={24} />
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">{label}</p>
                  <p className="text-2xl font-extrabold text-slate-900 truncate">{value}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Content ── */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden p-6">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 text-gray-400 gap-3">
            <Loader2 size={28} className="animate-spin" />
            <p className="text-sm">Memuat data inspeksi...</p>
          </div>
        ) : (
          <InspeksiSpkTable
            schedules={filteredSchedules}
            loading={loading}
            usersMap={usersMap}
            onRefresh={load}
            onViewDetail={openDetail}
            onDelete={handleDelete}
            canDelete={canDelete('inspeksi')}
          />
        )}
      </div>

      {/* ── Modal Detail ── */}
      <InspeksiDetailModal
        schedule={detailSchedule}
        open={detailOpen}
        usersMap={usersMap}
        onClose={() => { setDetailOpen(false); setDetailSchedule(null); }}
      />
    </div>
  );
}
