'use client';

import { useState, useEffect } from 'react';
import { apiGet } from '@/lib/api';
import Link from 'next/link';
import { 
  ShieldCheck, 
  ArrowRight, 
  RefreshCw, 
  AlertTriangle, 
  TrendingUp, 
  CheckCircle2, 
  Clock, 
  Activity,
  Zap,
  Eye,
  AlertOctagon
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { K3DetailDialog } from '@/app/(app)/hse/_components/K3DetailDialog';

const STATUS_LABELS = {
  menunggu_review_kadiv_pelapor: 'Review Pelapor',
  menunggu_review_kadiv_pphse: 'Review Kadiv',
  menunggu_validasi_kadiv_pphse: 'Validasi PPHSE',
  menunggu_validasi_kadis_hse: 'Validasi HSE',
  menunggu_tindakan_hse: 'Tindakan HSE',
  menunggu_verifikasi_investigasi: 'Verifikasi Investigasi',
  menunggu_validasi_kadiv: 'Validasi Kadiv',
  menunggu_validasi_hasil_kadis_hse: 'Validasi Hasil',
  menunggu_validasi_akhir_kadiv_pphse: 'Verifikasi Akhir',
  selesai: 'Selesai',
  disetujui: 'Disetujui',
  ditolak: 'Ditolak',
  ditolak_kadiv_pphse: 'Ditolak Kadiv',
  ditolak_kadis_hse: 'Ditolak HSE',
  investigasi_ditolak_kadis_hse: 'Investigasi Ditolak',
  investigasi_ditolak_kadiv: 'Investigasi Ditolak',
  perbaikan_ditolak_pphse: 'Perbaikan Ditolak',
};

const STATUS_COLORS = {
  menunggu_review_kadiv_pelapor: 'bg-amber-100 text-amber-700',
  menunggu_review_kadiv_pphse: 'bg-amber-100 text-amber-700',
  menunggu_validasi_kadiv_pphse: 'bg-blue-100 text-blue-700',
  menunggu_validasi_kadis_hse: 'bg-amber-100 text-amber-700',
  menunggu_tindakan_hse: 'bg-blue-100 text-blue-700',
  menunggu_verifikasi_investigasi: 'bg-indigo-100 text-indigo-700',
  menunggu_validasi_kadiv: 'bg-purple-100 text-purple-700',
  menunggu_validasi_hasil_kadis_hse: 'bg-indigo-100 text-indigo-700',
  menunggu_validasi_akhir_kadiv_pphse: 'bg-purple-100 text-purple-700',
  selesai: 'bg-emerald-100 text-emerald-700',
  disetujui: 'bg-emerald-100 text-emerald-700',
  ditolak: 'bg-rose-100 text-rose-700',
  ditolak_kadiv_pphse: 'bg-rose-100 text-rose-700',
  ditolak_kadis_hse: 'bg-rose-100 text-rose-700',
  investigasi_ditolak_kadis_hse: 'bg-rose-100 text-rose-700',
  investigasi_ditolak_kadiv: 'bg-rose-100 text-rose-700',
  perbaikan_ditolak_pphse: 'bg-rose-100 text-rose-700',
};

function MetricSmall({ icon: Icon, label, value, color, light }) {
  return (
    <div className={cn("p-3 rounded-2xl border flex flex-col justify-center", light || "bg-slate-50 border-slate-100")}>
      <div className="flex items-center gap-2 mb-1">
        <Icon size={14} className={color || "text-slate-500"} />
        <span className={cn("text-[9px] font-bold uppercase tracking-wider", color || "text-slate-600")}>{label}</span>
      </div>
      <span className="text-xl font-black text-slate-800 leading-none">{value}</span>
    </div>
  );
}

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
  const [selectedReport, setSelectedReport] = useState(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);

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

  const totalReports = reports.length;
  const incomingReports = reports.filter(r => !r.status.includes('ditolak')).length;
  const solvedReports = reports.filter(r => r.status === 'selesai' || r.status === 'disetujui').length;
  const solveRate = incomingReports > 0 ? Math.round((solvedReports / incomingReports) * 100) : 0;

  const recentReports = [...reports]
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .slice(0, 4);

  return (
    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden flex flex-col h-full shadow-sm hover:shadow-md transition-shadow">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 bg-gradient-to-r from-rose-50/50 to-white">
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
        <div className="flex-1 p-5 flex flex-col gap-6">
          
          {/* Summary Section (Like Corrective) */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-blue-50/50 p-4 rounded-2xl border border-blue-100 flex flex-col items-center justify-center text-center shadow-sm">
              <p className="text-3xl font-black text-blue-700 leading-none mb-1">{incomingReports}</p>
              <p className="text-[10px] font-bold text-blue-600 uppercase tracking-widest">Laporan Masuk</p>
            </div>
            <div className="bg-emerald-50/50 p-4 rounded-2xl border border-emerald-100 flex flex-col items-center justify-center text-center shadow-sm">
              <p className="text-3xl font-black text-emerald-700 leading-none mb-1">{solvedReports}</p>
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

          {/* HSE Metrics Grid - Informative Style */}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {METRICS_K3.map((m) => {
              const Icon = m.icon;
              return (
                <div key={m.id} className={cn("p-3 rounded-2xl border flex flex-col transition-all hover:shadow-md", m.light)}>
                  <div className="flex items-center justify-between mb-2">
                    <div className={cn("p-1.5 rounded-lg bg-white shadow-sm")}>
                      <Icon size={14} className={m.color} />
                    </div>
                    <span className={cn("text-[9px] font-black uppercase tracking-wider opacity-60", m.color)}>{m.id}</span>
                  </div>
                  <div>
                    <p className="text-lg font-black text-slate-800 leading-tight">{m.value}</p>
                    <p className="text-[9px] font-bold text-slate-500 uppercase tracking-tight leading-tight mt-0.5">{m.title}</p>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Recent Reports List */}
          <div className="flex-1 flex flex-col pt-2">
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-3">
              Laporan Terbaru
            </p>
            {recentReports.length > 0 ? (
              <div className="space-y-2">
                {recentReports.map((r) => (
                  <div 
                    key={r.id} 
                    onClick={() => {
                      setSelectedReport(r);
                      setIsDetailOpen(true);
                    }}
                    className="flex items-center gap-3 p-2 rounded-lg border border-slate-50 bg-slate-50/20 group hover:border-rose-200 hover:bg-rose-50/30 transition-all cursor-pointer"
                  >
                    <div className={cn(
                      "w-6 h-6 rounded flex items-center justify-center shrink-0 border text-[10px]",
                      r.kategori?.toLowerCase().includes('manusia') ? "bg-amber-50 border-amber-100 text-amber-600" : "bg-blue-50 border-blue-100 text-blue-600"
                    )}>
                      {r.kategori?.toLowerCase().includes('manusia') ? <Eye size={12} /> : <AlertTriangle size={12} />}
                    </div>
                    <p className="flex-1 text-[11px] font-bold text-gray-700 truncate group-hover:text-rose-600 transition-colors">
                      {r.reportNumber}
                    </p>
                    <span className={cn("px-1.5 py-0.5 rounded text-[7px] font-black uppercase tracking-wider", STATUS_COLORS[r.status] || "bg-gray-100 text-gray-600")}>
                      {STATUS_LABELS[r.status] || r.status}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center border-2 border-dashed border-gray-100 rounded-xl bg-gray-50/50 py-5">
                 <CheckCircle2 size={24} className="text-gray-300 mb-2" />
                 <p className="text-xs font-bold text-gray-400">Belum ada temuan K3</p>
              </div>
            )}
          </div>

        </div>
      )}

      {/* Footer */}
      <div className="px-5 py-3 border-t border-gray-100 bg-gray-50/50 mt-auto">
        <Link href="/hse" className="flex items-center justify-center gap-1.5 text-xs font-bold text-rose-600 hover:text-rose-700 transition-colors">
          Buka Detail HSE Command Center <ArrowRight size={14} />
        </Link>
      </div>

      <K3DetailDialog 
        report={selectedReport} 
        open={isDetailOpen} 
        onOpenChange={setIsDetailOpen} 
      />
    </div>
  );
}
