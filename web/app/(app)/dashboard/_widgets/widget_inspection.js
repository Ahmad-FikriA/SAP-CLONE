'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  AlertTriangle,
  ArrowRight,
  CalendarClock,
  CheckCircle2,
  ClipboardList,
  Clock3,
  FileCheck2,
  RefreshCw,
} from 'lucide-react';
import { apiGet } from '@/lib/api';
import { canRead } from '@/lib/auth';
import {
  fetchInspeksiSchedules,
  INSPEKSI_STATUS_META,
  INSPEKSI_TYPE_LABELS,
  resolveInspeksiTypeLabel,
} from '@/lib/inspeksi-service';

const TYPE_COLORS = {
  inspeksi: 'bg-blue-500',
  rutin: 'bg-emerald-500',
  k3: 'bg-amber-500',
  supervisi: 'bg-violet-500',
};

function readArray(payload) {
  return Array.isArray(payload?.data) ? payload.data : (Array.isArray(payload) ? payload : []);
}

function getAppDateString(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Jakarta',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date).reduce((acc, part) => {
    if (part.type !== 'literal') acc[part.type] = part.value;
    return acc;
  }, {});
  return `${parts.year}-${parts.month}-${parts.day}`;
}

function formatDate(value) {
  if (!value) return '-';
  return new Date(value).toLocaleDateString('id-ID', {
    timeZone: 'Asia/Jakarta',
    day: '2-digit',
    month: 'short',
  });
}

function typeKey(schedule) {
  if (schedule.userRequest || schedule.triggerSource === 'user_darurat') return 'inspeksi';
  return schedule.type || 'rutin';
}

function SmallMetric({ icon: Icon, label, value, tone }) {
  const tones = {
    blue: 'bg-blue-50 text-blue-700 border-blue-100',
    amber: 'bg-amber-50 text-amber-700 border-amber-100',
    emerald: 'bg-emerald-50 text-emerald-700 border-emerald-100',
    rose: 'bg-rose-50 text-rose-700 border-rose-100',
  };

  return (
    <div className={`rounded-lg border p-2.5 lg:p-3 ${tones[tone] || tones.blue}`}>
      <div className="flex items-center gap-2 mb-1">
        <Icon size={13} />
        <span className="text-[10px] font-bold uppercase tracking-wide">{label}</span>
      </div>
      <p className="text-xl lg:text-2xl font-extrabold leading-none">{value}</p>
    </div>
  );
}

function StatusPill({ status }) {
  const meta = INSPEKSI_STATUS_META[status] || { label: status || '-', variant: 'scheduled' };
  const cls = {
    scheduled: 'bg-amber-50 text-amber-700 border-amber-100',
    in_progress: 'bg-blue-50 text-blue-700 border-blue-100',
    completed: 'bg-emerald-50 text-emerald-700 border-emerald-100',
    cancelled: 'bg-rose-50 text-rose-700 border-rose-100',
  }[meta.variant] || 'bg-slate-50 text-slate-600 border-slate-100';

  return (
    <span className={`px-2 py-0.5 rounded-full border text-[10px] font-bold whitespace-nowrap ${cls}`}>
      {meta.label}
    </span>
  );
}

