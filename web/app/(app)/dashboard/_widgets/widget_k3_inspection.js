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
  AlertOctagon,
  HeartPulse,
  Stethoscope,
  ClipboardCheck,
} from 'lucide-react';
import { cn } from '@/lib/utils';

function getMetricClassification(id, valueNum) {
  const key = id.toLowerCase();
  if (key === 'nmrr') {
    if (valueNum >= 2) return { label: 'Baik', color: 'bg-emerald-100 text-emerald-700' };
    if (valueNum >= 1) return { label: 'Cukup', color: 'bg-amber-100 text-amber-700' };
    return { label: 'Kurang', color: 'bg-rose-100 text-rose-700' };
  }
  if (key === 'sor') {
    if (valueNum >= 5) return { label: 'Baik Sekali', color: 'bg-indigo-100 text-indigo-700' };
    if (valueNum >= 4) return { label: 'Baik', color: 'bg-emerald-100 text-emerald-700' };
    if (valueNum >= 3) return { label: 'Cukup', color: 'bg-amber-100 text-amber-700' };
    if (valueNum >= 2) return { label: 'Kurang', color: 'bg-orange-100 text-orange-700' };
    return { label: 'Buruk', color: 'bg-rose-100 text-rose-700' };
  }
  if (key === 'cacr') {
    if (valueNum >= 90) return { label: 'Baik Sekali', color: 'bg-indigo-100 text-indigo-700' };
    if (valueNum >= 70) return { label: 'Baik', color: 'bg-emerald-100 text-emerald-700' };
    if (valueNum >= 50) return { label: 'Cukup', color: 'bg-amber-100 text-amber-700' };
    if (valueNum >= 30) return { label: 'Kurang', color: 'bg-orange-100 text-orange-700' };
    return { label: 'Buruk', color: 'bg-rose-100 text-rose-700' };
  }
  if (key === 'trir') {
    if (valueNum <= 4.0) return { label: 'Baik Sekali', color: 'bg-indigo-100 text-indigo-700' };
    if (valueNum <= 8.0) return { label: 'Baik', color: 'bg-emerald-100 text-emerald-700' };
    if (valueNum <= 12.0) return { label: 'Cukup', color: 'bg-amber-100 text-amber-700' };
    if (valueNum <= 16.0) return { label: 'Kurang', color: 'bg-orange-100 text-orange-700' };
    return { label: 'Buruk', color: 'bg-rose-100 text-rose-700' };
  }
  if (key === 'ltifr') {
    if (valueNum <= 1.0) return { label: 'Baik Sekali', color: 'bg-indigo-100 text-indigo-700' };
    if (valueNum <= 2.0) return { label: 'Baik', color: 'bg-emerald-100 text-emerald-700' };
    if (valueNum <= 3.0) return { label: 'Cukup', color: 'bg-amber-100 text-amber-700' };
    if (valueNum <= 4.0) return { label: 'Kurang', color: 'bg-orange-100 text-orange-700' };
    return { label: 'Buruk', color: 'bg-rose-100 text-rose-700' };
  }
  return null;
}

