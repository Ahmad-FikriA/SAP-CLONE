'use client';

import { useState, useEffect } from 'react';
import { apiGet } from '@/lib/api';
import { getUserCategory } from '@/lib/auth';
import Link from 'next/link';
import { FileText, ArrowRight, RefreshCw } from 'lucide-react';
import dynamic from 'next/dynamic';

// Recharts must be dynamically imported (uses browser APIs)
const Charts = dynamic(() => import('./_preventive_charts'), { ssr: false, loading: () => (
  <div className="flex items-center justify-center h-48 text-gray-300 text-xs">Memuat grafik...</div>
)});

// ── Colour tokens ──────────────────────────────────────────────────────────
const STATUS_META = {
  pending:                  { label: 'Pending',                  color: '#FBBF24' },
  in_progress:              { label: 'Dalam Pengerjaan',         color: '#3B82F6' },
  awaiting_kasie:           { label: 'Menunggu Kasie',          color: '#F97316' },
  awaiting_kadis_perawatan: { label: 'Menunggu Kadis Perawatan',color: '#8B5CF6' },
  awaiting_kadis:           { label: 'Menunggu Kadis',          color: '#A78BFA' },
  completed:                { label: 'Selesai',                  color: '#10B981' },
  approved:                 { label: 'Disetujui',               color: '#059669' },
  rejected:                 { label: 'Ditolak',                  color: '#EF4444' },
};

const CAT_COLORS = {
  Mekanik: '#0070D2', Listrik: '#E67E22', Sipil: '#27AE60', Otomasi: '#8E44AD',
};

export function WidgetPreventive() {
  const [spkList, setSpkList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]   = useState(null);
  const [userCategory, setUserCategory] = useState(null);
  useEffect(() => { setUserCategory(getUserCategory()); }, []);

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
  const catData = cats.map((cat) => {
    const total     = spkList.filter((s) => s.category === cat).length;
    const completed = spkList.filter((s) => s.category === cat && (s.status === 'completed' || s.status === 'approved')).length;
    const pct       = total > 0 ? Math.round((completed / total) * 100) : 0;
    return { name: `${cat} (${pct}%)`, total, completed, color: CAT_COLORS[cat] };
  }).filter((d) => d.total > 0);


  return (
    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 lg:px-5 lg:py-4 border-b border-gray-100">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center">
            <FileText size={16} className="text-white" />
          </div>
          <div>
            <p className="text-sm font-semibold text-gray-800">SPK Preventive</p>
            <p className="text-xs text-gray-400">
              {loading ? '—' : `${total} total SPK${userCategory ? ` · ${userCategory}` : ''}`}
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
        <div className="flex-1 px-4 py-3 lg:px-5 lg:py-4 space-y-4 lg:space-y-5">
          {/* Charts row */}
          <Charts
            statusData={statusData}
            catData={catData}
            total={total}
          />


        </div>
      )}

      {/* Footer */}
      <div className="px-4 py-2.5 lg:px-5 lg:py-3 border-t border-gray-100 bg-gray-50">
        <Link href="/spk" className="flex items-center gap-1 text-xs font-medium text-blue-600 hover:text-blue-800 transition-colors">
          Lihat semua SPK <ArrowRight size={12} />
        </Link>
      </div>
    </div>
  );
}
