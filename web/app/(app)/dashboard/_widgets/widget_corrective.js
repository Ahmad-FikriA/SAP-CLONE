'use client';

import { useState, useEffect } from 'react';
import { apiGet } from '@/lib/api';
import Link from 'next/link';
import { Wrench, ArrowRight, RefreshCw, AlertTriangle, Activity, CheckCircle2, ClipboardSignature } from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip as RechartsTooltip } from 'recharts';
import { SpkDetailDialog } from '@/app/(app)/corrective/_components/SpkDetailDialog';

const PRIORITY_COLORS = {
  low:      'bg-gray-100 text-gray-600',
  medium:   'bg-yellow-100 text-yellow-700',
  high:     'bg-orange-100 text-orange-700',
  urgent:   'bg-red-100 text-red-700',
  critical: 'bg-red-200 text-red-800',
};

const SPK_STATUS_LABELS = {
  baru_import: "Baru",
  eksekusi: "Eksekusi",
  menunggu_review_kadis_pp: "Review Kadis PP",
  menunggu_review_kadis_pelapor: "Review Pelapor",
  selesai: "Selesai",
  ditolak: "Ditolak",
};

const SPK_STATUS_COLORS = {
  baru_import: "bg-blue-100 text-blue-700 border-blue-200",
  eksekusi: "bg-orange-100 text-orange-700 border-orange-200",
  menunggu_review_kadis_pp: "bg-purple-100 text-purple-700 border-purple-200",
  menunggu_review_kadis_pelapor: "bg-indigo-100 text-indigo-700 border-indigo-200",
  selesai: "bg-green-100 text-green-700 border-green-200",
  ditolak: "bg-red-100 text-red-600 border-red-200",
};

function fmtDate(iso) {
  if (!iso) return '-';
  return new Date(iso).toLocaleDateString('id-ID', { day: '2-digit', month: 'short' });
}

