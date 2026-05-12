'use client';

import { useState, useEffect } from 'react';
import { apiGet } from '@/lib/api';
import Link from 'next/link';
import { Wrench, ArrowRight, RefreshCw, Activity, CheckCircle2, ClipboardCheck, Clock } from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip as RechartsTooltip } from 'recharts';


export function WidgetCorrective() {
  const [requests, setRequests] = useState([]);
  const [spks, setSpks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);


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

  // Current State Mapping based on User Definition
  const pendingRequestsCount = requests.filter(r => r.approvalStatus === "pending").length;
  const reviewKadisPpCount = spks.filter(s => s.status === "menunggu_review_kadis_pp").length;
  const reviewKadisPelaporCount = spks.filter(s => s.status === "menunggu_review_kadis_pelapor").length;
  
  // Overall Review Count (The combined value the user wants)
  const totalReviewCount = pendingRequestsCount + reviewKadisPpCount + reviewKadisPelaporCount;

  // Other Dashboard KPIs
  const activeSpksCount = spks.filter(s => s.status !== "selesai" && s.status !== "ditolak").length;
  const completedSpksCount = spks.filter(s => s.status === "selesai").length;
  const inProgressSpksCount = spks.filter(s => s.status === "eksekusi").length;
  const newSpksCount = spks.filter(s => s.status === "baru_import").length;
  
  const validSpksCount = spks.filter(s => s.status !== "ditolak").length;
  const completionRate = validSpksCount > 0 ? Math.round((completedSpksCount / validSpksCount) * 100) : 0;

  // Chart Data
  let chartData = [
    { name: 'Tugas Baru', value: newSpksCount, color: '#3b82f6' }, // blue-500
    { name: 'Sedang Eksekusi', value: inProgressSpksCount, color: '#f97316' }, // orange-500
    { name: 'Review Kadis PP', value: reviewKadisPpCount, color: '#a855f7' }, // purple-500
    { name: 'Review Kadis Pelapor', value: reviewKadisPelaporCount, color: '#6366f1' }, // indigo-500
    { name: 'Selesai', value: completedSpksCount, color: '#10b981' }, // emerald-500
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
        <div className="flex-1 p-5 flex flex-col gap-6">
          {/* Top Section: Chart & KPIs */}
          <div className="flex flex-col sm:flex-row items-center gap-6">
            
            {/* Donut Chart & Legend */}
            <div className="w-full sm:w-1/3 flex flex-col items-center justify-center">
              <div className="w-full h-48 relative mb-2">
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none mt-1 z-0">
                   <span className="text-3xl font-extrabold text-gray-800 leading-none">{spks.length}</span>
                   <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-1">Total SPK</span>
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
              
              {/* Legend */}
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
            <div className="w-full sm:w-2/3 flex flex-col justify-center gap-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-xl p-3 bg-indigo-50/50 border border-indigo-100/50 flex flex-col justify-center">
                  <div className="flex items-center gap-2 mb-1.5">
                    <Activity size={14} className="text-indigo-500" />
                    <span className="text-[10px] font-bold text-indigo-600 uppercase tracking-wide">SPK Aktif</span>
                  </div>
                  <span className="text-2xl font-extrabold text-gray-800">{activeSpksCount}</span>
                </div>

                <div className="rounded-xl p-3 bg-emerald-50/50 border border-emerald-100/50 flex flex-col justify-center">
                  <div className="flex items-center gap-2 mb-1.5">
                    <CheckCircle2 size={14} className="text-emerald-500" />
                    <span className="text-[10px] font-bold text-emerald-600 uppercase tracking-wide">SPK Selesai</span>
                  </div>
                  <span className="text-2xl font-extrabold text-gray-800">{completedSpksCount}</span>
                </div>

                <div className="rounded-xl p-3 bg-orange-50/50 border border-orange-100/50 flex flex-col justify-center">
                  <div className="flex items-center gap-2 mb-1.5">
                    <Clock size={14} className="text-orange-500" />
                    <span className="text-[10px] font-bold text-orange-600 uppercase tracking-wide">Dalam Eksekusi</span>
                  </div>
                  <span className="text-2xl font-extrabold text-gray-800">{inProgressSpksCount}</span>
                </div>

                <div className="rounded-xl p-3 bg-rose-50/50 border border-rose-100/50 flex flex-col justify-center">
                  <div className="flex items-center gap-2 mb-1.5">
                    <ClipboardCheck size={14} className="text-rose-500" />
                    <span className="text-[10px] font-bold text-rose-600 uppercase tracking-wide">Menunggu Review</span>
                  </div>
                  <div className="flex items-end justify-between">
                    <span className="text-2xl font-extrabold text-gray-800">{totalReviewCount}</span>
                    <div className="flex gap-1.5 mb-0.5">
                       <div className="flex flex-col items-center">
                         <span className="text-[8px] font-bold text-gray-400">PLAN</span>
                         <span className="text-[10px] font-bold text-gray-700">{pendingRequestsCount}</span>
                       </div>
                       <div className="flex flex-col items-center border-l border-gray-200 pl-1.5">
                         <span className="text-[8px] font-bold text-gray-400">PP</span>
                         <span className="text-[10px] font-bold text-gray-700">{reviewKadisPpCount}</span>
                       </div>
                       <div className="flex flex-col items-center border-l border-gray-200 pl-1.5">
                         <span className="text-[8px] font-bold text-gray-400">PLPR</span>
                         <span className="text-[10px] font-bold text-gray-700">{reviewKadisPelaporCount}</span>
                       </div>
                    </div>
                  </div>
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
        </div>
      )}

      {/* Footer */}
      <div className="px-5 py-3 border-t border-gray-100 bg-gray-50/50 mt-auto">
        <Link href="/corrective" className="flex items-center justify-center gap-1.5 text-xs font-bold text-orange-600 hover:text-orange-700 transition-colors">
          Buka Modul Corrective <ArrowRight size={14} />
        </Link>
      </div>


    </div>
  );
}