export function WidgetInspection() {
  const [schedules, setSchedules] = useState([]);
  const [pendingRequests, setPendingRequests] = useState(null);
  const [submittedReports, setSubmittedReports] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const [scheduleRes, requestRes, reportRes] = await Promise.allSettled([
        fetchInspeksiSchedules(),
        apiGet('/inspection/requests?status=pending'),
        apiGet('/inspection/reports?status=submitted'),
      ]);

      if (scheduleRes.status === 'rejected') throw scheduleRes.reason;

      setSchedules(Array.isArray(scheduleRes.value) ? scheduleRes.value : []);
      setPendingRequests(requestRes.status === 'fulfilled' ? readArray(requestRes.value).length : null);
      setSubmittedReports(reportRes.status === 'fulfilled' ? readArray(reportRes.value).length : null);
    } catch (e) {
      setError(e?.message || 'Gagal memuat data inspeksi');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  const data = useMemo(() => {
    const today = getAppDateString();
    const active = schedules.filter((s) => ['scheduled', 'in_progress'].includes(s.status));
    const completed = schedules.filter((s) => s.status === 'completed');
    const cancelled = schedules.filter((s) => s.status === 'cancelled');
    const effectiveTotal = Math.max(0, schedules.length - cancelled.length);
    const completionRate = effectiveTotal > 0 ? Math.round((completed.length / effectiveTotal) * 100) : 0;
    const overdue = active.filter((s) => String(s.scheduledDate || '').slice(0, 10) < today);

    const typeCounts = ['inspeksi', 'rutin', 'k3', 'supervisi'].map((key) => ({
      key,
      label: INSPEKSI_TYPE_LABELS[key],
      value: schedules.filter((s) => typeKey(s) === key).length,
    })).filter((item) => item.value > 0);

    const nextSchedules = [...active]
      .sort((a, b) => String(a.scheduledDate || '').localeCompare(String(b.scheduledDate || '')))
      .slice(0, 3);

    return { active, completed, completionRate, overdue, typeCounts, nextSchedules };
  }, [schedules]);

  if (!canRead('inspeksi')) return null;

  return (
    <div className="bg-white border border-slate-200 rounded-xl overflow-hidden flex flex-col h-full shadow-sm hover:shadow-md transition-shadow">
      <div className="flex items-center justify-between px-4 py-3 lg:px-5 lg:py-4 border-b border-slate-100 bg-slate-50/60">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-9 h-9 rounded-lg bg-blue-600 flex items-center justify-center shrink-0">
            <ClipboardList size={18} className="text-white" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-bold text-slate-800 tracking-tight">Inspeksi</p>
            <p className="text-[11px] text-slate-500 font-medium truncate">SPK, request, dan approval laporan</p>
          </div>
        </div>
        <button
          onClick={load}
          disabled={loading}
          className="p-2 rounded-lg hover:bg-slate-100 text-slate-400 transition-colors"
          title="Refresh"
        >
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      {loading ? (
        <div className="flex-1 flex items-center justify-center py-12 text-slate-400 text-sm">Memuat data inspeksi...</div>
      ) : error ? (
        <div className="flex-1 flex items-center justify-center py-12 text-rose-500 text-sm">{error}</div>
      ) : (
        <div className="flex-1 p-4 lg:p-5 space-y-4 lg:space-y-5">
          <div className="grid grid-cols-2 gap-3">
            <SmallMetric icon={CalendarClock} label="Aktif" value={data.active.length} tone="blue" />
            <SmallMetric icon={CheckCircle2} label="Selesai" value={data.completed.length} tone="emerald" />
            <SmallMetric icon={Clock3} label="Request" value={pendingRequests ?? '-'} tone="amber" />
            <SmallMetric icon={FileCheck2} label="Approval" value={submittedReports ?? '-'} tone="rose" />
          </div>

          <div className="rounded-lg border border-slate-100 bg-slate-50 p-3">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">Penyelesaian SPK</span>
              <span className="text-xs font-extrabold text-emerald-700">{data.completionRate}%</span>
            </div>
            <div className="h-2 bg-slate-200 rounded-full overflow-hidden">
              <div className="h-full bg-emerald-500 rounded-full transition-all duration-700" style={{ width: `${data.completionRate}%` }} />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3">Komposisi Tipe</p>
              <div className="space-y-2">
                {data.typeCounts.length > 0 ? data.typeCounts.map((item) => (
                  <div key={item.key} className="flex items-center gap-2">
                    <span className={`w-2.5 h-2.5 rounded-full ${TYPE_COLORS[item.key] || 'bg-slate-400'}`} />
                    <span className="text-xs font-semibold text-slate-600 flex-1">{item.label}</span>
                    <span className="text-xs font-extrabold text-slate-800">{item.value}</span>
                  </div>
                )) : (
                  <p className="text-xs text-slate-400">Belum ada data tipe</p>
                )}
              </div>
            </div>

            <div className="rounded-lg border border-amber-100 bg-amber-50 p-3">
              <div className="flex items-center gap-2 text-amber-700 mb-1">
                <AlertTriangle size={14} />
                <span className="text-[10px] font-bold uppercase tracking-wide">Perlu Perhatian</span>
              </div>
              <p className="text-2xl font-extrabold text-amber-800">{data.overdue.length}</p>
              <p className="text-[11px] text-amber-700 mt-1">SPK aktif melewati tanggal jadwal</p>
            </div>
          </div>

          <div className="pt-1">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3">Jadwal Aktif Terdekat</p>
            {data.nextSchedules.length > 0 ? (
              <div className="space-y-2">
                {data.nextSchedules.map((schedule) => (
                  <div key={schedule.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-slate-50 transition-colors">
                    <div className="w-10 shrink-0 text-center">
                      <p className="text-[11px] font-extrabold text-slate-800">{formatDate(schedule.scheduledDate)}</p>
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-bold text-slate-800 truncate">{schedule.title || '-'}</p>
                      <p className="text-[10px] text-slate-500 truncate">{resolveInspeksiTypeLabel(schedule)} - {schedule.location || '-'}</p>
                    </div>
                    <StatusPill status={schedule.status} />
                  </div>
                ))}
              </div>
            ) : (
              <div className="rounded-lg border border-dashed border-slate-200 py-5 text-center text-xs font-semibold text-slate-400">
                Tidak ada SPK aktif
              </div>
            )}
          </div>
        </div>
      )}

      <div className="px-4 py-2.5 lg:px-5 lg:py-3 border-t border-slate-100 bg-slate-50/70 mt-auto">
        <Link href="/inspeksi" className="flex items-center justify-center gap-1.5 text-xs font-bold text-blue-600 hover:text-blue-700 transition-colors">
          Buka Monitoring Inspeksi <ArrowRight size={14} />
        </Link>
      </div>
    </div>
  );
}
