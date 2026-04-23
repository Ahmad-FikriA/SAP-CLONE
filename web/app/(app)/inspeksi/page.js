'use client';

import { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import { ClipboardList, CalendarDays, ListFilter, Loader2 } from 'lucide-react';
import { fetchInspeksiSchedules } from '@/lib/inspeksi-service';
import { InspeksiSpkTable } from '@/components/inspeksi/InspeksiSpkTable';
import { InspeksiCalendar } from '@/components/inspeksi/InspeksiCalendar';
import { InspeksiDetailModal } from '@/components/inspeksi/InspeksiDetailModal';

const TABS = [
  { id: 'daftar',   label: 'Daftar SPK',      Icon: ListFilter    },
  { id: 'kalender', label: 'Kalender Jadwal',  Icon: CalendarDays  },
];

export default function InspeksiPage() {
  const [activeTab,     setActiveTab]     = useState('daftar');
  const [schedules,     setSchedules]     = useState([]);
  const [loading,       setLoading]       = useState(true);
  const [detailOpen,    setDetailOpen]    = useState(false);
  const [detailSchedule,setDetailSchedule]= useState(null);

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
    total:       schedules.length,
    aktif:       schedules.filter((s) => ['scheduled', 'in_progress'].includes(s.status)).length,
    berjalan:    schedules.filter((s) => s.status === 'in_progress').length,
    selesai:     schedules.filter((s) => s.status === 'completed').length,
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
            <p className="text-white/50 text-xs mt-0.5">SPK Inspeksi · Rutin · K3 · Supervisi</p>
          </div>
        </div>

        {/* ── Stat Cards ── */}
        {!loading && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-5">
            {[
              { label: 'Total SPK',     value: stats.total,    color: 'from-white/10 to-white/5',      text: 'text-white'       },
              { label: 'Aktif',         value: stats.aktif,    color: 'from-green-500/30 to-green-600/20', text: 'text-green-200' },
              { label: 'Sedang Berjalan', value: stats.berjalan, color: 'from-blue-500/30 to-blue-600/20',  text: 'text-blue-200'  },
              { label: 'Selesai',       value: stats.selesai,  color: 'from-white/5 to-white/0',       text: 'text-white/60'    },
            ].map(({ label, value, color, text }) => (
              <div key={label} className={`bg-gradient-to-br ${color} rounded-xl px-4 py-3 border border-white/10`}>
                <p className={`text-2xl font-bold ${text}`}>{value}</p>
                <p className="text-xs text-white/50 mt-0.5">{label}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Tab Navigation ── */}
      <div className="bg-white border-b border-gray-200 px-6">
        <div className="flex gap-1">
          {TABS.map(({ id, label, Icon }) => {
            const active = activeTab === id;
            return (
              <button
                key={id}
                id={`tab-inspeksi-${id}`}
                onClick={() => setActiveTab(id)}
                className={`
                  flex items-center gap-2 px-4 py-3.5 text-sm font-semibold border-b-2 transition-colors
                  ${active
                    ? 'border-[#0a2540] text-[#0a2540]'
                    : 'border-transparent text-gray-400 hover:text-gray-700'}
                `}
              >
                <Icon size={15} />
                {label}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Tab Content ── */}
      <div className="p-6">
        {loading && activeTab === 'daftar' ? (
          <div className="flex flex-col items-center justify-center py-20 text-gray-400 gap-3">
            <Loader2 size={28} className="animate-spin" />
            <p className="text-sm">Memuat data inspeksi...</p>
          </div>
        ) : activeTab === 'daftar' ? (
          <InspeksiSpkTable
            schedules={schedules}
            loading={loading}
            onRefresh={load}
            onViewDetail={openDetail}
          />
        ) : (
          <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm">
            <div className="flex items-center justify-between mb-5">
              <div>
                <h2 className="text-base font-bold text-gray-800">Kalender Jadwal Inspeksi Aktif</h2>
                <p className="text-xs text-gray-400 mt-0.5">
                  Menampilkan {schedules.filter((s) => ['scheduled', 'in_progress'].includes(s.status)).length} jadwal aktif
                </p>
              </div>
              {/* Legenda tipe */}
              <div className="flex items-center gap-4 text-xs text-gray-500">
                <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-blue-500" />Rutin</span>
                <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-orange-500" />K3</span>
                <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-purple-500" />Supervisi</span>
              </div>
            </div>
            {loading ? (
              <div className="flex items-center justify-center py-16 text-gray-400 gap-2">
                <Loader2 size={20} className="animate-spin" />
                <span className="text-sm">Memuat...</span>
              </div>
            ) : (
              <InspeksiCalendar
                schedules={schedules}
                onViewDetail={openDetail}
              />
            )}
          </div>
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
