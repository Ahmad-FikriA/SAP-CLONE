'use client';

import { useState, useEffect } from 'react';
import { apiGet } from '@/lib/api';
import Link from 'next/link';
import { 
  ShieldCheck, 
  ArrowRight, 
  RefreshCw, 
  AlertTriangle, 
  CheckCircle2, 
  Activity,
  Zap,
  Eye,
  AlertOctagon
} from 'lucide-react';
import { cn } from '@/lib/utils';

const METRICS_K3 = [
  { id: 'NMRR', title: 'Near Miss Reporting', value: '12.5%', icon: AlertTriangle, color: 'text-blue-600', light: 'bg-blue-50 border-blue-100' },
  { id: 'SOR', title: 'Safety Observation', value: '45.2%', icon: Eye, color: 'text-emerald-600', light: 'bg-emerald-50 border-emerald-100' },
  { id: 'CACR', title: 'Corrective Action', value: '88.0%', icon: CheckCircle2, color: 'text-violet-600', light: 'bg-violet-50 border-violet-100' },
  { id: 'TRIR', title: 'Incident Rate', value: '0.42', icon: Activity, color: 'text-amber-600', light: 'bg-amber-50 border-amber-100' },
  { id: 'LTIFR', title: 'Injury Frequency', value: '0.00', icon: Zap, color: 'text-indigo-600', light: 'bg-indigo-50 border-indigo-100' },
  { id: 'FATALITY', title: 'Fatality Rate', value: '0', icon: AlertOctagon, color: 'text-rose-600', light: 'bg-rose-50 border-rose-100' },
];

export function WidgetK3Inspection() {
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const res = await apiGet('/k3-safety');
      const data = Array.isArray(res?.data) ? res.data : (Array.isArray(res) ? res : []);
      setReports(data);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  const incomingReports = reports.filter(r => !r.status.includes('ditolak')).length;
  const solvedReports = reports.filter(r => r.status === 'selesai' || r.status === 'disetujui').length;
  const solveRate = incomingReports > 0 ? Math.round((solvedReports / incomingReports) * 100) : 0;

  return (
    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden flex flex-col h-full shadow-sm hover:shadow-md transition-shadow">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 lg:px-5 lg:py-4 border-b border-gray-100 bg-gradient-to-r from-rose-50/50 to-white">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-rose-500 to-rose-700 flex items-center justify-center shadow-sm">
            <ShieldCheck size={18} className="text-white" />
          </div>
          <div>
            <p className="text-sm font-bold text-gray-800 tracking-tight">K3 Safety Inspection</p>
            <p className="text-[11px] text-gray-500 font-medium">Monitoring Kinerja K3</p>
          </div>
        </div>
        <button onClick={load} disabled={loading}
          className="p-2 rounded-lg hover:bg-gray-100 text-gray-400 transition-colors">
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      {loading ? (
        <div className="flex-1 flex items-center justify-center py-10 text-gray-400 text-sm">Memuat data K3...</div>
      ) : error ? (
        <div className="flex-1 flex items-center justify-center py-10 text-red-500 text-sm">{error}</div>
      ) : (
        <div className="flex-1 p-4 lg:p-5 flex flex-col gap-4 lg:gap-5">
          
          {/* Summary Section */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-blue-50/50 p-3 lg:p-4 rounded-2xl border border-blue-100 flex flex-col items-center justify-center text-center shadow-sm">
              <p className="text-2xl lg:text-3xl font-black text-blue-700 leading-none mb-1">{incomingReports}</p>
              <p className="text-[10px] font-bold text-blue-600 uppercase tracking-widest">Laporan Masuk</p>
            </div>
            <div className="bg-emerald-50/50 p-3 lg:p-4 rounded-2xl border border-emerald-100 flex flex-col items-center justify-center text-center shadow-sm">
              <p className="text-2xl lg:text-3xl font-black text-emerald-700 leading-none mb-1">{solvedReports}</p>
              <p className="text-[10px] font-bold text-emerald-600 uppercase tracking-widest">Diselesaikan</p>
            </div>
          </div>

          {/* Progress Bar closure */}
          <div className="p-3 bg-slate-50 border border-slate-100 rounded-xl">
            <div className="flex justify-between items-center mb-1.5">
              <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wider">Tingkat Penyelesaian (Closure)</span>
              <span className="text-[10px] font-black text-emerald-600">{solveRate}%</span>
            </div>
            <div className="w-full bg-slate-200 rounded-full h-1.5 overflow-hidden">
              <div className="bg-emerald-500 h-1.5 rounded-full transition-all duration-1000" style={{ width: `${solveRate}%` }}></div>
            </div>
          </div>

          {/* HSE Metrics Grid */}
          <div className="grid grid-cols-3 gap-2 lg:gap-3">
            {METRICS_K3.map((m) => {
              const Icon = m.icon;
              return (
                <div key={m.id} className={cn("p-2 lg:p-3 rounded-xl border flex flex-col transition-all hover:shadow-md", m.light)}>
                  <div className="flex items-center justify-between mb-1.5">
                    <div className={cn("p-1 rounded-lg bg-white shadow-sm")}>
                      <Icon size={12} className={m.color} />
                    </div>
                    <span className={cn("text-[8px] font-black uppercase tracking-wider opacity-60", m.color)}>{m.id}</span>
                  </div>
                  <div>
                    <p className="text-base font-black text-slate-800 leading-tight">{m.value}</p>
                    <p className="text-[8px] font-bold text-slate-500 uppercase tracking-tight leading-tight mt-0.5">{m.title}</p>
                  </div>
                </div>
              );
            })}
          </div>

        </div>
      )}

      {/* Footer */}
      <div className="px-4 py-2.5 lg:px-5 lg:py-3 border-t border-gray-100 bg-gray-50/50 mt-auto">
        <Link href="/hse" className="flex items-center justify-center gap-1.5 text-xs font-bold text-rose-600 hover:text-rose-700 transition-colors">
          Buka Detail HSE Command Center <ArrowRight size={14} />
        </Link>
      </div>
    </div>
  );
}
