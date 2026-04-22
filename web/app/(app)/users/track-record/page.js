'use client';

import { useState, useEffect, Fragment } from 'react';
import { toast } from 'sonner';
import { apiGet } from '@/lib/api';
import { formatDate } from '@/lib/date-utils';
import { STATUS_LABELS, CATEGORY_COLORS } from '@/lib/constants';
import { RefreshCw, ChevronDown, ChevronRight, ExternalLink, Users, ClipboardList, CheckCircle2 } from 'lucide-react';
import { cn } from '@/lib/utils';

const STATUS_BADGE = {
  approved:                  'bg-green-100 text-green-700',
  completed:                 'bg-green-100 text-green-700',
  awaiting_kasie:            'bg-amber-100 text-amber-700',
  awaiting_kadis_perawatan:  'bg-blue-100 text-blue-700',
  awaiting_kadis:            'bg-purple-100 text-purple-700',
  in_progress:               'bg-cyan-100 text-cyan-700',
  rejected:                  'bg-red-100 text-red-700',
};

function spkBadgeColor(total) {
  if (total === 0) return 'bg-gray-100 text-gray-400';
  if (total >= 20) return 'bg-blue-600 text-white';
  if (total >= 10) return 'bg-blue-100 text-blue-700';
  return 'bg-slate-100 text-slate-600';
}

function StatusBadge({ status }) {
  const label = STATUS_LABELS[status] || status;
  const color = STATUS_BADGE[status] || 'bg-gray-100 text-gray-600';
  return <span className={`px-2 py-0.5 rounded text-xs font-semibold ${color}`}>{label}</span>;
}

function CategoryBadge({ category }) {
  const style = CATEGORY_COLORS[category] || {};
  return (
    <span
      className="px-2 py-0.5 rounded text-xs font-semibold"
      style={{ backgroundColor: style.bg, color: style.text }}
    >
      {category}
    </span>
  );
}

