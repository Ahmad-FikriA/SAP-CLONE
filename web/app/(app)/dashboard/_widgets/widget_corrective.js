'use client';

import { useState, useEffect } from 'react';
import { apiGet } from '@/lib/api';
import Link from 'next/link';
import { Wrench, ArrowRight, RefreshCw, AlertTriangle, Clock, CheckCircle2 } from 'lucide-react';

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
  baru_import: "bg-blue-100 text-blue-700",
  eksekusi: "bg-orange-100 text-orange-700",
  menunggu_review_kadis_pp: "bg-purple-100 text-purple-700",
  menunggu_review_kadis_pelapor: "bg-indigo-100 text-indigo-700",
  selesai: "bg-green-100 text-green-700",
  ditolak: "bg-red-100 text-red-600",
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

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const [reqData, spkData] = await Promise.all([
        apiGet("/corrective/requests"),
        apiGet("/corrective/sap-spk"),
      ]);
      setRequests(Array.isArray(reqData) ? reqData : []);
      setSpks(Array.isArray(spkData) ? spkData : []);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  const openRequests = requests.filter(
    (r) => r.approvalStatus === "pending",
  ).length;
  const approvedReqs = requests.filter(
    (r) => r.approvalStatus === "approved",
  ).length;
  const activeSpks = spks.filter(
    (s) => s.status !== "selesai" && s.status !== "ditolak",
  );
  const completedSpks = spks.filter((s) => s.status === "selesai").length;
  const recentSpks = [...activeSpks]
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
    .slice(0, 5);

  return (
    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-orange-500 flex items-center justify-center">
            <Wrench size={16} className="text-white" />
          </div>
          <div>
            <p className="text-sm font-semibold text-gray-800">Corrective</p>
            <p className="text-xs text-gray-400">Corrective maintenance</p>
          </div>
        </div>
        <button onClick={load} disabled={loading}
          className="p-1.5 rounded hover:bg-gray-100 text-gray-400 transition-colors">
          <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      {loading ? (
        <div className="flex-1 flex items-center justify-center py-10 text-gray-400 text-sm">Memuat...</div>
      ) : error ? (
        <div className="flex-1 flex items-center justify-center py-10 text-red-500 text-sm">{error}</div>
      ) : (
        <div className="flex-1 px-5 py-4 space-y-4">
          {/* KPI row */}
          <div className="grid grid-cols-3 gap-2">
            {[
              { icon: AlertTriangle, label: 'Masuk', value: openRequests, color: 'text-yellow-600', bg: 'bg-yellow-50' },
              { icon: Clock,         label: 'Perlu SPK', value: approvedReqs, color: 'text-blue-600', bg: 'bg-blue-50' },
              { icon: CheckCircle2,  label: 'Selesai', value: completedSpks, color: 'text-green-600', bg: 'bg-green-50' },
            ].map(({ icon: Icon, label, value, color, bg }) => (
              <div key={label} className={`rounded-lg p-3 ${bg} flex flex-col items-center gap-1`}>
                <Icon size={16} className={color} />
                <span className={`text-xl font-bold ${color}`}>{value}</span>
                <span className="text-xs text-gray-500">{label}</span>
              </div>
            ))}
          </div>

          {/* Active SPKs */}
          {recentSpks.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">
                SPK Aktif ({activeSpks.length})
              </p>
              <div className="space-y-1.5">
                {recentSpks.map((spk) => (
                  <div key={spk.spkId} className="flex items-center gap-2 py-1">
                    <span className="font-mono text-xs font-semibold text-gray-700 w-28 truncate shrink-0">
                      {spk.order_number}
                    </span>
                    <span className="text-xs text-gray-400 shrink-0">
                      {fmtDate(spk.created_at)}
                    </span>
                    <span className={`ml-auto px-2 py-0.5 rounded text-xs font-semibold shrink-0 ${SPK_STATUS_COLORS[spk.status] || 'bg-gray-100 text-gray-600'}`}>
                      {SPK_STATUS_LABELS[spk.status] || spk.status}
                    </span>
                    {spk.priority && (
                      <span className={`px-1.5 py-0.5 rounded text-xs font-semibold shrink-0 ${PRIORITY_COLORS[spk.priority] || 'bg-gray-100 text-gray-600'} capitalize`}>
                        {spk.priority}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {recentSpks.length === 0 && (
            <div className="text-center py-4 text-sm text-gray-400">Tidak ada SPK aktif</div>
          )}
        </div>
      )}

      {/* Footer */}
      <div className="px-5 py-3 border-t border-gray-100 bg-gray-50">
        <Link href="/corrective" className="flex items-center gap-1 text-xs font-medium text-orange-600 hover:text-orange-800 transition-colors">
          Lihat semua corrective <ArrowRight size={12} />
        </Link>
      </div>
    </div>
  );
}
