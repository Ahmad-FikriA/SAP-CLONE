'use client';

import { useState } from 'react';
import { Search, X, Eye, RefreshCw, AlertCircle, CheckCircle, Clock, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { INSPEKSI_STATUS_META, INSPEKSI_TYPE_LABELS } from '@/lib/inspeksi-service';

const TYPE_CHIP = {
  rutin:     'bg-blue-100 text-blue-700',
  k3:        'bg-orange-100 text-orange-700',
  supervisi: 'bg-purple-100 text-purple-700',
};

const STATUS_ICON = {
  scheduled:   { Icon: Clock,       cls: 'bg-amber-50 text-amber-700 border border-amber-200'  },
  in_progress: { Icon: AlertCircle, cls: 'bg-blue-50 text-blue-700 border border-blue-200'    },
  completed:   { Icon: CheckCircle, cls: 'bg-green-50 text-green-700 border border-green-200' },
  cancelled:   { Icon: XCircle,     cls: 'bg-gray-100 text-gray-500 border border-gray-200'   },
};

function StatusBadge({ status }) {
  const meta   = INSPEKSI_STATUS_META[status] || { label: status };
  const config = STATUS_ICON[status] || STATUS_ICON.scheduled;
  const { Icon } = config;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold ${config.cls}`}>
      <Icon size={10} />
      {meta.label}
    </span>
  );
}

const ACTIVE_STATUSES  = new Set(['scheduled', 'in_progress']);

/** Kumpulkan nilai unik dari array string */
function uniq(arr) {
  return [...new Set(arr.filter(Boolean))].sort();
}

export function InspeksiSpkTable({ schedules = [], loading = false, onRefresh, onViewDetail }) {
  const [search,       setSearch]       = useState('');
  const [statusFilter, setStatusFilter] = useState('');   // 'aktif' | 'selesai' | '' | status spesifik
  const [typeFilter,   setTypeFilter]   = useState('');
  const [executorFilter, setExecutorFilter] = useState('');

  // Opsi filter executor
  const executorOptions = uniq(schedules.map((s) => s.assignedTo));

  const displayed = schedules.filter((s) => {
    // Filter status
    if (statusFilter === 'aktif'   && !ACTIVE_STATUSES.has(s.status))  return false;
    if (statusFilter === 'selesai' && ACTIVE_STATUSES.has(s.status))    return false;
    if (statusFilter && statusFilter !== 'aktif' && statusFilter !== 'selesai' && s.status !== statusFilter) return false;

    // Filter tipe
    if (typeFilter && s.type !== typeFilter) return false;

    // Filter executor
    if (executorFilter && s.assignedTo !== executorFilter) return false;

    // Pencarian teks
    if (search) {
      const q = search.toLowerCase();
      return (
        s.title?.toLowerCase().includes(q) ||
        s.nomorPoJo?.toLowerCase().includes(q) ||
        s.location?.toLowerCase().includes(q) ||
        s.assignedTo?.toLowerCase().includes(q) ||
        String(s.id).includes(q)
      );
    }
    return true;
  });

  function clearFilters() {
    setSearch(''); setStatusFilter(''); setTypeFilter(''); setExecutorFilter('');
  }
  const hasFilter = search || statusFilter || typeFilter || executorFilter;

  return (
    <div className="space-y-4">
      {/* ── Toolbar ── */}
      <div className="flex items-center gap-3 flex-wrap">
        {/* Search */}
        <div className="relative flex-1 min-w-[220px] max-w-sm">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Cari judul, nomor, lokasi, eksekutor..."
            className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/30"
          />
        </div>

        {/* Filter Status */}
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
        >
          <option value="">Semua Status</option>
          <option value="aktif">🟢 Aktif (Terjadwal + Berjalan)</option>
          <option value="selesai">⚫ Selesai / Non-Aktif</option>
          <option value="scheduled">Terjadwal</option>
          <option value="in_progress">Sedang Berjalan</option>
          <option value="completed">Selesai</option>
          <option value="cancelled">Dibatalkan</option>
        </select>

        {/* Filter Tipe */}
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          className="px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
        >
          <option value="">Semua Tipe</option>
          <option value="rutin">Rutin</option>
          <option value="k3">K3</option>
          <option value="supervisi">Supervisi</option>
        </select>

        {/* Filter Eksekutor */}
        {executorOptions.length > 0 && (
          <select
            value={executorFilter}
            onChange={(e) => setExecutorFilter(e.target.value)}
            className="px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
          >
            <option value="">Semua Eksekutor</option>
            {executorOptions.map((ex) => (
              <option key={ex} value={ex}>{ex}</option>
            ))}
          </select>
        )}

        {hasFilter && (
          <button
            onClick={clearFilters}
            className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-800 px-2.5 py-2 rounded-lg border border-gray-200 bg-white hover:bg-gray-50 transition-colors"
          >
            <X size={12} /> Reset
          </button>
        )}

        <Button
          variant="outline"
          size="sm"
          onClick={onRefresh}
          className="ml-auto"
          disabled={loading}
        >
          <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
        </Button>
      </div>

      {/* ── Jumlah hasil ── */}
      <p className="text-xs text-gray-400">
        Menampilkan <span className="font-semibold text-gray-600">{displayed.length}</span> dari {schedules.length} SPK Inspeksi
      </p>

      {/* ── Tabel ── */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              {['ID', 'Judul / Objek', 'Tipe', 'Eksekutor', 'Lokasi', 'Tanggal Mulai', 'Status', 'Aksi'].map((h) => (
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
                <td colSpan={8} className="px-4 py-10 text-center">
                  <div className="flex flex-col items-center gap-2 text-gray-400">
                    <RefreshCw size={20} className="animate-spin" />
                    <p className="text-sm">Memuat data...</p>
                  </div>
                </td>
              </tr>
            ) : displayed.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-4 py-10 text-center">
                  <div className="flex flex-col items-center gap-2 text-gray-400">
                    <Search size={24} className="opacity-40" />
                    <p className="text-sm">Tidak ada data yang cocok</p>
                    {hasFilter && (
                      <button onClick={clearFilters} className="text-xs text-blue-500 hover:underline mt-1">
                        Hapus semua filter
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ) : displayed.map((s) => {
              const isAktif = ACTIVE_STATUSES.has(s.status);
              return (
                <tr
                  key={s.id}
                  className="hover:bg-blue-50/40 transition-colors cursor-pointer group"
                  onClick={() => onViewDetail(s)}
                >
                  <td className="px-4 py-3 font-mono text-xs font-bold text-gray-500">
                    #{s.id}
                  </td>
                  <td className="px-4 py-3 max-w-[220px]">
                    <p className="font-semibold text-gray-800 truncate">{s.title}</p>
                    {s.nomorPoJo && (
                      <p className="text-[10px] font-mono text-gray-400 mt-0.5">{s.nomorPoJo}</p>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex px-2 py-0.5 rounded-full text-[11px] font-bold ${TYPE_CHIP[s.type] || 'bg-gray-100 text-gray-600'}`}>
                      {INSPEKSI_TYPE_LABELS[s.type] || s.type}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600">
                    {s.assignedTo || <span className="text-gray-300">—</span>}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-500 max-w-[160px] truncate">
                    {s.location || <span className="text-gray-300">—</span>}
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">
                    {s.scheduledDate
                      ? new Date(s.scheduledDate + 'T00:00:00').toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })
                      : '—'}
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={s.status} />
                  </td>
                  <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 text-xs gap-1.5 opacity-80 group-hover:opacity-100"
                      onClick={() => onViewDetail(s)}
                    >
                      <Eye size={11} /> Detail
                    </Button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