function SummaryCard({ icon: Icon, label, value, sub, color }) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4 flex items-center gap-4">
      <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${color}`}>
        <Icon size={20} />
      </div>
      <div>
        <p className="text-2xl font-bold text-gray-900 leading-none">{value}</p>
        <p className="text-xs text-gray-500 mt-1">{label}</p>
        {sub && <p className="text-[11px] text-gray-400 mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}

export default function TrackRecordPage() {
  const [stats, setStats] = useState([]);
  const [loading, setLoading] = useState(true);
  const [onlyActive, setOnlyActive] = useState(false);
  const [expandedId, setExpandedId] = useState(null);
  const [drillData, setDrillData] = useState({});
  const [drillLoading, setDrillLoading] = useState(false);

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    try {
      const data = await apiGet('/users/stats');
      const sorted = [...data].sort((a, b) => b.totalSpk - a.totalSpk);
      setStats(sorted);
    } catch (e) {
      toast.error('Gagal memuat statistik: ' + e.message);
    } finally {
      setLoading(false);
    }
  }

  async function toggleRow(userId) {
    if (expandedId === userId) { setExpandedId(null); return; }
    setExpandedId(userId);
    if (drillData[userId]) return;

    setDrillLoading(true);
    try {
      const res = await apiGet(`/spk?submittedBy=${encodeURIComponent(userId)}&limit=50`);
      const spks = Array.isArray(res) ? res : (res.data ?? []);
      setDrillData(prev => ({ ...prev, [userId]: spks }));
    } catch (e) {
      toast.error('Gagal memuat riwayat: ' + e.message);
    } finally {
      setDrillLoading(false);
    }
  }

  const displayed = onlyActive ? stats.filter(u => u.totalSpk > 0) : stats;
  const totalSpkAll = stats.reduce((s, u) => s + u.totalSpk, 0);
  const totalApprovedAll = stats.reduce((s, u) => s + u.approvedSpk, 0);
  const activeCount = stats.filter(u => u.totalSpk > 0).length;
  const maxSpk = stats[0]?.totalSpk || 1;

  return (
    <div className="p-6 space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-xl font-semibold text-gray-800">Track Record Teknisi</h2>
          <p className="text-sm text-gray-500">Rekap jumlah SPK per pengguna</p>
        </div>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={onlyActive}
              onChange={e => setOnlyActive(e.target.checked)}
              className="accent-blue-600"
            />
            Hanya yang aktif
          </label>
          <button
            onClick={load}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors text-gray-600"
          >
            <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
            Refresh
          </button>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-4">
        <SummaryCard
          icon={ClipboardList}
          label="Total SPK Keseluruhan"
          value={loading ? '—' : totalSpkAll}
          sub={`${totalApprovedAll} disetujui`}
          color="bg-blue-50 text-blue-600"
        />
        <SummaryCard
          icon={Users}
          label="Teknisi Aktif"
          value={loading ? '—' : activeCount}
          sub={`dari ${stats.length} pengguna`}
          color="bg-violet-50 text-violet-600"
        />
        <SummaryCard
          icon={CheckCircle2}
          label="Tingkat Persetujuan"
          value={loading || totalSpkAll === 0 ? '—' : `${Math.round((totalApprovedAll / totalSpkAll) * 100)}%`}
          sub="SPK disetujui / total"
          color="bg-green-50 text-green-600"
        />
      </div>

      {/* Table */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide w-10">#</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Nama</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Role</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Grup</th>
              <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wide">Total SPK</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Proporsi</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Terakhir Submit</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={7} className="px-4 py-10 text-center text-gray-400">Memuat...</td></tr>
            ) : displayed.length === 0 ? (
              <tr><td colSpan={7} className="px-4 py-10 text-center text-gray-400">Tidak ada data</td></tr>
            ) : displayed.map((u, idx) => (
              <Fragment key={u.id}>
                <tr
                  onClick={() => toggleRow(u.id)}
                  className={cn(
                    'cursor-pointer border-b border-gray-100 hover:bg-gray-50 transition-colors',
                    expandedId === u.id && 'bg-blue-50 hover:bg-blue-50'
                  )}
                >
                  {/* Rank */}
                  <td className="px-4 py-3 text-center">
                    {idx < 3 && u.totalSpk > 0 ? (
                      <span className={cn(
                        'inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold',
                        idx === 0 && 'bg-yellow-400 text-white',
                        idx === 1 && 'bg-gray-300 text-gray-700',
                        idx === 2 && 'bg-amber-600 text-white',
                      )}>
                        {idx + 1}
                      </span>
                    ) : (
                      <span className="text-xs text-gray-300">{idx + 1}</span>
                    )}
                  </td>

                  {/* Name + expand chevron */}
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      {expandedId === u.id
                        ? <ChevronDown size={13} className="text-blue-500 shrink-0" />
                        : <ChevronRight size={13} className="text-gray-300 shrink-0" />
                      }
                      <span className="font-medium text-gray-900">{u.name || u.id}</span>
                    </div>
                  </td>

                  <td className="px-4 py-3 text-gray-500 capitalize text-xs">{u.role || '—'}</td>
                  <td className="px-4 py-3 text-gray-500 text-xs">{u.group || '—'}</td>

                  {/* Total SPK — highlighted */}
                  <td className="px-4 py-3 text-center">
                    <div className="flex flex-col items-center gap-0.5">
                      <span className={cn(
                        'text-2xl font-extrabold tabular-nums leading-none',
                        u.totalSpk === 0 ? 'text-gray-300' : 'text-blue-600'
                      )}>
                        {u.totalSpk}
                      </span>
                      {u.totalSpk > 0 && (
                        <span className="text-[10px] text-gray-400">{u.approvedSpk} disetujui</span>
                      )}
                    </div>
                  </td>

                  {/* Relative bar */}
                  <td className="px-4 py-3">
                    {u.totalSpk > 0 ? (
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-2.5 bg-gray-100 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-blue-500 rounded-full transition-all"
                            style={{ width: `${Math.round((u.totalSpk / maxSpk) * 100)}%` }}
                          />
                        </div>
                        <span className="text-xs text-gray-400 tabular-nums w-12 text-right">
                          {Math.round((u.totalSpk / maxSpk) * 100)}%
                        </span>
                      </div>
                    ) : (
                      <span className="text-xs text-gray-300">—</span>
                    )}
                  </td>

                  <td className="px-4 py-3 text-gray-400 text-xs">
                    {u.lastSubmittedAt ? formatDate(u.lastSubmittedAt) : '—'}
                  </td>
                </tr>

                {expandedId === u.id && (
                  <tr>
                    <td colSpan={7} className="px-0 py-0 border-b border-gray-200">
                      <DrillDown
                        userId={u.id}
                        spks={drillData[u.id]}
                        loading={drillLoading && !drillData[u.id]}
                      />
                    </td>
                  </tr>
                )}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function DrillDown({ userId, spks, loading }) {
  if (loading) return <p className="px-10 py-4 text-sm text-gray-400">Memuat riwayat...</p>;
  if (!spks) return null;
  if (spks.length === 0) return <p className="px-10 py-4 text-sm text-gray-400">Belum ada SPK tercatat.</p>;

  return (
    <div className="bg-gray-50 px-10 py-4">
      <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide mb-3">
        Riwayat SPK — {spks.length} entri terakhir
      </p>
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b border-gray-200">
            <th className="pb-2 text-left font-semibold text-gray-500 uppercase tracking-wide pr-4">No. SPK</th>
            <th className="pb-2 text-left font-semibold text-gray-500 uppercase tracking-wide pr-4">Deskripsi</th>
            <th className="pb-2 text-left font-semibold text-gray-500 uppercase tracking-wide pr-4">Kategori</th>
            <th className="pb-2 text-left font-semibold text-gray-500 uppercase tracking-wide pr-4">Status</th>
            <th className="pb-2 text-left font-semibold text-gray-500 uppercase tracking-wide pr-4">Tgl Submit</th>
            <th className="pb-2 text-left font-semibold text-gray-500 uppercase tracking-wide">Tgl Selesai</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {spks.map(spk => (
            <tr key={spk.spkNumber} className="hover:bg-white transition-colors">
              <td className="py-2 pr-4 font-mono text-gray-700">{spk.spkNumber}</td>
              <td className="py-2 pr-4 text-gray-600 max-w-[240px] truncate">{spk.description || '—'}</td>
              <td className="py-2 pr-4">{spk.category ? <CategoryBadge category={spk.category} /> : '—'}</td>
              <td className="py-2 pr-4"><StatusBadge status={spk.status} /></td>
              <td className="py-2 pr-4 text-gray-500">{spk.submittedAt ? formatDate(spk.submittedAt) : '—'}</td>
              <td className="py-2 text-gray-500">{spk.completedAt ? formatDate(spk.completedAt) : '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {spks.length >= 50 && (
        <div className="mt-3">
          <a
            href={`/spk?submittedBy=${encodeURIComponent(userId)}`}
            className="inline-flex items-center gap-1 text-xs text-blue-600 hover:underline"
          >
            Lihat semua <ExternalLink size={11} />
          </a>
        </div>
      )}
    </div>
  );
}
