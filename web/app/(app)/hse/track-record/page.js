'use client';

import { useState, useEffect } from 'react';
import { apiGet } from '@/lib/api';
import { toast } from 'sonner';
import {
  BarChart2, ShieldCheck, Users, Building2,
  RefreshCw, TrendingUp, Award, ClipboardList,
  Search, Wrench, FileSearch, CheckCircle2,
  AlertTriangle, Eye, Flame, HeartPulse,
  Stethoscope, Skull, Lightbulb, ListChecks,
  ChevronRight,
} from 'lucide-react';
import { cn } from '@/lib/utils';

// Kategori icon mapping
const CATEGORY_ICONS = {
  'Kondisi Tidak Aman': AlertTriangle,
  'Tindakan Tidak Aman': Eye,
  'Near Miss': AlertTriangle,
  'First Aid Case': HeartPulse,
  'Medical Treatment': Stethoscope,
  'Lost Time Injury': Wrench,
  'Permanent Disability': Skull,
  'Fatality': Flame,
  'Ide perbaikan K3': Lightbulb,
  'Lainnya': ListChecks,
};

const CATEGORY_COLORS = {
  'Kondisi Tidak Aman': 'bg-amber-500',
  'Tindakan Tidak Aman': 'bg-orange-500',
  'Near Miss': 'bg-yellow-500',
  'First Aid Case': 'bg-blue-500',
  'Medical Treatment': 'bg-indigo-500',
  'Lost Time Injury': 'bg-violet-500',
  'Permanent Disability': 'bg-rose-500',
  'Fatality': 'bg-red-600',
  'Ide perbaikan K3': 'bg-emerald-500',
  'Lainnya': 'bg-slate-400',
};

