'use client';

import { useState, useEffect } from 'react';
import { apiGet } from '@/lib/api';
import Link from 'next/link';
import { FileText, ArrowRight, RefreshCw } from 'lucide-react';
import dynamic from 'next/dynamic';

// Recharts must be dynamically imported (uses browser APIs)
const Charts = dynamic(() => import('./_preventive_charts'), { ssr: false, loading: () => (
  <div className="flex items-center justify-center h-48 text-gray-300 text-xs">Memuat grafik...</div>
)});

// ── Colour tokens ──────────────────────────────────────────────────────────
const STATUS_META = {
  pending:     { label: 'Pending',    color: '#FBBF24' },
  in_progress: { label: 'Dalam Pengerjaan',color: '#3B82F6' },
  completed:   { label: 'Selesai',    color: '#10B981' },
  approved:    { label: 'Disetujui', color: '#059669' },
  rejected:    { label: 'Ditolak',    color: '#EF4444' },
};

const CAT_COLORS = {
  Mekanik: '#0070D2', Listrik: '#E67E22', Sipil: '#27AE60', Otomasi: '#8E44AD',
};

export function WidgetPreventive() {
  const [spkList, setSpkList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]   = useState(null);

  async function load() {
    setLoading(true); setError(null);
    try {
      const data = await apiGet('/spk');
      setSpkList(Array.isArray(data) ? data : []);
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  }
  useEffect(() => { load(); }, []);

  // ── derived data ────────────────────────────────────────────────────────
  const total = spkList.length;

  // Status donut data
  const statusData = Object.entries(STATUS_META)
    .map(([key, { label, color }]) => ({
      name: label, value: spkList.filter((s) => s.status === key).length, color,
    }))
    .filter((d) => d.value > 0);

  // Category bar data
  const cats = ['Mekanik', 'Listrik', 'Sipil', 'Otomasi'];
  const catData = cats.map((cat) => ({
    name: cat,
    total: spkList.filter((s) => s.category === cat).length,
    completed: spkList.filter((s) => s.category === cat && (s.status === 'completed' || s.status === 'approved')).length,
    color: CAT_COLORS[cat],
  })).filter((d) => d.total > 0);

  // Weekly trend (last 8 weeks from scheduledDate)
  const weeklyData = buildWeeklyData(spkList);

  // Recent 4
  const recent = [...spkList].reverse().slice(0, 4);

  return (
    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center">
            <FileText size={16} className="text-white" />
          </div>
          <div>
            <p className="text-sm font-semibold text-gray-800">SPK Preventive</p>
            <p className="text-xs text-gray-400">
              {loading ? '—' : `${total} total SPK`}
            </p>
          </div>
        </div>
        <button onClick={load} disabled={loading}
          className="p-1.5 rounded hover:bg-gray-100 text-gray-400 transition-colors">
          <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16 text-gray-400 text-sm">Memuat...</div>
      ) : error ? (
        <div className="flex items-center justify-center py-16 text-red-500 text-sm">{error}</div>
      ) : (
        <div className="flex-1 px-5 py-4 space-y-5">
          {/* Charts row */}
          <Charts
            statusData={statusData}
            catData={catData}
            weeklyData={weeklyData}
            total={total}
          />

          {/* Recent SPK table */}
          {recent.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">
                Terbaru
              </p>
              <div className="space-y-1.5">
                {recent.map((s) => (
                  <div key={s.spkNumber} className="flex items-center gap-2 py-1 border-b border-gray-50 last:border-0">
                    <span className="font-mono text-xs font-semibold text-gray-700 w-28 truncate shrink-0">{s.spkNumber}</span>
                    <span className="text-xs text-gray-500 flex-1 truncate">{s.description}</span>
                    <span className="text-xs shrink-0" style={{ color: STATUS_META[s.status]?.color || '#6B7280' }}>
                      ● {STATUS_META[s.status]?.label || s.status}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Footer */}
      <div className="px-5 py-3 border-t border-gray-100 bg-gray-50">
        <Link href="/spk" className="flex items-center gap-1 text-xs font-medium text-blue-600 hover:text-blue-800 transition-colors">
          Lihat semua SPK <ArrowRight size={12} />
        </Link>
      </div>
    </div>
  );
}

// ── Helper: group SPK by ISO week ──────────────────────────────────────────
function buildWeeklyData(spkList) {
  const weekMap = {};
  spkList.forEach((s) => {
    if (!s.scheduledDate) return;
    const d = new Date(s.scheduledDate + 'T00:00:00');
    if (isNaN(d)) return;
    const label = `W${getWeekNumber(d)}`;
    if (!weekMap[label]) weekMap[label] = { week: label, total: 0, completed: 0 };
    weekMap[label].total++;
    if (s.status === 'completed' || s.status === 'approved') weekMap[label].completed++;
  });
  // Sort by week number and take last 8
  return Object.values(weekMap)
    .sort((a, b) => parseInt(a.week.slice(1)) - parseInt(b.week.slice(1)))
    .slice(-8);
}

function getWeekNumber(d) {
  const jan4 = new Date(d.getFullYear(), 0, 4);
  const diff = Math.floor((d - jan4) / 86400000) + (jan4.getDay() || 7) - 1;
  return Math.max(1, Math.ceil((diff + 1) / 7));
}
