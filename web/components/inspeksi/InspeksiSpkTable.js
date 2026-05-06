'use client';

import { useState, useRef } from 'react';
import { Search, X, Eye, RefreshCw, AlertCircle, CheckCircle, Clock, XCircle, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { INSPEKSI_STATUS_META, resolveInspeksiTypeLabel } from '@/lib/inspeksi-service';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';

// ── Badge tipe ────────────────────────────────────────────────────────────────
const TYPE_CHIP = {
  rutin:     'bg-blue-100 text-blue-700',
  inspeksi:  'bg-green-100 text-green-700',   // berdasarkan laporan/request
};

// ── Badge status ──────────────────────────────────────────────────────────────
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

export function InspeksiSpkTable({
  schedules = [],
  loading = false,
  usersMap = {},
  onRefresh,
  onViewDetail,
  onDelete,
}) {
  const [search,         setSearch]         = useState('');
  const [statusFilter,   setStatusFilter]   = useState('');
  const [typeFilter,     setTypeFilter]     = useState('');
  const [executorFilter, setExecutorFilter] = useState('');
  const [deleteCandidate,  setDeleteCandidate]  = useState(null);

  // ── Helper: resolve nama eksekutor ─────────────────────────────────────────
  function resolveExecutorName(nik) {
    if (!nik) return null;
    return usersMap[String(nik)] || nik;
  }

  // Opsi filter executor (nama jika ada di map, else nik)
  const executorOptions = uniq(schedules.map((s) => resolveExecutorName(s.assignedTo)));

  const displayed = schedules.filter((s) => {
    // Filter status
    if (statusFilter === 'aktif'   && !ACTIVE_STATUSES.has(s.status))  return false;
    if (statusFilter === 'selesai' && ACTIVE_STATUSES.has(s.status))    return false;
    if (statusFilter && statusFilter !== 'aktif' && statusFilter !== 'selesai' && s.status !== statusFilter) return false;

    // Filter tipe
    if (typeFilter) {
      const resolvedType = s.userRequest || s.triggerSource === 'user_darurat' ? 'inspeksi' : s.type;
      if (resolvedType !== typeFilter) return false;
    }

    // Filter executor (by nama)
    if (executorFilter) {
      const nama = resolveExecutorName(s.assignedTo);
      if (nama !== executorFilter) return false;
    }

    // Pencarian teks
    if (search) {
      const q = search.toLowerCase();
      const nama = resolveExecutorName(s.assignedTo) || '';
      return (
        s.title?.toLowerCase().includes(q) ||
        s.nomorPoJo?.toLowerCase().includes(q) ||
        s.location?.toLowerCase().includes(q) ||
        nama.toLowerCase().includes(q) ||
        String(s.id).includes(q)
      );
    }
    return true;
  });

  function clearFilters() {
    setSearch(''); setStatusFilter(''); setTypeFilter(''); setExecutorFilter('');
  }
  const hasFilter = search || statusFilter || typeFilter || executorFilter;

  function handleDeleteClick(e, s) {
    e.stopPropagation();
    setDeleteCandidate(s);
  }

  function confirmDelete() {
    if (deleteCandidate) {
      onDelete?.(deleteCandidate);
      setDeleteCandidate(null);
    }
  }

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
          <option value="aktif">Aktif</option>
          <option value="scheduled">Terjadwal</option>
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
          <option value="inspeksi">Inspeksi (dari laporan)</option>
        </select>

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
              {['No SPK', 'Judul / Objek', 'Tipe', 'Lokasi', 'Tanggal Mulai', 'Status', 'Aksi'].map((h) => (
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
                <td colSpan={7} className="px-4 py-10 text-center">
                  <div className="flex flex-col items-center gap-2 text-gray-400">
                    <RefreshCw size={20} className="animate-spin" />
                    <p className="text-sm">Memuat data...</p>
                  </div>
                </td>
              </tr>
            ) : displayed.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-10 text-center">
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
              const typeLabel = resolveInspeksiTypeLabel(s);
              const typeKey   = typeLabel.toLowerCase() === 'inspeksi' ? 'inspeksi' : s.type;

              return (
                <tr
                  key={s.id}
                  className="hover:bg-blue-50/40 transition-colors cursor-pointer group"
                  onClick={() => onViewDetail(s)}
                >
                  {/* No SPK */}
                  <td className="px-4 py-3 font-mono text-xs font-bold text-gray-500 whitespace-nowrap">
                    {s.nomorPoJo || <span className="text-gray-300">#{s.id}</span>}
                  </td>

                  {/* Judul */}
                  <td className="px-4 py-3 max-w-[220px]">
                    <p className="font-semibold text-gray-800 truncate">{s.title}</p>
                  </td>

                  {/* Tipe */}
                  <td className="px-4 py-3">
                    <span className={`inline-flex px-2 py-0.5 rounded-full text-[11px] font-bold ${TYPE_CHIP[typeKey] || 'bg-gray-100 text-gray-600'}`}>
                      {typeLabel}
                    </span>
                  </td>

                  {/* Lokasi */}
                  <td className="px-4 py-3 text-sm text-gray-500 max-w-[160px] truncate">
                    {s.location || <span className="text-gray-300">—</span>}
                  </td>

                  {/* Tanggal Mulai */}
                  <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">
                    {s.scheduledDate
                      ? new Date(s.scheduledDate + 'T00:00:00').toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })
                      : '—'}
                  </td>

                  {/* Status */}
                  <td className="px-4 py-3">
                    <StatusBadge status={s.status} />
                  </td>

                  {/* Aksi */}
                  <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                    <div className="flex items-center gap-1.5">
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-7 text-xs gap-1.5 opacity-80 group-hover:opacity-100"
                        onClick={(e) => { e.stopPropagation(); onViewDetail(s); }}
                      >
                        <Eye size={11} /> Detail
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-7 text-xs gap-1 text-red-600 border-red-200 hover:bg-red-50 hover:border-red-300 opacity-70 group-hover:opacity-100"
                        onClick={(e) => handleDeleteClick(e, s)}
                      >
                        <Trash2 size={11} /> Hapus
                      </Button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <Dialog open={!!deleteCandidate} onOpenChange={(open) => !open && setDeleteCandidate(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Hapus Jadwal Inspeksi</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-gray-600 mt-2">
            Apakah Anda yakin ingin menghapus jadwal <b>{deleteCandidate?.title}</b>? Data yang telah dihapus tidak dapat dikembalikan.
          </p>
          <DialogFooter className="mt-6">
            <Button variant="outline" onClick={() => setDeleteCandidate(null)}>
              Batal
            </Button>
            <Button variant="destructive" onClick={confirmDelete}>
              Ya, Hapus
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
