'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  AlertTriangle,
  ArrowRight,
  Banknote,
  Briefcase,
  CheckCircle2,
  FileEdit,
  MapPin,
  RefreshCw,
  Route,
} from 'lucide-react';
import { canRead } from '@/lib/auth';
import { fetchSupervisiJobs, SUPERVISI_STATUS_META } from '@/lib/supervisi-service';

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

function addDays(dateString, days) {
  const [year, month, day] = String(dateString).split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().split('T')[0];
}

function daysInclusive(start, end) {
  if (!start || !end) return 0;
  const [sy, sm, sd] = String(start).slice(0, 10).split('-').map(Number);
  const [ey, em, ed] = String(end).slice(0, 10).split('-').map(Number);
  const startDate = Date.UTC(sy, sm - 1, sd);
  const endDate = Date.UTC(ey, em - 1, ed);
  if (!Number.isFinite(startDate) || !Number.isFinite(endDate) || endDate < startDate) return 0;
  return Math.floor((endDate - startDate) / 86400000) + 1;
}

function effectiveEndDate(job) {
  const candidates = [
    job.waktuBerakhir,
    job.amendBerakhir,
    ...(Array.isArray(job.amends) ? job.amends.map((amend) => amend?.amendBerakhir) : []),
  ].map((value) => String(value || '').slice(0, 10)).filter(Boolean);
  return candidates.sort().at(-1) || null;
}

function locationCount(job) {
  if (Array.isArray(job.locations) && job.locations.length > 0) return job.locations.length;
  return job.latitude && job.longitude ? 1 : 0;
}

function jobProgress(job) {
  const locCount = Math.max(1, locationCount(job));
  const expected = daysInclusive(String(job.waktuMulai || '').slice(0, 10), effectiveEndDate(job)) * locCount;
  const finalVisits = Array.isArray(job.visits) ? job.visits.filter((visit) => !visit.isDraft).length : 0;
  if (job.status === 'completed') return 100;
  if (expected <= 0) return 0;
  return Math.min(100, Math.round((finalVisits / expected) * 100));
}

function formatDate(value) {
  if (!value) return '-';
  return new Date(value).toLocaleDateString('id-ID', {
    timeZone: 'Asia/Jakarta',
    day: '2-digit',
    month: 'short',
  });
}

function jobLatestTime(job) {
  const value = job.updatedAt || job.createdAt || job.waktuMulai || effectiveEndDate(job);
  const time = Date.parse(value);
  return Number.isFinite(time) ? time : 0;
}

function formatRupiah(value) {
  const amount = Number(value || 0);
  if (amount >= 1e9) return `Rp ${(amount / 1e9).toFixed(1)} M`;
  if (amount >= 1e6) return `Rp ${(amount / 1e6).toFixed(1)} Jt`;
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0,
  }).format(amount);
}

function SummaryBox({ icon: Icon, label, value, className }) {
  return (
    <div className={`rounded-lg border p-3 ${className}`}>
      <div className="flex items-center gap-2 mb-1">
        <Icon size={14} />
        <span className="text-[10px] font-bold uppercase tracking-wide">{label}</span>
      </div>
      <p className="text-2xl font-extrabold leading-none">{value}</p>
    </div>
  );
}