export function WidgetK3Inspection() {
  const [reports, setReports] = useState([]);
  const [k3Settings, setK3Settings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const [reportsRes, settingsRes] = await Promise.all([
        apiGet('/k3-safety'),
        apiGet('/k3-settings').catch(() => null),
      ]);
      const data = Array.isArray(reportsRes?.data) ? reportsRes.data : (Array.isArray(reportsRes) ? reportsRes : []);
      setReports(data);
      if (settingsRes?.data) {
        setK3Settings(settingsRes.data);
      }
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  // ── Konfigurasi Safety Performance (sama persis dengan HSE page) ───────────
  const TOTAL_KARYAWAN = k3Settings?.totalKaryawan || 280;
  const JAM_KERJA_PER_BULAN = (k3Settings?.jamKerjaPerHari || 8) * (k3Settings?.hariKerjaPerBulan || 20);
  const KONSTANTA_OSHA = k3Settings?.konstantaOsha || 200_000;
  const TOTAL_JAM_KERJA = TOTAL_KARYAWAN * JAM_KERJA_PER_BULAN * 12;

  // ── Data dasar ────────────────────────────────────────────────────────────────
  const incomingReports = reports.filter(r => !r.status.includes('ditolak')).length;
  const approvedReports = reports.filter(r => r.status === 'selesai' || r.status === 'disetujui');

  // 1. NMRR = (Jumlah kejadian Near Miss / Total Karyawan) × 100
  const nearMissCount = approvedReports.filter(r => r.kategori === 'Near Miss').length;
  const nmrrNum = (nearMissCount / TOTAL_KARYAWAN) * 100;
  const nmrrValue = nmrrNum.toFixed(1) + '%';

  // 2. SOR = (Jumlah total observasi / Total Karyawan) × 100
  const observationCount = approvedReports.filter(
    r => r.kategori === 'Kondisi Tidak Aman' || r.kategori === 'Tindakan Tidak Aman'
  ).length;
  const sorNum = (observationCount / TOTAL_KARYAWAN) * 100;
  const sorValue = sorNum.toFixed(1) + '%';

  // 3. CACR = (Jumlah tindakan korektif ditutup / Total temuan NMRR+SOR) × 100%
  const totalTemuanNmrrSor = nearMissCount + observationCount;
  const solvedTemuanCount = approvedReports.filter(
    r => (r.status === 'selesai' || r.status === 'disetujui') &&
         (r.kategori === 'Near Miss' || r.kategori === 'Kondisi Tidak Aman' || r.kategori === 'Tindakan Tidak Aman')
  ).length;
  const cacrNum = totalTemuanNmrrSor > 0 ? (solvedTemuanCount / totalTemuanNmrrSor) * 100 : 0;
  const cacrValue = cacrNum.toFixed(1) + '%';

  // 4. TRIR = (Jumlah insiden tercatat / Total Jam Kerja) × Konstanta × 1/12
  const recordableCategories = ['First Aid Case', 'Medical Treatment', 'Lost Time Injury', 'Permanent Disability', 'Fatality'];
  const trirCount = approvedReports.filter(r => recordableCategories.includes(r.kategori)).length;
  const trirNum = TOTAL_JAM_KERJA > 0 ? (trirCount / TOTAL_JAM_KERJA) * KONSTANTA_OSHA * (1 / 12) : 0;
  const trirValue = trirNum.toFixed(2);

  // 5. LTIFR = (Jumlah LTI tercatat / Total Jam Kerja) × Konstanta × 1/12
  const ltiCount = approvedReports.filter(r => r.kategori === 'Lost Time Injury').length;
  const ltifrNum = TOTAL_JAM_KERJA > 0 ? (ltiCount / TOTAL_JAM_KERJA) * KONSTANTA_OSHA * (1 / 12) : 0;
  const ltifrValue = ltifrNum.toFixed(2);

  // 6. Fatality Rate = Manual input dari Admin K3 (jumlahFatality di settings)
  const fatalityCount = k3Settings?.jumlahFatality || 0;
  const fatalityExists = fatalityCount > 0;
  const fatalityValue = fatalityExists ? `${fatalityCount} (Ada)` : 'Tidak Ada';

  // Closure rate (for progress bar)
  const solvedReports = approvedReports.length;
  const solveRate = incomingReports > 0 ? Math.round((solvedReports / incomingReports) * 100) : 0;

  const dynamicMetrics = [
    { id: 'NMRR', title: 'Near Miss Reporting', value: nmrrValue, classObj: getMetricClassification('NMRR', nmrrNum), icon: AlertTriangle, color: 'text-blue-600', light: 'bg-blue-50 border-blue-100' },
    { id: 'SOR', title: 'Safety Observation', value: sorValue, classObj: getMetricClassification('SOR', sorNum), icon: Eye, color: 'text-emerald-600', light: 'bg-emerald-50 border-emerald-100' },
    { id: 'CACR', title: 'Corrective Action', value: cacrValue, classObj: getMetricClassification('CACR', cacrNum), icon: ClipboardCheck, color: 'text-violet-600', light: 'bg-violet-50 border-violet-100' },
    { id: 'TRIR', title: 'Incident Rate', value: trirValue, classObj: getMetricClassification('TRIR', trirNum), icon: HeartPulse, color: 'text-amber-600', light: 'bg-amber-50 border-amber-100' },
    { id: 'LTIFR', title: 'Injury Frequency', value: ltifrValue, classObj: getMetricClassification('LTIFR', ltifrNum), icon: Stethoscope, color: 'text-indigo-600', light: 'bg-indigo-50 border-indigo-100' },
    { id: 'FATALITY', title: 'Fatality Rate', value: fatalityValue, classObj: fatalityExists ? { label: 'Bahaya', color: 'bg-rose-100 text-rose-700' } : { label: 'Aman', color: 'bg-emerald-100 text-emerald-700' }, icon: AlertOctagon, color: 'text-rose-600', light: 'bg-rose-50 border-rose-100' },
  ];

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
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {dynamicMetrics.map((m) => {
              const Icon = m.icon;
              return (
                <div key={m.id} className={cn("p-2 lg:p-3 rounded-xl border flex flex-col transition-all hover:shadow-md", m.light)}>
                  <div className="flex items-center justify-between mb-1.5">
                    <div className={cn("p-1 rounded-lg bg-white shadow-sm")}>
                      <Icon size={12} className={m.color} />
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <span className={cn("text-[8px] font-black uppercase tracking-wider opacity-60", m.color)}>{m.id}</span>
                      {m.classObj && (
                        <span className={cn("text-[7px] px-1.5 py-0.5 rounded font-bold uppercase", m.classObj.color)}>
                          {m.classObj.label}
                        </span>
                      )}
                    </div>
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
