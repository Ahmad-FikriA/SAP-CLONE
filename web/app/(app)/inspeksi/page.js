'use client';

import { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import { ClipboardList, Loader2 } from 'lucide-react';
import { fetchInspeksiSchedules } from '@/lib/inspeksi-service';
import { InspeksiSpkTable } from '@/components/inspeksi/InspeksiSpkTable';
import { InspeksiDetailModal } from '@/components/inspeksi/InspeksiDetailModal';

export default function InspeksiPage() {
  const [schedules,      setSchedules]      = useState([]);
  const [loading,        setLoading]        = useState(true);
  const [detailOpen,     setDetailOpen]     = useState(false);
  const [detailSchedule, setDetailSchedule] = useState(null);

  // ── Ambil data ──────────────────────────────────────────────────────────────
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchInspeksiSchedules();
      setSchedules(Array.isArray(data) ? data : []);
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

  // Ringkasan statistik
  const stats = {
    total:    schedules.length,
    aktif:    schedules.filter((s) => ['scheduled', 'in_progress'].includes(s.status)).length,
    berjalan: schedules.filter((s) => s.status === 'in_progress').length,
    selesai:  schedules.filter((s) => s.status === 'completed').length,
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* ── Page Header ── */}
      <div className="bg-[#0a2540] text-white px-6 pt-8 pb-6">
        <div className="flex items-center gap-3 mb-1">
          <div className="w-9 h-9 rounded-xl bg-white/10 flex items-center justify-center">
            <ClipboardList size={20} className="text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight">Monitoring Inspeksi</h1>
            <p className="text-white/50 text-xs mt-0.5">Daftar SPK Inspeksi · Rutin · K3</p>
          </div>
        </div>

        {/* ── Stat Cards ── */}
        {!loading && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-5">
            {[
              { label: 'Total SPK',       value: stats.total,    color: 'from-white/10 to-white/5',         text: 'text-white'       },
              { label: 'Aktif',           value: stats.aktif,    color: 'from-green-500/30 to-green-600/20', text: 'text-green-200'  },
              { label: 'Sedang Berjalan', value: stats.berjalan, color: 'from-blue-500/30 to-blue-600/20',   text: 'text-blue-200'   },
              { label: 'Selesai',         value: stats.selesai,  color: 'from-white/5 to-white/0',           text: 'text-white/60'   },
            ].map(({ label, value, color, text }) => (
              <div key={label} className={`bg-gradient-to-br ${color} rounded-xl px-4 py-3 border border-white/10`}>
                <p className={`text-2xl font-bold ${text}`}>{value}</p>
                <p className="text-xs text-white/50 mt-0.5">{label}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Content ── */}
      <div className="p-6">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 text-gray-400 gap-3">
            <Loader2 size={28} className="animate-spin" />
            <p className="text-sm">Memuat data inspeksi...</p>
          </div>
        ) : (
          <InspeksiSpkTable
            schedules={schedules}
            loading={loading}
            onRefresh={load}
            onViewDetail={openDetail}
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
