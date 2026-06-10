'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { toast } from 'sonner';
import { ClipboardList, Loader2, CalendarDays, RefreshCw, Activity, CheckCircle2, Plus, Search, Eye } from 'lucide-react';
import {
  fetchInspeksiSchedules,
  fetchInspeksiScheduleArchive,
  deleteInspeksiSchedule,
  fetchInspeksiUsersMap,
  INSPEKSI_STATUS_META,
  resolveInspeksiTypeLabel,
} from '@/lib/inspeksi-service';
import { canCreate, canDelete } from '@/lib/auth';
import { Button } from '@/components/ui/button';
import { InspeksiSpkTable } from '@/components/inspeksi/InspeksiSpkTable';
import { InspeksiDetailModal } from '@/components/inspeksi/InspeksiDetailModal';
import { InspeksiScheduleFormDialog } from '@/components/inspeksi/InspeksiScheduleFormDialog';

const MONTH_NAMES = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
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

function InspeksiArchiveTable({
  rows,
  meta,
  loading,
  search,
  status,
  type,
  usersMap,
  onSearchChange,
  onStatusChange,
  onTypeChange,
  onPageChange,
  onViewDetail,
}) {
  const renderStatus = (itemStatus) => {
    const statusMeta = INSPEKSI_STATUS_META[itemStatus] || { label: itemStatus || '-' };
    const cls = itemStatus === 'completed'
      ? 'bg-green-50 text-green-700 border-green-200'
      : itemStatus === 'cancelled'
        ? 'bg-red-50 text-red-700 border-red-200'
        : 'bg-slate-50 text-slate-600 border-slate-200';
    return (
      <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold ${cls}`}>
        {statusMeta.label}
      </span>
    );
  };

  return (
    <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
      <div className="p-4 border-b border-slate-100 flex flex-col lg:flex-row gap-3 lg:items-center">
        <div className="relative flex-1 min-w-[220px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Cari SPK, lokasi, judul..."
            className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/30"
          />
        </div>
        <select value={status} onChange={(e) => onStatusChange(e.target.value)} className={SELECT_CLS}>
          <option value="">Semua Status Final</option>
          <option value="completed">Selesai</option>
          <option value="cancelled">Dibatalkan</option>
        </select>
        <select value={type} onChange={(e) => onTypeChange(e.target.value)} className={SELECT_CLS}>
          <option value="">Semua Tipe</option>
          <option value="rutin">Rutin</option>
          <option value="k3">K3</option>
          <option value="supervisi">Supervisi</option>
        </select>
      </div>

      <div className="md:hidden divide-y divide-slate-100">
        {loading ? (
          <div className="flex flex-col items-center gap-2 py-10 text-slate-400">
            <Loader2 size={24} className="animate-spin" />
            <p className="text-sm">Memuat arsip inspeksi...</p>
          </div>
        ) : rows.length === 0 ? (
          <div className="py-10 text-center text-sm text-slate-400">Tidak ada arsip inspeksi</div>
        ) : rows.map((schedule) => (
          <button
            key={schedule.id}
            type="button"
            onClick={() => onViewDetail(schedule)}
            className="w-full text-left p-4 hover:bg-blue-50/40 transition-colors"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="font-semibold text-slate-800 truncate">{schedule.title || '-'}</p>
                <p className="font-mono text-[11px] text-slate-400 mt-1">{schedule.nomorPoJo || '-'}</p>
              </div>
              {renderStatus(schedule.status)}
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-slate-500">
              <span>{resolveInspeksiTypeLabel(schedule)}</span>
              <span className="text-right">{String(schedule.scheduledDate || '').slice(0, 10) || '-'}</span>
              <span className="col-span-2 truncate">{schedule.location || '-'}</span>
            </div>
          </button>
        ))}
      </div>

      <div className="hidden md:block bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-600 min-w-[1100px]">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                {['SPK', 'Pekerjaan', 'Tipe', 'Lokasi', 'Tanggal', 'PIC', 'Status', 'Aksi'].map((head) => (
                  <th key={head} className="px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-slate-500 whitespace-nowrap">{head}</th>
                ))}
              </tr>
            </thead>
          <tbody className="divide-y divide-slate-100">
            {loading ? (
              <tr>
                <td colSpan="8" className="px-6 py-10 text-center text-slate-400">
                  <Loader2 size={24} className="animate-spin mx-auto mb-2" />
                  Memuat arsip inspeksi...
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan="8" className="px-6 py-10 text-center text-slate-400">Tidak ada arsip inspeksi</td>
              </tr>
            ) : rows.map((schedule) => (
              <tr key={schedule.id} className="hover:bg-blue-50/40 transition-colors">
                <td className="px-4 py-3 font-mono text-xs font-semibold text-slate-500 whitespace-nowrap">{schedule.nomorPoJo || '-'}</td>
                <td className="px-4 py-3 max-w-[260px]">
                  <p className="font-semibold text-slate-800 truncate">{schedule.title || '-'}</p>
                </td>
                <td className="px-4 py-3 whitespace-nowrap">{resolveInspeksiTypeLabel(schedule)}</td>
                <td className="px-4 py-3 max-w-[220px] truncate">{schedule.location || '-'}</td>
                <td className="px-4 py-3 whitespace-nowrap">{String(schedule.scheduledDate || '').slice(0, 10) || '-'}</td>
                <td className="px-4 py-3 max-w-[160px] truncate">{usersMap[String(schedule.assignedTo)] || schedule.assignedTo || '-'}</td>
                <td className="px-4 py-3 whitespace-nowrap">{renderStatus(schedule.status)}</td>
                <td className="px-4 py-3 whitespace-nowrap">
                  <Button type="button" variant="outline" size="sm" className="h-8 gap-1.5" onClick={() => onViewDetail(schedule)}>
                    <Eye size={12} /> Detail
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
      </div>
      <ArchivePagination meta={meta} loading={loading} onPageChange={onPageChange} />
    </div>
  );
}

export default function InspeksiPage() {
  const [schedules,      setSchedules]      = useState([]);
  const [loading,        setLoading]        = useState(true);
  const [detailOpen,     setDetailOpen]     = useState(false);
  const [detailSchedule, setDetailSchedule] = useState(null);
  const [createOpen,     setCreateOpen]     = useState(false);
  const [usersMap,       setUsersMap]       = useState({});
  const [viewMode,       setViewMode]       = useState('monitoring');
  const [archiveRows,    setArchiveRows]    = useState([]);
  const [archiveLoading, setArchiveLoading] = useState(false);
  const [archiveMeta,    setArchiveMeta]    = useState({
    page: 1,
    limit: ARCHIVE_PAGE_SIZE,
    total: 0,
    totalPages: 1,
  });
  const [archivePage,    setArchivePage]    = useState(1);
  const [archiveSearchInput, setArchiveSearchInput] = useState('');
  const [archiveSearch,  setArchiveSearch]  = useState('');
  const [archiveStatus,  setArchiveStatus]  = useState('');
  const [archiveType,    setArchiveType]    = useState('');

  // ── Filter tahun & bulan ────────────────────────────────────────────────────
  const currentYear  = new Date().getFullYear();
  const [yearFilter,  setYearFilter]  = useState(String(currentYear));
  const [monthFilter, setMonthFilter] = useState('');   // '' = semua bulan

  // ── Ambil data ──────────────────────────────────────────────────────────────
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const range = buildArchiveDateRange(yearFilter, monthFilter);
      const [data, uMap] = await Promise.all([
        fetchInspeksiSchedules(range),
        fetchInspeksiUsersMap(),
      ]);
      setSchedules(Array.isArray(data) ? data : []);
      setUsersMap(uMap);
    } catch (e) {
      toast.error('Gagal memuat jadwal inspeksi: ' + e.message);
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
      const result = await fetchInspeksiScheduleArchive({
        page: archivePage,
        limit: ARCHIVE_PAGE_SIZE,
        q: archiveSearch.trim(),
        status: archiveStatus,
        type: archiveType,
        ...range,
      });
      setArchiveRows(Array.isArray(result.items) ? result.items : []);
      setArchiveMeta(result.meta);
    } catch (e) {
      toast.error('Gagal memuat arsip inspeksi: ' + e.message);
    } finally {
      setArchiveLoading(false);
    }
  }, [archivePage, archiveSearch, archiveStatus, archiveType, yearFilter, monthFilter]);

  useEffect(() => {
    setArchivePage(1);
  }, [archiveSearch, archiveStatus, archiveType, yearFilter, monthFilter]);

  useEffect(() => {
    if (viewMode !== 'archive') return;
    loadArchive();
  }, [viewMode, loadArchive]);

  // ── Derive opsi tahun dari data ─────────────────────────────────────────────
  const yearOptions = useMemo(() => {
    const years = new Set(
      schedules
        .map((s) => s.scheduledDate?.slice(0, 4))
        .filter(Boolean),
    );
    for (let year = currentYear; year >= currentYear - 10; year -= 1) {
      years.add(String(year));
    }
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
    <div className="p-4 sm:p-6 md:p-8 max-w-7xl mx-auto space-y-8">
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
          <div className="flex items-center gap-2 ml-9 md:ml-0 flex-wrap justify-start md:justify-end">
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
            {viewMode === 'monitoring' && canCreate('inspeksi') && (
              <Button
                type="button"
                onClick={() => setCreateOpen(true)}
                className="bg-[#0a2540] text-white hover:bg-[#0d3152]"
              >
                <Plus size={14} />
                Buat Jadwal Pekerjaan
              </Button>
            )}
            <button
              onClick={viewMode === 'archive' ? loadArchive : load}
              disabled={viewMode === 'archive' ? archiveLoading : loading}
              className="flex items-center gap-2 px-3 py-1.5 ml-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-semibold transition-colors disabled:opacity-50"
            >
              <RefreshCw size={14} className={(viewMode === 'archive' ? archiveLoading : loading) ? 'animate-spin' : ''} />
              Refresh
            </button>
          </div>
        )}
      </div>

      {/* ── Stat Cards ── */}
      {!loading && viewMode === 'monitoring' && (
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
      {viewMode === 'monitoring' ? (
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
      ) : (
        <InspeksiArchiveTable
          rows={archiveRows}
          meta={archiveMeta}
          loading={archiveLoading}
          search={archiveSearchInput}
          status={archiveStatus}
          type={archiveType}
          usersMap={usersMap}
          onSearchChange={setArchiveSearchInput}
          onStatusChange={setArchiveStatus}
          onTypeChange={setArchiveType}
          onPageChange={setArchivePage}
          onViewDetail={openDetail}
        />
      )}

      {/* ── Modal Detail ── */}
      <InspeksiDetailModal
        schedule={detailSchedule}
        open={detailOpen}
        usersMap={usersMap}
        onChanged={() => {
          load();
          if (viewMode === 'archive') loadArchive();
        }}
        onClose={() => { setDetailOpen(false); setDetailSchedule(null); }}
      />

      <InspeksiScheduleFormDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onSaved={load}
      />
    </div>
  );
}
