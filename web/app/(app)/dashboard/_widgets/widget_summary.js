'use client';

import { useState, useEffect } from 'react';
import { apiGet } from '@/lib/api';
import { getUser } from '@/lib/auth';
import { FileText, Wrench, Radio, Users, AlertCircle, RotateCcw } from 'lucide-react';
import Link from 'next/link';

function KpiCard({ icon: Icon, label, value, sub, color, loading, error, onRetry, href }) {
  const inner = (
    <div className={`bg-white border rounded-xl px-5 py-4 flex items-center gap-4 transition-colors ${href ? 'hover:bg-gray-50 cursor-pointer' : ''} ${error ? 'border-red-200' : 'border-gray-200'}`}>
      <div className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${color}`}>
        <Icon size={20} className="text-white" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-xs text-gray-500 font-medium">{label}</p>
        {loading ? (
          <div className="h-7 w-12 bg-gray-100 animate-pulse rounded mt-1" />
        ) : error ? (
          <div className="flex items-center gap-1.5 mt-1">
            <AlertCircle size={14} className="text-red-400" />
            <span className="text-xs text-red-400">Gagal memuat</span>
            <button
              onClick={(e) => { e.preventDefault(); onRetry?.(); }}
              className="ml-1 p-0.5 rounded hover:bg-red-50 text-red-400 hover:text-red-600 transition-colors"
              title="Coba lagi"
            >
              <RotateCcw size={12} />
            </button>
          </div>
        ) : (
          <p className="text-2xl font-bold text-gray-800 leading-tight">{value ?? '—'}</p>
        )}
        {!error && sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
      </div>
    </div>
  );

  if (href && !error) {
    return <Link href={href}>{inner}</Link>;
  }
  return inner;
}

export function WidgetSummary() {
  const [stats, setStats] = useState({ spk: null, corrective: null, equipment: null, users: null });
  const [loading, setLoading] = useState(true);
  const [errors, setErrors] = useState({ spk: false, corrective: false, equipment: false, users: false });

  const rolePages = getUser()?.rolePages ?? null; // null = unrestricted
  function canLink(key) { return rolePages ? rolePages.includes(key) : true; }

  async function load() {
    setLoading(true);
    setErrors({ spk: false, corrective: false, equipment: false, users: false });
    try {
      const [spkData, corrData, eqData, usrData] = await Promise.allSettled([
        apiGet('/spk'),
        apiGet('/corrective/sap-spk'),
        apiGet('/equipment?limit=1'),
        apiGet('/users'),
      ]);

      const newErrors = {
        spk:        spkData.status === 'rejected',
        corrective: corrData.status === 'rejected',
        equipment:  eqData.status === 'rejected',
        users:      usrData.status === 'rejected',
      };

      const spkList  = spkData.status  === 'fulfilled' ? (Array.isArray(spkData.value)  ? spkData.value  : []) : [];
      const corrList = corrData.status === 'fulfilled' ? (Array.isArray(corrData.value) ? corrData.value : []) : [];
      const eqTotal  = eqData.status   === 'fulfilled' ? (eqData.value?.total ?? null)  : null;
      const usrList  = usrData.status  === 'fulfilled' ? (Array.isArray(usrData.value)  ? usrData.value  : []) : [];

      setStats({
        spk:        newErrors.spk        ? null : spkList.length,
        corrective: newErrors.corrective ? null : corrList.filter(s => s.status !== 'selesai' && s.status !== 'ditolak').length,
        equipment:  newErrors.equipment  ? null : eqTotal,
        users:      newErrors.users      ? null : usrList.length,
      });
      setErrors(newErrors);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  const cards = [
    { icon: FileText, label: 'Total SPK Preventive', value: stats.spk,        sub: 'Semua status',  color: 'bg-blue-600',   href: canLink('spk')        ? '/spk'        : null, key: 'spk' },
    { icon: Wrench,   label: 'Corrective Aktif',     value: stats.corrective, sub: 'Belum selesai', color: 'bg-orange-500', href: canLink('corrective') ? '/corrective' : null, key: 'corrective' },
    { icon: Radio,    label: 'Total Equipment',       value: stats.equipment,  sub: 'Semua plant',   color: 'bg-violet-600', href: canLink('equipment')  ? '/equipment'  : null, key: 'equipment' },
    { icon: Users,    label: 'Total User',            value: stats.users,      sub: 'Terdaftar',     color: 'bg-teal-600',   href: canLink('users')      ? '/users'      : null, key: 'users' },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {cards.map((c) => (
        <KpiCard
          key={c.key}
          icon={c.icon}
          label={c.label}
          value={c.value}
          sub={c.sub}
          color={c.color}
          href={c.href}
          loading={loading}
          error={errors[c.key]}
          onRetry={load}
        />
      ))}
    </div>
  );
}
