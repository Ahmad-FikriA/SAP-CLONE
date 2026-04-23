'use client';

import { useState, useEffect } from 'react';
import { apiGet } from '@/lib/api';
import { FileText, Wrench, Radio, Users } from 'lucide-react';

function KpiCard({ icon: Icon, label, value, sub, color, loading }) {
  return (
    <div className={`bg-white border border-gray-200 rounded-xl px-5 py-4 flex items-center gap-4`}>
      <div className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${color}`}>
        <Icon size={20} className="text-white" />
      </div>
      <div className="min-w-0">
        <p className="text-xs text-gray-500 font-medium">{label}</p>
        {loading ? (
          <div className="h-7 w-12 bg-gray-100 animate-pulse rounded mt-1" />
        ) : (
          <p className="text-2xl font-bold text-gray-800 leading-tight">{value ?? '—'}</p>
        )}
        {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}

export function WidgetSummary() {
  const [stats, setStats] = useState({ spk: null, corrective: null, equipment: null, users: null });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const [spkData, corrData, eqData, usrData] = await Promise.allSettled([
          apiGet("/spk"),
          apiGet("/corrective/sap-spk"),
          apiGet("/equipment?limit=1"),
          apiGet("/users"),
        ]);

        const spkList =
          spkData.status === "fulfilled"
            ? Array.isArray(spkData.value)
              ? spkData.value
              : []
            : [];
        const corrList =
          corrData.status === "fulfilled"
            ? Array.isArray(corrData.value)
              ? corrData.value
              : []
            : [];
        const eqTotal =
          eqData.status === "fulfilled"
            ? eqData.value?.total ??
              (Array.isArray(eqData.value?.data) ? null : null)
            : null;
        const usrList =
          usrData.status === "fulfilled"
            ? Array.isArray(usrData.value)
              ? usrData.value
              : []
            : [];

        setStats({
          spk: spkList.length,
          corrective: corrList.filter((s) => s.status !== "selesai" && s.status !== "ditolak").length,
          equipment: eqTotal,
          users: usrList.length,
        });
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const cards = [
    { icon: FileText, label: 'Total SPK Preventive', value: stats.spk, sub: 'Semua status', color: 'bg-blue-600' },
    { icon: Wrench,   label: 'Corrective Aktif',     value: stats.corrective, sub: 'Belum selesai', color: 'bg-orange-500' },
    { icon: Radio,    label: 'Total Equipment',       value: stats.equipment, sub: 'Semua plant', color: 'bg-violet-600' },
    { icon: Users,    label: 'Total User',            value: stats.users, sub: 'Terdaftar', color: 'bg-teal-600' },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {cards.map((c) => (
        <KpiCard key={c.label} {...c} loading={loading} />
      ))}
    </div>
  );
}