function StatusPill({ status }) {
  const meta = SUPERVISI_STATUS_META[status] || { label: status || '-', color: 'bg-slate-100 text-slate-600' };
  return (
    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold whitespace-nowrap ${meta.color}`}>
      {meta.label}
    </span>
  );
}

export function WidgetSupervisi() {
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      setJobs(await fetchSupervisiJobs());
    } catch (e) {
      setError(e?.message || 'Gagal memuat data supervisi');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  const data = useMemo(() => {
    const today = getAppDateString();
    const nextWeek = addDays(today, 7);
    const active = jobs.filter((job) => job.status === 'active');
    const completed = jobs.filter((job) => job.status === 'completed');
    const draft = jobs.filter((job) => job.status === 'draft');
    const relevant = jobs.filter((job) => job.status === 'active' || job.status === 'completed');
    const totalNilai = relevant.reduce((sum, job) => sum + (Number(job.nilaiPekerjaan) || 0), 0);
    const violations = jobs.reduce((count, job) => (
      count + (Array.isArray(job.visits) ? job.visits.filter((visit) => visit.isPelanggaran).length : 0)
    ), 0);

    const expectedVisits = relevant.reduce((sum, job) => (
      sum + daysInclusive(String(job.waktuMulai || '').slice(0, 10), effectiveEndDate(job)) * Math.max(1, locationCount(job))
    ), 0);
    const finalVisits = relevant.reduce((sum, job) => (
      sum + (Array.isArray(job.visits) ? job.visits.filter((visit) => !visit.isDraft).length : 0)
    ), 0);
    const progress = expectedVisits > 0 ? Math.min(100, Math.round((finalVisits / expectedVisits) * 100)) : 0;

    const dueSoon = active.filter((job) => {
      const end = effectiveEndDate(job);
      return end && end >= today && end <= nextWeek;
    });

    const latestJobs = [...jobs]
      .sort((a, b) => jobLatestTime(b) - jobLatestTime(a))
      .slice(0, 5);

    return { active, completed, draft, totalNilai, violations, progress, dueSoon, latestJobs };
  }, [jobs]);

  if (!canRead('supervisi')) return null;

  return (
    <div className="bg-white border border-slate-200 rounded-xl overflow-hidden flex flex-col h-full shadow-sm hover:shadow-md transition-shadow">
      <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 bg-slate-50/60">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-9 h-9 rounded-lg bg-emerald-600 flex items-center justify-center shrink-0">
            <MapPin size={18} className="text-white" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-bold text-slate-800 tracking-tight">Supervisi</p>
            <p className="text-[11px] text-slate-500 font-medium truncate">Progress JO, kunjungan, dan pelanggaran</p>
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
        <div className="flex-1 flex items-center justify-center py-12 text-slate-400 text-sm">Memuat data supervisi...</div>
      ) : error ? (
        <div className="flex-1 flex items-center justify-center py-12 text-rose-500 text-sm">{error}</div>
      ) : (
        <div className="flex-1 p-5 space-y-5">
          <div className="grid grid-cols-2 gap-3">
            <SummaryBox icon={Briefcase} label="JO Aktif" value={data.active.length} className="bg-emerald-50 text-emerald-700 border-emerald-100" />
            <SummaryBox icon={CheckCircle2} label="Selesai" value={data.completed.length} className="bg-blue-50 text-blue-700 border-blue-100" />
            <SummaryBox icon={FileEdit} label="Draft" value={data.draft.length} className="bg-slate-50 text-slate-700 border-slate-100" />
            <SummaryBox icon={AlertTriangle} label="Pelanggaran" value={data.violations} className="bg-rose-50 text-rose-700 border-rose-100" />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="rounded-lg border border-emerald-100 bg-emerald-50 p-3">
              <div className="flex items-center gap-2 text-emerald-700 mb-1">
                <Banknote size={14} />
                <span className="text-[10px] font-bold uppercase tracking-wide">Nilai Aktif + Selesai</span>
              </div>
              <p className="text-xl font-extrabold text-emerald-800 truncate">{formatRupiah(data.totalNilai)}</p>
            </div>

            <div className="rounded-lg border border-amber-100 bg-amber-50 p-3">
              <div className="flex items-center gap-2 text-amber-700 mb-1">
                <Route size={14} />
                <span className="text-[10px] font-bold uppercase tracking-wide">Berakhir 7 Hari</span>
              </div>
              <p className="text-xl font-extrabold text-amber-800">{data.dueSoon.length} job</p>
            </div>
          </div>

          <div className="rounded-lg border border-slate-100 bg-slate-50 p-3">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">Progress Kunjungan</span>
              <span className="text-xs font-extrabold text-emerald-700">{data.progress}%</span>
            </div>
            <div className="h-2 bg-slate-200 rounded-full overflow-hidden">
              <div className="h-full bg-emerald-500 rounded-full transition-all duration-700" style={{ width: `${data.progress}%` }} />
            </div>
          </div>

          <div className="pt-1">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3">5 Job Terbaru</p>
            {data.latestJobs.length > 0 ? (
              <div className="space-y-2">
                {data.latestJobs.map((job) => {
                  const progress = jobProgress(job);
                  return (
                    <div key={job.id} className="p-2 rounded-lg hover:bg-slate-50 transition-colors">
                      <div className="flex items-center gap-3">
                        <div className="w-10 shrink-0 text-center">
                          <p className="text-[11px] font-extrabold text-slate-800">{formatDate(job.updatedAt || job.createdAt || job.waktuMulai)}</p>
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-bold text-slate-800 truncate">{job.namaKerja || job.nomorJo || '-'}</p>
                          <p className="text-[10px] text-slate-500 truncate">{job.picSupervisi || '-'} - {locationCount(job)} lokasi</p>
                        </div>
                        <StatusPill status={job.status} />
                      </div>
                      <div className="mt-2 ml-[52px] h-1.5 bg-slate-100 rounded-full overflow-hidden">
                        <div className="h-full bg-blue-500 rounded-full" style={{ width: `${progress}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="rounded-lg border border-dashed border-slate-200 py-5 text-center text-xs font-semibold text-slate-400">
                Belum ada job supervisi
              </div>
            )}
          </div>
        </div>
      )}

      <div className="px-5 py-3 border-t border-slate-100 bg-slate-50/70 mt-auto">
        <Link href="/supervisi" className="flex items-center justify-center gap-1.5 text-xs font-bold text-emerald-700 hover:text-emerald-800 transition-colors">
          Buka Monitoring Supervisi <ArrowRight size={14} />
        </Link>
      </div>
    </div>
  );
}
