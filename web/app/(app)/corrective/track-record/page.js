'use client';

import { useState, useEffect } from 'react';
import { apiGet } from '@/lib/api';
import { toast } from 'sonner';
import { 
  BarChart2, Wrench, Users, Building2, 
  RefreshCw, TrendingUp, Award, ClipboardList 
} from 'lucide-react';
import { cn } from '@/lib/utils';

export default function CorrectiveTrackRecordPage() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    try {
      const res = await apiGet('/corrective/sap-spk/stats');
      setStats(res.data);
    } catch (e) {
      toast.error('Gagal memuat statistik: ' + e.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  if (loading) return (
    <div className="flex flex-col items-center justify-center h-[80vh] text-gray-400">
      <RefreshCw className="animate-spin mb-2" size={32} />
      <p>Memuat statistik corrective...</p>
    </div>
  );

  if (!stats) return null;

  return (
    <div className="p-6 space-y-8 bg-gray-50 min-h-screen">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Track Record Corrective</h1>
          <p className="text-sm text-gray-500">Analisis kinerja perbaikan berdasarkan Work Center, Teknisi, dan Dinas Pelapor</p>
        </div>
        <button 
          onClick={load} 
          className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors shadow-sm"
        >
          <RefreshCw size={14} /> Refresh
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <SummaryCard 
          label="Total SPK" 
          value={stats.totalSpk} 
          icon={ClipboardList} 
          color="bg-blue-500" 
        />
        <SummaryCard 
          label="Top Work Center" 
          value={stats.workCenters[0]?.name || '-'} 
          sub={`${stats.workCenters[0]?.count || 0} pekerjaan`}
          icon={Wrench} 
          color="bg-orange-500" 
        />
        <SummaryCard 
          label="Top Teknisi" 
          value={stats.technicians[0]?.name || '-'} 
          sub={`${stats.technicians[0]?.count || 0} pekerjaan`}
          icon={Users} 
          color="bg-indigo-500" 
        />
        <SummaryCard 
          label="Top Dinas Pelapor" 
          value={stats.departments[0]?.name || '-'} 
          sub={`${stats.departments[0]?.count || 0} permintaan`}
          icon={Building2} 
          color="bg-emerald-500" 
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Work Centers Ranking */}
        <RankingTable 
          title="Beban Kerja per Work Center" 
          icon={Wrench}
          data={stats.workCenters}
          total={stats.totalSpk}
          accentColor="bg-orange-500"
        />

        {/* Technicians Ranking */}
        <RankingTable 
          title="Produktivitas Teknisi" 
          icon={Users}
          data={stats.technicians}
          total={stats.totalSpk}
          accentColor="bg-indigo-500"
        />

        {/* Departments Ranking */}
        <RankingTable 
          title="Dinas Pelapor Teraktif" 
          icon={Building2}
          data={stats.departments}
          total={stats.totalSpk}
          accentColor="bg-emerald-500"
        />
      </div>
    </div>
  );
}

function SummaryCard({ label, value, sub, icon: Icon, color }) {
  return (
    <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm flex items-start gap-4">
      <div className={cn("w-12 h-12 rounded-lg flex items-center justify-center shrink-0 shadow-inner", color)}>
        <Icon className="text-white" size={24} />
      </div>
      <div className="min-w-0">
        <p className="text-sm font-medium text-gray-500 truncate">{label}</p>
        <p className="text-xl font-bold text-gray-900 mt-0.5 truncate">{value}</p>
        {sub && <p className="text-xs text-gray-400 mt-1">{sub}</p>}
      </div>
    </div>
  );
}

function RankingTable({ title, icon: Icon, data, total, accentColor }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden flex flex-col">
      <div className="px-5 py-4 border-b border-gray-100 flex items-center gap-2 bg-gray-50/50">
        <Icon size={18} className="text-gray-400" />
        <h3 className="font-semibold text-gray-800 text-sm">{title}</h3>
      </div>
      <div className="p-5 flex-1 space-y-4">
        {data.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 text-gray-300 italic text-sm">
            Belum ada data
          </div>
        ) : data.map((item, idx) => {
          const percentage = Math.round((item.count / total) * 100) || 0;
          return (
            <div key={item.id || item.name} className="space-y-1.5">
              <div className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-xs font-bold text-gray-300 w-4">{idx + 1}.</span>
                  <span className="font-medium text-gray-700 truncate">{item.name}</span>
                </div>
                <span className="font-bold text-gray-900 shrink-0">{item.count} <span className="text-[10px] text-gray-400 font-normal uppercase ml-0.5">SPK</span></span>
              </div>
              <div className="relative h-2 w-full bg-gray-100 rounded-full overflow-hidden">
                <div 
                  className={cn("absolute inset-y-0 left-0 rounded-full transition-all duration-500", accentColor)}
                  style={{ width: `${percentage}%` }}
                />
              </div>
              <p className="text-[10px] text-gray-400 text-right">{percentage}% dari total</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