export function WidgetCorrective() {
  const [requests, setRequests] = useState([]);
  const [spks, setSpks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedSpk, setSelectedSpk] = useState(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const [reqRes, spkRes] = await Promise.all([
        apiGet("/corrective/requests"),
        apiGet("/corrective/sap-spk"),
      ]);
      const reqData = Array.isArray(reqRes?.data) ? reqRes.data : (Array.isArray(reqRes) ? reqRes : []);
      const spkData = Array.isArray(spkRes?.data) ? spkRes.data : (Array.isArray(spkRes) ? spkRes : []);
      setRequests(reqData);
      setSpks(spkData);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  // Updated KPIs reflecting actual workflow
  const openRequests = requests.filter(r => r.approvalStatus === "pending" || r.approvalStatus === "rejected").length;
  const activeSpks = spks.filter(s => s.status !== "selesai" && s.status !== "ditolak");
  
  const inProgressSpks = spks.filter(s => s.status === "eksekusi").length;
  const waitingReviewKadisPp = spks.filter(s => s.status === "menunggu_review_kadis_pp").length;
  const waitingReviewKadisPelapor = spks.filter(s => s.status === "menunggu_review_kadis_pelapor").length;
  const newSpks = spks.filter(s => s.status === "baru_import").length;
  const completedSpks = spks.filter(s => s.status === "selesai").length;
  const validSpks = spks.filter(s => s.status !== "ditolak").length;
  const completionRate = validSpks > 0 ? Math.round((completedSpks / validSpks) * 100) : 0;

  const recentSpks = [...activeSpks]
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
    .slice(0, 4);

  // Chart Data
  let chartData = [
    { name: 'Tugas Baru', value: newSpks, color: '#3b82f6' }, // blue-500
    { name: 'Sedang Eksekusi', value: inProgressSpks, color: '#f97316' }, // orange-500
    { name: 'Review Kadis PP', value: waitingReviewKadisPp, color: '#a855f7' }, // purple-500
    { name: 'Review Kadis Pelapor', value: waitingReviewKadisPelapor, color: '#6366f1' }, // indigo-500
  ].filter(d => d.value > 0);

  if (chartData.length === 0) {
    chartData = [{ name: 'Tidak ada data', value: 1, color: '#f3f4f6' }]; // gray-100
  }

  return (
    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden flex flex-col h-full shadow-sm hover:shadow-md transition-shadow">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 bg-gradient-to-r from-gray-50/50 to-white">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-orange-400 to-orange-600 flex items-center justify-center shadow-sm">
            <Wrench size={18} className="text-white" />
          </div>
          <div>
            <p className="text-sm font-bold text-gray-800 tracking-tight">Corrective Maintenance</p>
            <p className="text-[11px] text-gray-500 font-medium">Status perbaikan terkini</p>
          </div>
        </div>
        <button onClick={load} disabled={loading}
          className="p-2 rounded-lg hover:bg-gray-100 text-gray-400 transition-colors">
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      {loading ? (
        <div className="flex-1 flex items-center justify-center py-10 text-gray-400 text-sm">Memuat diagram...</div>
      ) : error ? (
        <div className="flex-1 flex items-center justify-center py-10 text-red-500 text-sm">{error}</div>
      ) : (
        <div className="flex-1 p-5 flex flex-col gap-5">
          {/* Top Section: Chart & KPIs */}
          <div className="flex flex-col sm:flex-row items-center gap-6">
            
            {/* Donut Chart & Legend */}
            <div className="w-full sm:w-1/3 flex flex-col items-center justify-center">
              <div className="w-full h-48 relative mb-2">
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none mt-1 z-0">
                   <span className="text-3xl font-extrabold text-gray-800 leading-none">{activeSpks.length}</span>
                   <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-1">Aktif</span>
                </div>
                <div className="w-full h-full relative z-10">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={chartData}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={85}
                        paddingAngle={3}
                        dataKey="value"
                        stroke="none"
                      >
                        {chartData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <RechartsTooltip 
                        contentStyle={{ borderRadius: '12px', fontSize: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                        itemStyle={{ color: '#1f2937', fontWeight: 600 }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </div>
              
              {/* Legend to utilize the empty space under the chart */}
              <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 mt-1">
                {chartData.filter(d => d.name !== 'Tidak ada data').map((entry, index) => (
                  <div key={index} className="flex items-center gap-1">
                    <div className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.color }} />
                    <span className="text-[9px] text-gray-500 font-medium">{entry.name}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* KPI Cards & Progress */}
            <div className="w-full sm:w-2/3 flex flex-col justify-center gap-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-xl p-3 bg-blue-50/50 border border-blue-100/50 flex flex-col justify-center">
                  <div className="flex items-center gap-2 mb-1.5">
                    <AlertTriangle size={14} className="text-blue-500" />
                    <span className="text-[10px] font-bold text-blue-600 uppercase tracking-wide">Menunggu Planner</span>
                  </div>
                  <span className="text-2xl font-extrabold text-gray-800">{openRequests}</span>
                </div>
                <div className="rounded-xl p-3 bg-orange-50/50 border border-orange-100/50 flex flex-col justify-center">
                  <div className="flex items-center gap-2 mb-1.5">
                    <Activity size={14} className="text-orange-500" />
                    <span className="text-[10px] font-bold text-orange-600 uppercase tracking-wide">Dalam Eksekusi</span>
                  </div>
                  <span className="text-2xl font-extrabold text-gray-800">{inProgressSpks}</span>
                </div>
                <div className="rounded-xl p-3 bg-purple-50/50 border border-purple-100/50 flex flex-col justify-center">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <ClipboardSignature size={14} className="text-purple-500" />
                      <span className="text-[10px] font-bold text-purple-600 uppercase tracking-wide">Review Kadis PP</span>
                    </div>
                  </div>
                  <span className="text-2xl font-extrabold text-gray-800 mt-1">{waitingReviewKadisPp}</span>
                </div>
                <div className="rounded-xl p-3 bg-indigo-50/50 border border-indigo-100/50 flex flex-col justify-center">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <ClipboardSignature size={14} className="text-indigo-500" />
                      <span className="text-[10px] font-bold text-indigo-600 uppercase tracking-wide">Review Pelapor</span>
                    </div>
                  </div>
                  <span className="text-2xl font-extrabold text-gray-800 mt-1">{waitingReviewKadisPelapor}</span>
                </div>
              </div>

              {/* Progress Bar Selesai */}
              <div className="p-3 bg-emerald-50/50 border border-emerald-100/50 rounded-xl">
                <div className="flex justify-between items-center mb-2">
                  <div className="flex items-center gap-1.5">
                    <CheckCircle2 size={13} className="text-emerald-500" />
                    <span className="text-[10px] font-bold text-emerald-700 uppercase tracking-wide">Rasio Penyelesaian</span>
                  </div>
                  <span className="text-xs font-extrabold text-emerald-700">{completionRate}%</span>
                </div>
                <div className="w-full bg-emerald-100/50 rounded-full h-1.5 overflow-hidden">
                  <div className="bg-emerald-500 h-1.5 rounded-full transition-all duration-1000" style={{ width: `${completionRate}%` }}></div>
                </div>
              </div>
            </div>
          </div>

          {/* Recent SPKs List */}
          <div className="pt-2 border-t border-gray-100 flex-1 flex flex-col">
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-3">
              Update SPK Terbaru
            </p>
            {recentSpks.length > 0 ? (
              <div className="space-y-2">
                {recentSpks.map((spk) => (
                  <div 
                    key={spk.order_number} 
                    onClick={() => setSelectedSpk(spk)}
                    className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-50 cursor-pointer transition-colors group"
                  >
                    <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: chartData.find(c => c.name.toLowerCase().includes(spk.status.split('_')[0]))?.color || '#9ca3af' }} />
                    <div className="flex-1 min-w-0">
                      <p className="font-mono text-xs font-bold text-gray-700 truncate group-hover:text-orange-600 transition-colors">
                        {spk.order_number}
                      </p>
                      <p className="text-[10px] text-gray-500 truncate">
                        {spk.description || spk.equipment_name || 'Tanpa deskripsi'}
                      </p>
                    </div>
                    <span className={`px-2 py-0.5 rounded border text-[10px] font-bold shrink-0 ${SPK_STATUS_COLORS[spk.status] || 'bg-gray-100 text-gray-600 border-gray-200'}`}>
                      {SPK_STATUS_LABELS[spk.status] || spk.status}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center border-2 border-dashed border-gray-100 rounded-xl bg-gray-50/50 py-5">
                 <CheckCircle2 size={24} className="text-gray-300 mb-2" />
                 <p className="text-xs font-bold text-gray-400">Belum ada SPK aktif</p>
                 <p className="text-[10px] text-gray-400 text-center px-4 mt-1">SPK yang sedang berjalan akan muncul di sini</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Footer */}
      <div className="px-5 py-3 border-t border-gray-100 bg-gray-50/50 mt-auto">
        <Link href="/corrective" className="flex items-center justify-center gap-1.5 text-xs font-bold text-orange-600 hover:text-orange-700 transition-colors">
          Buka Modul Corrective <ArrowRight size={14} />
        </Link>
      </div>

      {/* Detail Dialog */}
      {selectedSpk && (
        <SpkDetailDialog 
          selectedSpk={selectedSpk} 
          onClose={() => setSelectedSpk(null)} 
        />
      )}
    </div>
  );
}
