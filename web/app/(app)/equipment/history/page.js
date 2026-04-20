'use client';

import { useState, useEffect, useMemo, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { apiGet } from '@/lib/api';
import { RefreshCw, BarChart2, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer,
} from 'recharts';

function detectMeasurement(text) {
  if (!text) return null;
  const t = text.toLowerCase();
  const unitPatterns = [
    { re: /°c|ºc/i, unit: '°C' },
    { re: /mm\/s/i, unit: 'mm/s' },
    { re: /m3\/h/i, unit: 'm3/h' },
    { re: /\bbar\b/i, unit: 'bar' },
    { re: /\bntu\b/i, unit: 'NTU' },
    { re: /\bph\b/i, unit: 'pH' },
    { re: /\bohm\b/i, unit: 'Ohm' },
    { re: /\b%/i, unit: '%' },
    { re: /\ba\b/i, unit: 'A' },
    { re: /\bv\b/i, unit: 'V' },
  ];
  let detectedUnit = null;
  for (const p of unitPatterns) {
    if (p.re.test(text)) { detectedUnit = p.unit; break; }
  }
  if (/vib.*\bnde\b/i.test(t)) return { label: 'Vib NDE', unit: detectedUnit || 'mm/s' };
  if (/vib.*\bde\b/i.test(t)) return { label: 'Vib DE', unit: detectedUnit || 'mm/s' };
  if (/vibrasi|vibration/i.test(t)) return { label: 'Vibrasi', unit: detectedUnit || 'mm/s' };
  if (/temperatur|suhu/i.test(t)) return { label: 'Temperatur', unit: detectedUnit || '°C' };
  if (/tekanan|pressure/i.test(t)) return { label: 'Tekanan', unit: detectedUnit || 'bar' };
  if (/ampere|arus listrik/i.test(t)) return { label: 'Arus', unit: detectedUnit || 'A' };
  if (/tegangan/.test(t) && /ukur|catat/.test(t)) return { label: 'Tegangan', unit: detectedUnit || 'V' };
  if (/turbid|kekeruhan/i.test(t)) return { label: 'Kekeruhan', unit: detectedUnit || 'NTU' };
  if (/keasaman|ph/i.test(t)) return { label: 'pH', unit: detectedUnit || 'pH' };
  if (/level/.test(t) && /catat|ukur/.test(t)) return { label: 'Level', unit: detectedUnit || '%' };
  if (/kebisingan/i.test(t)) return { label: 'Kebisingan', unit: detectedUnit || 'dB(A)' };
  if (/flow|debit|aliran/i.test(t)) return { label: 'Flow', unit: detectedUnit || 'm3/h' };
  return null;
}

const LINE_COLORS = ['#3b82f6','#f97316','#10b981','#a855f7','#ef4444','#eab308','#06b6d4','#ec4899'];

function fmtDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });
}

function ChartTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-md px-3 py-2 text-xs">
      <p className="font-semibold text-gray-700 mb-1">{label}</p>
      {payload.map((p, i) => (
        <p key={i} style={{ color: p.color }}>
          {p.name}: <strong>{p.value}</strong>
        </p>
      ))}
    </div>
  );
}