export default function HseTrackRecordPage() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    try {
      const res = await apiGet('/k3-safety/stats');
      setStats(res.data);
    } catch (e) {
      toast.error('Gagal memuat statistik K3: ' + e.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  if (loading) return (
    <div className="flex flex-col items-center justify-center h-[80vh] text-slate-400">
      <RefreshCw className="animate-spin mb-3" size={36} />
      <p className="text-sm font-medium">Memuat statistik K3...</p>
    </div>
  );

  if (!stats) return null;

  const completionRate = stats.totalReports > 0
    ? Math.round((stats.totalSelesai / stats.totalReports) * 100)
    : 0;

  return (
    <div className="p-4 sm:p-6 md:p-8 max-w-7xl mx-auto space-y-6 sm:space-y-8">
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5 mb-1">
            <div className="p-2 bg-rose-600 rounded-xl shadow-lg shadow-rose-200">
              <BarChart2 size={20} className="text-white" />
            </div>
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
              Track Record K3
            </h1>
          </div>
          <p className="text-slate-500 text-xs sm:text-sm ml-11">
            Leaderboard pelapor teraktif & petugas HSE berdasarkan data laporan K3.
          </p>
        </div>
        <button
          onClick={load}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-medium text-slate-600 hover:bg-slate-50 transition-all shadow-sm"
        >
          <RefreshCw size={14} className={cn(loading && 'animate-spin')} />
          Segarkan
        </button>
      </div>

      {/* ── Performance Banner ─────────────────────────────────────────── */}
      <div className="relative overflow-hidden bg-slate-900 rounded-2xl sm:rounded-3xl p-5 sm:p-8 text-white shadow-2xl">
        <div className="relative z-10 grid grid-cols-2 sm:grid-cols-4 gap-4 sm:gap-6">
          <BannerStat
            label="Total Laporan"
            value={stats.totalReports}
            icon={ClipboardList}
            accentColor="text-rose-400"
          />
          <BannerStat
            label="Selesai"
            value={stats.totalSelesai}
            sub={`${completionRate}% tingkat penyelesaian`}
            icon={CheckCircle2}
            accentColor="text-emerald-400"
          />
          <BannerStat
            label="Investigasi"
            value={stats.totalInvestigasi}
            icon={FileSearch}
            accentColor="text-indigo-400"
          />
          <BannerStat
            label="Perbaikan Langsung"
            value={stats.totalPerbaikanLangsung}
            icon={Wrench}
            accentColor="text-amber-400"
          />
        </div>
        {/* Background elements */}
        <div className="absolute top-0 right-0 w-96 h-96 bg-rose-600/10 blur-[100px] -mr-48 -mt-48 rounded-full" />
        <div className="absolute bottom-0 left-0 w-64 h-64 bg-blue-600/10 blur-[100px] -ml-32 -mb-32 rounded-full" />
      </div>

      {/* ── Summary Cards ──────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <SummaryCard
          label="Total Laporan K3"
          value={stats.totalReports}
          icon={ClipboardList}
          color="bg-rose-500"
          lightColor="bg-rose-50"
          textColor="text-rose-600"
        />
        <SummaryCard
          label="Top Pelapor"
          value={stats.reporters[0]?.name || '-'}
          sub={`${stats.reporters[0]?.count || 0} laporan`}
          icon={Award}
          color="bg-amber-500"
          lightColor="bg-amber-50"
          textColor="text-amber-600"
        />
        <SummaryCard
          label="Top Petugas HSE"
          value={stats.hseOfficers[0]?.name || '-'}
          sub={`${stats.hseOfficers[0]?.count || 0} penugasan`}
          icon={Users}
          color="bg-indigo-500"
          lightColor="bg-indigo-50"
          textColor="text-indigo-600"
        />
        <SummaryCard
          label="Tingkat Penyelesaian"
          value={`${completionRate}%`}
          sub={`${stats.totalSelesai} dari ${stats.totalReports}`}
          icon={CheckCircle2}
          color="bg-emerald-500"
          lightColor="bg-emerald-50"
          textColor="text-emerald-600"
        />
      </div>

      {/* ── Ranking Tables ─────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
        {/* Pelapor Teraktif */}
        <RankingTable
          title="Pelapor Teraktif"
          subtitle="Berdasarkan jumlah laporan K3 yang dibuat"
          icon={Award}
          data={stats.reporters.map(r => ({
            id: r.id,
            name: r.name,
            sub: `${r.dinas} — ${r.divisi}`,
            count: r.count,
            countLabel: 'Laporan',
            extra: r.selesai > 0 ? `${r.selesai} selesai` : null,
          }))}
          total={stats.totalReports}
          accentColor="bg-rose-500"
          lightAccent="bg-rose-50"
          textAccent="text-rose-600"
        />

        {/* Petugas HSE Teraktif */}
        <RankingTable
          title="Petugas HSE Teraktif"
          subtitle="Berdasarkan jumlah penugasan lapangan"
          icon={Users}
          data={stats.hseOfficers.map(o => ({
            id: o.id,
            name: o.name,
            sub: o.dinas,
            count: o.count,
            countLabel: 'Tugas',
            extra: o.count > 0 ? `🔧${o.perbaikan} 🔍${o.investigasi}` : null,
          }))}
          total={stats.totalReports}
          accentColor="bg-indigo-500"
          lightAccent="bg-indigo-50"
          textAccent="text-indigo-600"
        />

        {/* Kategori Temuan */}
        <CategoryRanking
          categories={stats.categories}
          total={stats.totalReports}
        />
      </div>
    </div>
  );
}

// ── Sub-components ──────────────────────────────────────────────────────

function BannerStat({ label, value, sub, icon: Icon, accentColor }) {
  return (
    <div className="space-y-1">
      <div className="flex items-center gap-2 mb-2">
        <Icon size={16} className={accentColor} />
        <span className="text-[10px] sm:text-[11px] text-slate-400 uppercase tracking-wider font-bold">{label}</span>
      </div>
      <p className="text-2xl sm:text-3xl font-black text-white">{value}</p>
      {sub && <p className="text-[10px] text-slate-500">{sub}</p>}
    </div>
  );
}

function SummaryCard({ label, value, sub, icon: Icon, color, lightColor, textColor }) {
  return (
    <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-all duration-300 flex items-start gap-4">
      <div className={cn("w-11 h-11 rounded-xl flex items-center justify-center shrink-0 shadow-inner", color)}>
        <Icon className="text-white" size={22} />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-xs font-medium text-slate-500 truncate">{label}</p>
        <p className="text-xl font-bold text-slate-900 mt-0.5 truncate">{value}</p>
        {sub && <p className="text-[11px] text-slate-400 mt-1">{sub}</p>}
      </div>
    </div>
  );
}

function RankingTable({ title, subtitle, icon: Icon, data, total, accentColor, lightAccent, textAccent }) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
      <div className="px-5 py-4 border-b border-slate-100 bg-slate-50/50">
        <div className="flex items-center gap-2">
          <div className={cn("p-1.5 rounded-lg", lightAccent)}>
            <Icon size={16} className={textAccent} />
          </div>
          <div>
            <h3 className="font-semibold text-slate-800 text-sm">{title}</h3>
            <p className="text-[10px] text-slate-400 mt-0.5">{subtitle}</p>
          </div>
        </div>
      </div>
      <div className="p-4 sm:p-5 flex-1 space-y-3 sm:space-y-4 overflow-y-auto max-h-[420px]">
        {data.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 text-slate-300 italic text-sm">
            Belum ada data
          </div>
        ) : data.map((item, idx) => {
          const percentage = total > 0 ? Math.round((item.count / total) * 100) : 0;
          return (
            <div key={item.id} className="space-y-1.5">
              <div className="flex items-center justify-between text-sm gap-2">
                <div className="flex items-center gap-2 min-w-0 flex-1">
                  {idx < 3 && item.count > 0 ? (
                    <span className={cn(
                      'inline-flex items-center justify-center w-6 h-6 rounded-full text-[10px] font-bold shrink-0',
                      idx === 0 && 'bg-yellow-400 text-white shadow-sm',
                      idx === 1 && 'bg-slate-300 text-slate-700',
                      idx === 2 && 'bg-amber-600 text-white',
                    )}>
                      {idx + 1}
                    </span>
                  ) : (
                    <span className="text-xs font-bold text-slate-300 w-6 text-center shrink-0">{idx + 1}</span>
                  )}
                  <div className="min-w-0 flex-1">
                    <span className="font-medium text-slate-700 truncate block text-sm">{item.name}</span>
                    {item.sub && <span className="text-[10px] text-slate-400 truncate block">{item.sub}</span>}
                  </div>
                </div>
                <div className="flex flex-col items-end shrink-0">
                  <span className="font-bold text-slate-900 text-sm">
                    {item.count}
                    <span className="text-[10px] text-slate-400 font-normal uppercase ml-1">{item.countLabel}</span>
                  </span>
                  {item.extra && (
                    <span className="text-[10px] text-slate-400 mt-0.5">{item.extra}</span>
                  )}
                </div>
              </div>
              <div className="relative h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                <div
                  className={cn("absolute inset-y-0 left-0 rounded-full transition-all duration-700", accentColor)}
                  style={{ width: `${Math.max(percentage, 2)}%` }}
                />
              </div>
              <p className="text-[10px] text-slate-400 text-right">{percentage}% dari total</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function CategoryRanking({ categories, total }) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
      <div className="px-5 py-4 border-b border-slate-100 bg-slate-50/50">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-emerald-50">
            <ShieldCheck size={16} className="text-emerald-600" />
          </div>
          <div>
            <h3 className="font-semibold text-slate-800 text-sm">Kategori Temuan</h3>
            <p className="text-[10px] text-slate-400 mt-0.5">Distribusi laporan per jenis temuan</p>
          </div>
        </div>
      </div>
      <div className="p-4 sm:p-5 flex-1 space-y-3 overflow-y-auto max-h-[420px]">
        {categories.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 text-slate-300 italic text-sm">
            Belum ada data
          </div>
        ) : categories.map((cat, idx) => {
          const percentage = total > 0 ? Math.round((cat.count / total) * 100) : 0;
          const CatIcon = CATEGORY_ICONS[cat.name] || ListChecks;
          const barColor = CATEGORY_COLORS[cat.name] || 'bg-slate-400';
          return (
            <div key={cat.name} className="space-y-1.5">
              <div className="flex items-center justify-between text-sm gap-2">
                <div className="flex items-center gap-2.5 min-w-0 flex-1">
                  <div className={cn("w-7 h-7 rounded-lg flex items-center justify-center shrink-0", barColor)}>
                    <CatIcon size={14} className="text-white" />
                  </div>
                  <span className="font-medium text-slate-700 truncate text-sm">{cat.name}</span>
                </div>
                <span className="font-bold text-slate-900 shrink-0 text-sm">
                  {cat.count}
                  <span className="text-[10px] text-slate-400 font-normal ml-1">({percentage}%)</span>
                </span>
              </div>
              <div className="relative h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                <div
                  className={cn("absolute inset-y-0 left-0 rounded-full transition-all duration-700", barColor)}
                  style={{ width: `${Math.max(percentage, 2)}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
