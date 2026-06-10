'use client';

import { useState, useEffect } from 'react';
import { apiGet } from '@/lib/api';
import Link from 'next/link';
import { Wrench, ArrowRight, RefreshCw } from 'lucide-react';
import dynamic from 'next/dynamic';

const Charts = dynamic(() => import('./_corrective_charts'), { ssr: false, loading: () => (
  <div className="flex items-center justify-center h-48 text-gray-300 text-xs">Memuat grafik...</div>
)});

const STATUS_META = {
  baru_import: { label: 'Tugas Baru', color: '#3B82F6' },
  eksekusi: { label: 'Sedang Eksekusi', color: '#F97316' },
  menunggu_review_kadis_pp: { label: 'Review Kadis PP', color: '#8B5CF6' },
  menunggu_review_kadis_pelapor: { label: 'Review Pelapor', color: '#6366F1' },
  selesai: { label: 'Selesai', color: '#10B981' },
  ditolak: { label: 'Ditolak', color: '#EF4444' },
};

const WORK_CENTER_GROUPS = {
  E: { name: 'Elektrik', color: '#E67E22' },
  O: { name: 'Otomasi', color: '#8E44AD' },
  M: { name: 'Mekanik', color: '#0070D2' },
  S: { name: 'Sipil', color: '#27AE60' },
};

export function WidgetCorrective() {
  const [spks, setSpks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const response = await apiGet("/corrective/sap-spk");
      const data = Array.isArray(response?.data) ? response.data : (Array.isArray(response) ? response : []);
      setSpks(data);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  const total = spks.length;

  // Status donut data
  const statusData = Object.entries(STATUS_META)
    .map(([key, { label, color }]) => ({
      name: label,
      value: spks.filter(s => s.status === key).length,
      color,
    }))
    .filter(d => d.value > 0);

  // Group bar data (derived from work_center prefix)
  const groupData = Object.entries(WORK_CENTER_GROUPS).map(([prefix, info]) => {
    const groupSpks = spks.filter(s => (s.work_center || '').toUpperCase().startsWith(prefix));
    const totalCount = groupSpks.length;
    const completedCount = groupSpks.filter(s => s.status === 'selesai').length;
    const pct = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;
    
    return {
      name: `${info.name} (${pct}%)`,
      total: totalCount,
      completed: completedCount,
      remaining: totalCount - completedCount,
      color: info.color
    };
  }).filter(d => d.total > 0);

  return (
    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden flex flex-col h-full shadow-sm">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 lg:px-5 lg:py-4 border-b border-gray-100">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-orange-500 flex items-center justify-center">
            <Wrench size={16} className="text-white" />
          </div>
          <div>
            <p className="text-sm font-semibold text-gray-800">SPK Corrective</p>
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
        <div className="flex-1 flex items-center justify-center py-16 text-gray-400 text-sm">Memuat...</div>
      ) : error ? (
        <div className="flex-1 flex items-center justify-center py-16 text-red-500 text-sm">{error}</div>
      ) : (
        <div className="flex-1 px-4 py-3 lg:px-5 lg:py-4 space-y-4 lg:space-y-5">
          <Charts
            statusData={statusData}
            groupData={groupData}
            total={total}
          />
        </div>
      )}

      {/* Footer */}
      <div className="px-4 py-2.5 lg:px-5 lg:py-3 border-t border-gray-100 bg-gray-50 mt-auto">
        <Link href="/corrective" className="flex items-center gap-1 text-xs font-medium text-orange-600 hover:text-orange-800 transition-colors">
          Lihat semua Corrective <ArrowRight size={12} />
        </Link>
      </div>
    </div>
  );
}