function EquipmentHistoryContent() {
  const params = useSearchParams();
  const router = useRouter();
  const equipmentId = params.get('id');

  const [equip, setEquip] = useState(null);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!equipmentId) return;
    apiGet(`/equipment/${equipmentId}`).then(setEquip).catch(() => {});
    load();
  }, [equipmentId]); // eslint-disable-line react-hooks/exhaustive-deps

  async function load() {
    if (!equipmentId) return;
    setLoading(true);
    try {
      const data = await apiGet(`/equipment/${equipmentId}/measurement-history`);
      setHistory(data);
    } catch (e) {
      toast.error('Gagal memuat: ' + e.message);
    } finally {
      setLoading(false);
    }
  }

  const enriched = useMemo(() => history.map(r => {
    const meas = r.measurementType
      ? { label: r.measurementType, unit: r.measurementUnit }
      : detectMeasurement(r.operationText);
    return { ...r, measLabel: meas?.label || r.activityNumber, measUnit: meas?.unit || '' };
  }), [history]);

  const chartTypes = useMemo(() => [...new Set(enriched.map(r => r.measLabel))], [enriched]);

  const chartData = useMemo(() => {
    const byDate = {};
    [...enriched].reverse().forEach(r => {
      const d = fmtDate(r.submittedAt);
      if (!byDate[d]) byDate[d] = { date: d };
      byDate[d][r.measLabel] = r.measurementValue;
    });
    return Object.values(byDate);
  }, [enriched]);

  if (!equipmentId) {
    return (
      <div className="p-6 text-center text-gray-500 text-sm">
        Buka halaman ini dari daftar equipment.
        <br />
        <Button variant="link" onClick={() => router.push('/equipment')}>← Ke Equipment</Button>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={() => router.back()} className="gap-1.5 text-gray-500">
          <ArrowLeft size={15} /> Kembali
        </Button>
        <div className="flex items-center gap-2">
          <BarChart2 className="w-5 h-5 text-blue-600" />
          <h1 className="text-xl font-bold text-gray-800">Riwayat Pengukuran</h1>
        </div>
        <Button variant="outline" size="sm" onClick={load} disabled={loading}>
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </Button>
      </div>

      {/* Equipment info card */}
      {equip && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 flex flex-wrap gap-x-6 gap-y-1 text-sm">
          <span><span className="font-semibold text-blue-700">ID:</span> {equip.equipmentId}</span>
          <span><span className="font-semibold text-blue-700">Nama:</span> {equip.equipmentName}</span>
          {equip.functionalLocation && (
            <span><span className="font-semibold text-blue-700">Funcloc:</span> {equip.functionalLocation}</span>
          )}
          {equip.category && (
            <span><span className="font-semibold text-blue-700">Kategori:</span> {equip.category}</span>
          )}
        </div>
      )}

      {/* Chart */}
      {!loading && chartData.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-4">Tren Nilai Ukur</h2>
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={chartData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="date" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip content={<ChartTooltip />} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              {chartTypes.map((type, i) => (
                <Line
                  key={type}
                  type="monotone"
                  dataKey={type}
                  stroke={LINE_COLORS[i % LINE_COLORS.length]}
                  strokeWidth={2}
                  dot={{ r: 4 }}
                  connectNulls
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100">
          <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
            Riwayat Detail
            {enriched.length > 0 && <span className="ml-2 text-blue-600 normal-case font-normal">{enriched.length} entri</span>}
          </h2>
        </div>

        {loading ? (
          <div className="py-16 text-center text-gray-400 text-sm">Memuat data...</div>
        ) : enriched.length === 0 ? (
          <div className="py-16 text-center text-gray-400 text-sm">Belum ada data pengukuran untuk equipment ini</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                  <th className="px-4 py-3 text-left">Tanggal</th>
                  <th className="px-4 py-3 text-left">No. SPK</th>
                  <th className="px-4 py-3 text-left">Teknisi</th>
                  <th className="px-4 py-3 text-left">Aktivitas</th>
                  <th className="px-4 py-3 text-right">Nilai Ukur</th>
                  <th className="px-4 py-3 text-left">Satuan</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {enriched.map((r, i) => (
                  <tr key={i} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 text-gray-700 whitespace-nowrap">{fmtDate(r.submittedAt)}</td>
                    <td className="px-4 py-3 font-mono text-xs text-blue-700">{r.spkNumber}</td>
                    <td className="px-4 py-3 text-gray-700">{r.technicianName}</td>
                    <td className="px-4 py-3 text-gray-600 max-w-xs truncate" title={r.operationText}>
                      {r.operationText}
                    </td>
                    <td className="px-4 py-3 text-right font-semibold text-gray-800">
                      {r.measurementValue !== null ? r.measurementValue : '—'}
                    </td>
                    <td className="px-4 py-3 text-gray-500">{r.measUnit || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

export default function EquipmentHistoryPage() {
  return (
    <Suspense>
      <EquipmentHistoryContent />
    </Suspense>
  );
}
