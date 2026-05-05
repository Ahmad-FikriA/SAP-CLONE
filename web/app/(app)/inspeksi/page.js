'use client';

import { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import { ClipboardList, Loader2 } from 'lucide-react';
import {
  fetchInspeksiSchedules,
  deleteInspeksiSchedule,
  fetchInspeksiUsersMap,
} from '@/lib/inspeksi-service';
import { InspeksiSpkTable } from '@/components/inspeksi/InspeksiSpkTable';
import { InspeksiDetailModal } from '@/components/inspeksi/InspeksiDetailModal';

export default function InspeksiPage() {
  const [schedules,      setSchedules]      = useState([]);
  const [loading,        setLoading]        = useState(true);
  const [detailOpen,     setDetailOpen]     = useState(false);
  const [detailSchedule, setDetailSchedule] = useState(null);
  const [usersMap,       setUsersMap]       = useState({});

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

  // ── Buka detail ─────────────────────────────────────────────────────────────
  function openDetail(schedule) {
    setDetailSchedule(schedule);
    setDetailOpen(true);
  }

  // ── Hapus jadwal ────────────────────────────────────────────────────────────
  async function handleDelete(schedule) {
    try {
      await deleteInspeksiSchedule(schedule.id);
      toast.success(`Jadwal "${schedule.title}" berhasil dihapus.`);
      setSchedules((prev) => prev.filter((s) => s.id !== schedule.id));
    } catch (e) {
      toast.error(`Gagal menghapus jadwal (ID: ${schedule?.id}): ` + e.message);
    }
  }

  // Ringkasan statistik
  const stats = {
    total:    schedules.length,
    aktif:    schedules.filter((s) => ['scheduled', 'in_progress'].includes(s.status)).length,
    berjalan: schedules.filter((s) => s.status === 'in_progress').length,
    selesai:  schedules.filter((s) => s.status === 'completed').length,
  };

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
      </div>

      {/* ── Stat Cards ── */}
      {!loading && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            { label: 'Total SPK',       value: stats.total,    icon: ClipboardList, color: 'bg-blue-50 text-blue-600' },
            { label: 'Aktif',           value: stats.aktif,    icon: ClipboardList, color: 'bg-amber-50 text-amber-600' },
            { label: 'Sedang Berjalan', value: stats.berjalan, icon: ClipboardList, color: 'bg-emerald-50 text-emerald-600' },
            { label: 'Selesai',         value: stats.selesai,  icon: ClipboardList, color: 'bg-gray-50 text-gray-600' },
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
            schedules={schedules}
            loading={loading}
            usersMap={usersMap}
            onRefresh={load}
            onViewDetail={openDetail}
            onDelete={handleDelete}
          />
        )}
      </div>

      {/* ── Modal Detail ── */}
      <InspeksiDetailModal
        schedule={detailSchedule}
        open={detailOpen}
        onClose={() => { setDetailOpen(false); setDetailSchedule(null); }}
      />
    </div>
  );
}
